import { z } from "zod";
import { completedRiskProfileSchema } from "./risk-profile";

export const discoveryIndustries = {
  manufacturing: "制造业",
  information_software_it: "信息传输、软件和信息技术服务业",
  utilities: "电力、热力、燃气及水生产和供应业",
  financial_services: "金融业",
  wholesale_retail: "批发和零售业",
} as const;

const industryIdSchema = z.enum([
  "manufacturing",
  "information_software_it",
  "utilities",
  "financial_services",
  "wholesale_retail",
]);
const industryIds = industryIdSchema.options;
const sameList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const normalizedIndustryPreferenceSchema = z
  .object({
    selection_mode: z.enum(["selected", "all_supported"]),
    selected_industries: z.array(industryIdSchema),
    effective_industries: z.array(industryIdSchema),
  })
  .strict()
  .refine(
    (value) =>
      value.selection_mode === "all_supported"
        ? value.selected_industries.length === 0 &&
          value.effective_industries.length === industryIds.length &&
          new Set(value.effective_industries).size === industryIds.length
        : value.selected_industries.length > 0 &&
          new Set(value.selected_industries).size === value.selected_industries.length &&
          sameList(value.selected_industries, value.effective_industries),
    { message: "Selected industries, effective industries and selection mode must agree." },
  );

const tickerSchema = z.string().regex(/^(?:600|601|603|605|688|689)\d{3}$/);
const companyIdSchema = z.string().regex(/^SSE:(?:600|601|603|605|688|689)\d{3}$/);
const identitySchema = z.object({ exchange: z.literal("SSE"), ticker: tickerSchema });
const sizeSchema = z.enum(["Large cap", "Mid cap", "Small cap"]);
export const discoveryCompanySchema = identitySchema
  .extend({
    name: z.string().min(1).regex(/\S/),
    industry: z.enum([
      discoveryIndustries.manufacturing,
      discoveryIndustries.information_software_it,
      discoveryIndustries.utilities,
      discoveryIndustries.financial_services,
      discoveryIndustries.wholesale_retail,
    ]),
    market_cap_rmb: z.number().finite().nonnegative(),
    size_category: sizeSchema,
  })
  .strict();

export const companyDiscoveryInputSchema = z
  .object({
    risk_result: completedRiskProfileSchema,
    industry_preference: normalizedIndustryPreferenceSchema,
    watchlist: z.array(companyIdSchema),
  })
  .strict();

export const discoverySessionSchema = z
  .object({
    session_id: z.string().min(1).regex(/\S/),
    ordered_company_ids: z.array(companyIdSchema).min(1).max(5),
    round_index: z.number().int().min(0).max(5),
    exposed_company_ids: z.array(companyIdSchema).min(1).max(5),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.ordered_company_ids).size === value.ordered_company_ids.length &&
      value.round_index <= value.ordered_company_ids.length &&
      sameList(
        value.exposed_company_ids,
        value.ordered_company_ids.slice(0, value.round_index + 1),
      ),
    { message: "Session order, round index and exposed prefix must agree." },
  );

export const discoveryRequestSchema = z.discriminatedUnion("action", [
  companyDiscoveryInputSchema.extend({ action: z.literal("start") }),
  z
    .object({
      action: z.literal("advance"),
      session_state: discoverySessionSchema,
      company_id: companyIdSchema,
      choice: z.enum(["add", "skip"]),
    })
    .strict(),
]);

const catalogValidationSchema = z
  .object({
    excluded_record_count: z.number().int().nonnegative(),
    errors: z.array(
      z
        .object({ record_index: z.number().int().nonnegative(), reason: z.string().min(1) })
        .strict(),
    ),
  })
  .strict()
  .refine(
    (value) =>
      value.excluded_record_count === value.errors.length &&
      new Set(value.errors.map((error) => error.record_index)).size === value.errors.length,
    { message: "Catalog exclusion count must match distinct record errors." },
  );
const invalidInputSchema = z
  .object({
    status: z.literal("invalid_input"),
    error_code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();
const roundShape = {
  status: z.literal("ready"),
  session_id: z.string().min(1),
  session_state: discoverySessionSchema,
  ordered_company_ids: z.array(companyIdSchema).min(1).max(5),
  current_round: z.number().int().min(1).max(5),
  total_rounds: z.number().int().min(1).max(5),
  current_company: discoveryCompanySchema,
  metric_request_company_ids: z.tuple([companyIdSchema]),
  catalog_validation: catalogValidationSchema,
};
const watchlistAddSchema = identitySchema.strict();
const creationReadySchema = z
  .object({
    ...roundShape,
    target_size_category: sizeSchema,
    eligible_company_count: z.number().int().positive(),
  })
  .strict();
const advanceReadySchema = z
  .object({ ...roundShape, watchlist_add: watchlistAddSchema.optional() })
  .strict();

export const discoveryResultSchema = z
  .union([
    creationReadySchema,
    advanceReadySchema,
    z
      .object({
        status: z.literal("session_completed"),
        session_state: discoverySessionSchema,
        watchlist_add: watchlistAddSchema.optional(),
        catalog_validation: catalogValidationSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal("exhausted"),
        companies: z.tuple([]),
        user_message: z.literal(
          "You have seen all matching companies. Come back later for new companies.",
        ),
        catalog_validation: catalogValidationSchema,
      })
      .strict(),
    invalidInputSchema,
  ])
  .refine(
    (value) => {
      if (value.status === "session_completed")
        return value.session_state.round_index === value.session_state.ordered_company_ids.length;
      if (value.status !== "ready") return true;
      const state = value.session_state;
      const currentId = `SSE:${value.current_company.ticker}`;
      return (
        state.round_index < state.ordered_company_ids.length &&
        value.session_id === state.session_id &&
        sameList(value.ordered_company_ids, state.ordered_company_ids) &&
        value.total_rounds === state.ordered_company_ids.length &&
        value.current_round === state.round_index + 1 &&
        currentId === state.ordered_company_ids[state.round_index] &&
        value.metric_request_company_ids[0] === currentId &&
        (!("target_size_category" in value) ||
          (value.target_size_category === value.current_company.size_category &&
            value.ordered_company_ids.length === Math.min(5, value.eligible_company_count) &&
            state.round_index === 0))
      );
    },
    { message: "Discovery result must agree with its session and current company." },
  );

export type DiscoveryCompany = z.infer<typeof discoveryCompanySchema>;
export type DiscoverySession = z.infer<typeof discoverySessionSchema>;
export type DiscoveryResult = z.infer<typeof discoveryResultSchema>;
type CreationResult =
  | z.infer<typeof creationReadySchema>
  | Extract<DiscoveryResult, { status: "exhausted" | "invalid_input" }>;
type AdvanceResult =
  | z.infer<typeof advanceReadySchema>
  | Extract<DiscoveryResult, { status: "session_completed" | "invalid_input" }>;

function invalid(message: string): z.infer<typeof invalidInputSchema> {
  return { status: "invalid_input", error_code: "INVALID_INPUT", message };
}

function validateCatalog(records: readonly unknown[]) {
  const groups = new Map<string, { index: number; company?: DiscoveryCompany }[]>();
  const errors = new Map<number, string>();
  records.forEach((record, index) => {
    const parsed = discoveryCompanySchema.safeParse(record);
    if (!parsed.success)
      errors.set(index, parsed.error.issues.map((issue) => issue.message).join("; "));
    const identity = identitySchema.safeParse(record);
    if (!identity.success) return;
    const id = `SSE:${identity.data.ticker}`;
    const group = groups.get(id) ?? [];
    group.push({ index, company: parsed.success ? parsed.data : undefined });
    groups.set(id, group);
  });
  const companies = new Map<string, DiscoveryCompany>();
  for (const [id, group] of groups) {
    const first = group[0]!.company;
    // Invalid variants of an otherwise valid identity must not evade conflict exclusion.
    if (
      group.length > 1 &&
      group.some(
        (entry) => !entry.company || JSON.stringify(entry.company) !== JSON.stringify(first),
      )
    ) {
      for (const entry of group) errors.set(entry.index, `Conflicting duplicate identity ${id}.`);
    } else if (first) {
      companies.set(id, first);
      for (const entry of group.slice(1))
        errors.set(entry.index, `Identical duplicate identity ${id}.`);
    }
  }
  return {
    companies,
    report: {
      excluded_record_count: errors.size,
      errors: [...errors]
        .sort(([left], [right]) => left - right)
        .map(([record_index, reason]) => ({ record_index, reason })),
    },
  };
}

function roundResult(
  session: DiscoverySession,
  company: DiscoveryCompany,
  catalog_validation: z.infer<typeof catalogValidationSchema>,
): z.infer<typeof advanceReadySchema> {
  return {
    status: "ready",
    session_id: session.session_id,
    session_state: session,
    ordered_company_ids: [...session.ordered_company_ids],
    current_round: session.round_index + 1,
    total_rounds: session.ordered_company_ids.length,
    current_company: company,
    metric_request_company_ids: [`SSE:${company.ticker}`],
    catalog_validation,
  };
}

export function createDiscoverySession(
  raw: unknown,
  records: unknown,
  options?: { random?: () => number; sessionId?: string },
): CreationResult {
  const input = companyDiscoveryInputSchema.safeParse(raw);
  if (!input.success || !Array.isArray(records))
    return invalid(
      "Provide a consistent completed risk result, normalized preference, watchlist and catalog array.",
    );
  const sessionId = options?.sessionId ?? globalThis.crypto.randomUUID();
  if (!z.string().trim().min(1).safeParse(sessionId).success)
    return invalid("Session ID must be nonempty.");
  const catalog = validateCatalog(records);
  const target = ({ low: "Large cap", medium: "Mid cap", high: "Small cap" } as const)[
    input.data.risk_result.risk_profile_bucket
  ];
  const labels = input.data.industry_preference.effective_industries.map(
    (id) => discoveryIndustries[id],
  );
  const watchlist = new Set(input.data.watchlist);
  const eligible = [...catalog.companies.entries()].filter(
    ([id, company]) =>
      company.size_category === target && labels.includes(company.industry) && !watchlist.has(id),
  );
  if (!eligible.length)
    return {
      status: "exhausted",
      companies: [],
      user_message: "You have seen all matching companies. Come back later for new companies.",
      catalog_validation: catalog.report,
    };
  const random = options?.random ?? Math.random;
  for (let index = eligible.length - 1; index > 0; index--) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
      return invalid("Random source must return finite values in [0, 1).");
    const other = Math.floor(sample * (index + 1));
    [eligible[index], eligible[other]] = [eligible[other]!, eligible[index]!];
  }
  const ordered = eligible.slice(0, 5).map(([id]) => id);
  const session: DiscoverySession = {
    session_id: sessionId,
    ordered_company_ids: ordered,
    round_index: 0,
    exposed_company_ids: [ordered[0]!],
  };
  return {
    ...roundResult(session, eligible[0]![1], catalog.report),
    target_size_category: target,
    eligible_company_count: eligible.length,
  };
}

/** Pure transition: callers must retain the latest state and reject replay of older snapshots. */
export function advanceDiscoverySession(
  raw: unknown,
  companyId: string,
  choice: "add" | "skip",
  records: readonly unknown[],
): AdvanceResult {
  const parsed = discoverySessionSchema.safeParse(raw);
  if (!parsed.success || !Array.isArray(records) || (choice !== "add" && choice !== "skip"))
    return invalid("Provide a valid session, catalog and add or skip choice.");
  const session = parsed.data;
  if (session.ordered_company_ids[session.round_index] !== companyId)
    return invalid("The selected identity must be the current unconsumed round.");
  const catalog = validateCatalog(records);
  // Validate the entire retained order before emitting a save or exposing another card.
  if (session.ordered_company_ids.some((id) => !catalog.companies.has(id)))
    return invalid("A session company is missing, invalid or conflicting in the catalog.");
  const company = catalog.companies.get(companyId)!;
  const next: DiscoverySession = {
    ...session,
    round_index: session.round_index + 1,
    exposed_company_ids: session.ordered_company_ids.slice(0, session.round_index + 2),
  };
  const action =
    choice === "add" ? { watchlist_add: { exchange: "SSE" as const, ticker: company.ticker } } : {};
  if (next.round_index === next.ordered_company_ids.length)
    return {
      status: "session_completed",
      session_state: next,
      catalog_validation: catalog.report,
      ...action,
    };
  return {
    ...roundResult(
      next,
      catalog.companies.get(next.ordered_company_ids[next.round_index]!)!,
      catalog.report,
    ),
    ...action,
  };
}
