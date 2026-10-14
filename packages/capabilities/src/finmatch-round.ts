import { z } from "zod";
import { canonicalCapabilityJson } from "./json";

/** Product interaction helper, not a financial recommendation or catalog capability.
 * Source: capability-resources/capability_library/finmatch-application-2-product-decisions.md
 * Integration decisions: callers select at most five options; larger pools are rejected,
 * not ranked, filtered, or sampled here. Metrics and provenance are opaque JSON, each
 * bounded to 16,384 serialized characters (plus the shared JSON structural bounds).
 * No endpoint, metric fields, freshness, eligibility, or market rules are inferred.
 */
const opaqueJsonSchema = z
  .json()
  .refine(
    (value) => value !== null && canonicalCapabilityJson(value).length <= 16_384,
    "Supply non-null JSON of at most 16,384 serialized characters.",
  );
const identifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value.trim().length > 0);
const recommendationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("reference"),
    reference: identifierSchema,
    version: identifierSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("snapshot"),
    snapshot: opaqueJsonSchema,
    version: identifierSchema.optional(),
  }),
]);
const optionSchema = z.strictObject({
  // Syntax only; this does not assert that a ticker exists or is eligible.
  ticker: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,31}$/),
  assetType: z.literal("stocks"),
  recommendation: recommendationSchema,
  metrics: opaqueJsonSchema,
});
const optionsSchema = z
  .array(optionSchema)
  .max(5, "Caller must supply at most five already-selected recommendation options.")
  .refine(
    (options) => new Set(options.map((option) => option.ticker)).size === options.length,
    "A ticker must not repeat in a round.",
  );
const startSchema = z.strictObject({
  seed: z.number().int().min(0).max(0xffff_ffff),
  options: optionsSchema,
});
const timestampSchema = z.iso.datetime({ offset: true });
const selectionSchema = z.strictObject({
  timestamp: timestampSchema,
  ticker: optionSchema.shape.ticker,
  recommendation: recommendationSchema,
});
const actionSchema = z.discriminatedUnion("choice", [
  z.strictObject({ choice: z.literal("yes"), timestamp: timestampSchema }),
  z.strictObject({ choice: z.literal("no") }),
]);
const emptyNotice = "No recommendation options are available. Please come back later.";
const stateSchema = z
  .strictObject({
    seed: startSchema.shape.seed,
    options: optionsSchema,
    currentIndex: z.number().int().min(0).max(5),
    status: z.enum(["active", "finished", "empty"]),
    notice: z.literal(emptyNotice).nullable(),
    savedSelections: z.array(selectionSchema).max(5),
  })
  .refine(
    (state) =>
      state.currentIndex <= state.options.length &&
      state.status ===
        (state.options.length === 0
          ? "empty"
          : state.currentIndex === state.options.length
            ? "finished"
            : "active") &&
      state.notice === (state.status === "empty" ? emptyNotice : null) &&
      state.savedSelections.length <= state.currentIndex &&
      new Set(state.savedSelections.map((selection) => selection.ticker)).size ===
        state.savedSelections.length &&
      state.savedSelections.every((selection) =>
        state.options
          .slice(0, state.currentIndex)
          .some(
            (option) =>
              option.ticker === selection.ticker &&
              canonicalCapabilityJson(option.recommendation) ===
                canonicalCapabilityJson(selection.recommendation),
          ),
      ),
    "Round state must describe a valid forward-only round.",
  );

type ImmutableJson =
  | null
  | boolean
  | number
  | string
  | readonly ImmutableJson[]
  | { readonly [key: string]: ImmutableJson };
type Immutable<T> = [z.infer<ReturnType<typeof z.json>>] extends [T]
  ? ImmutableJson
  : T extends object
    ? { readonly [K in keyof T]: Immutable<T[K]> }
    : T;
export type FinmatchRoundState = Immutable<z.infer<typeof stateSchema>>;
export type FinmatchSavedSelection = Immutable<z.infer<typeof selectionSchema>>;
export type FinmatchRoundAction = z.infer<typeof actionSchema>;
export type FinmatchRoundInput = z.infer<typeof startSchema>;
export type FinmatchRoundTransition = {
  readonly state: FinmatchRoundState;
  readonly events: readonly {
    readonly type: "selection_saved";
    readonly selection: FinmatchSavedSelection;
  }[];
};

function freeze<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as Immutable<T>;
}

/** Literal JSON only: bounds are checked before Zod recursively parses JSON.
 * This also detaches caller objects without invoking getters or toJSON.
 */
function copyJson(value: unknown): unknown {
  return JSON.parse(canonicalCapabilityJson(value));
}

/** Callers supply the seed, using server entropy once per new production session.
 * Fisher-Yates with a 32-bit LCG is deterministic replay, not cryptographic randomness.
 * Never persist partial round state or No choices. On exit discard it; on return call
 * this again with a new session seed and options, not a previous state's progress.
 * Previously persisted Yes selections belong to the caller's existing storage.
 */
export function createFinmatchRound(input: unknown): FinmatchRoundState {
  const { seed, options } = startSchema.parse(copyJson(input));
  let randomState = seed;
  for (let index = options.length - 1; index > 0; index--) {
    randomState = (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
    const other = Math.floor((randomState / 0x1_0000_0000) * (index + 1));
    [options[index], options[other]] = [options[other]!, options[index]!];
  }
  return freeze({
    seed,
    options,
    currentIndex: 0,
    status: options.length ? "active" : "empty",
    notice: options.length ? null : emptyNotice,
    savedSelections: [],
  });
}

/** Pure forward-only transition. Persist only the emitted Yes event through the
 * caller's existing adapter; this function performs no I/O and offers no undo.
 * Timestamp is caller-supplied ISO 8601 with Z or an explicit timezone offset.
 */
export function chooseFinmatchCard(
  state: FinmatchRoundState,
  action: unknown,
): FinmatchRoundTransition {
  const current = stateSchema.parse(copyJson(state));
  const choice = actionSchema.parse(copyJson(action));
  if (current.status !== "active") throw new Error("There is no active FinMatch card.");
  const option = current.options[current.currentIndex]!;
  const selection =
    choice.choice === "yes"
      ? {
          timestamp: choice.timestamp,
          ticker: option.ticker,
          recommendation: option.recommendation,
        }
      : null;
  const currentIndex = current.currentIndex + 1;
  return freeze({
    state: {
      ...current,
      currentIndex,
      status: currentIndex === current.options.length ? "finished" : "active",
      savedSelections: selection
        ? [...current.savedSelections, selection]
        : current.savedSelections,
    },
    events: selection ? [{ type: "selection_saved", selection }] : [],
  });
}
