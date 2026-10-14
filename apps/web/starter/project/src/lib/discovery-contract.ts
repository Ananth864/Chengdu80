import { z } from "zod";
import {
  advanceDiscoverySession,
  companyDiscoveryInputSchema,
  createDiscoverySession,
  discoveryResultSchema,
  discoverySessionSchema,
  type DiscoveryResult,
} from "./company-discovery";

const companyIdSchema = companyDiscoveryInputSchema.shape.watchlist.element;
const discoveryContractInputSchema = companyDiscoveryInputSchema.omit({ watchlist: true }).extend({
  excluded_company_ids: z.array(companyIdSchema).optional(),
});

export const discoveryContractRequestSchema = z.discriminatedUnion("action", [
  discoveryContractInputSchema.extend({ action: z.literal("start") }),
  z
    .object({
      action: z.literal("advance"),
      session_state: discoverySessionSchema,
      company_id: companyIdSchema,
    })
    .strict(),
]);

export const discoveryContractResultSchema = discoveryResultSchema.refine(
  (result) => !("watchlist_add" in result),
  { message: "Discovery advances do not emit watchlist actions." },
);

/** Neutral, pure adapter; persistence and replay protection remain the caller's responsibility. */
export function executeDiscoveryContract(raw: unknown, companies: unknown[]): DiscoveryResult {
  const request = discoveryContractRequestSchema.safeParse(raw);
  if (!request.success)
    return {
      status: "invalid_input",
      error_code: "INVALID_INPUT",
      message: "Provide a valid discovery start or neutral advance request.",
    };

  const input = request.data;
  // Legacy field and choice names are confined to this adapter, not public contract semantics.
  const result =
    input.action === "start"
      ? createDiscoverySession(
          {
            risk_result: input.risk_result,
            industry_preference: input.industry_preference,
            watchlist: input.excluded_company_ids ?? [],
          },
          companies,
        )
      : advanceDiscoverySession(input.session_state, input.company_id, "skip", companies);
  if ("watchlist_add" in result) {
    const { watchlist_add: _watchlistAdd, ...neutral } = result;
    return neutral;
  }
  return result;
}

export function startDiscoveryContract(input: unknown, records: unknown[]): DiscoveryResult {
  const parsed = discoveryContractInputSchema.safeParse(input);
  return executeDiscoveryContract(
    parsed.success ? { ...parsed.data, action: "start" } : null,
    records,
  );
}
