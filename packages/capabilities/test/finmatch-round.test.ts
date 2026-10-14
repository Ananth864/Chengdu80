import { describe, expect, test } from "bun:test";
import { chooseFinmatchCard, createFinmatchRound } from "../src/finmatch-round";

const timestamp = "2026-10-14T12:34:56.000Z";
const option = (index = 0) => ({
  ticker: `TEST${index}`,
  assetType: "stocks",
  recommendation: {
    kind: "snapshot" as const,
    snapshot: { fixture: true, basis: [index] },
    version: "fixture-v1",
  },
  metrics: { opaque: [index, "supplied", true, null] },
});
const input = (count = 5, seed = 42) => ({
  seed,
  options: Array.from({ length: count }, (_, index) => option(index)),
});

describe("FinMatch transient demo round", () => {
  test("explicit seeds replay the same shuffle without mutating the supplied pool", () => {
    const supplied = input();
    const original = structuredClone(supplied);
    const state = createFinmatchRound(supplied);
    expect(state).toEqual(createFinmatchRound(supplied));
    expect(state.options.map((card) => card.ticker)).toEqual([
      "TEST2",
      "TEST3",
      "TEST4",
      "TEST0",
      "TEST1",
    ]);
    expect(supplied).toEqual(original);
    expect(createFinmatchRound(input(5, 99)).options).not.toEqual(state.options);
    expect(createFinmatchRound(input(5, 0)).options).toHaveLength(5);
    expect(createFinmatchRound(input(5, 0xffff_ffff)).options).toHaveLength(5);
  });

  test("zero through five options all display once and end with no later round", () => {
    for (let count = 0; count <= 5; count++) {
      let state = createFinmatchRound(input(count));
      const displayed: string[] = [];
      while (state.status === "active") {
        displayed.push(state.options[state.currentIndex]!.ticker);
        const previous = state;
        const result = chooseFinmatchCard(state, { choice: "no" });
        expect(result.events).toEqual([]);
        expect(result.state.savedSelections).toEqual([]);
        expect(previous.currentIndex).toBe(displayed.length - 1);
        state = result.state;
      }
      expect(displayed).toHaveLength(count);
      expect(new Set(displayed).size).toBe(count);
      expect(state.currentIndex).toBe(count);
      expect(state.status).toBe(count ? "finished" : "empty");
      expect(() => chooseFinmatchCard(state, { choice: "no" })).toThrow();
      expect(() => chooseFinmatchCard(state, { choice: "yes", timestamp })).toThrow();
    }
    expect(createFinmatchRound(input(0)).notice).toContain("come back later");
    expect(createFinmatchRound(input(1)).notice).toBeNull();
    expect(() => createFinmatchRound(input(6))).toThrow("at most five");
  });

  test("Yes saves timestamp, original ticker and immutable recommendation basis only", () => {
    const supplied = input(1);
    const state = createFinmatchRound(supplied);
    supplied.options[0]!.ticker = "CHANGED";
    supplied.options[0]!.recommendation.snapshot.basis[0] = 999;
    supplied.options[0]!.recommendation.version = "changed";
    supplied.options[0]!.metrics.opaque[0] = 999;
    const action = { choice: "yes", timestamp };
    const result = chooseFinmatchCard(state, action);
    action.timestamp = "changed";
    const saved = result.state.savedSelections[0]!;
    expect(saved).toEqual({
      timestamp,
      ticker: "TEST0",
      recommendation: option().recommendation,
    });
    expect(saved).not.toHaveProperty("metrics");
    expect(result.events).toEqual([{ type: "selection_saved", selection: saved }]);
    expect(state.savedSelections).toEqual([]);
    expect(state.options[0]!.metrics).toEqual(option().metrics);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(saved.recommendation)).toBe(true);
    expect(Object.isFrozen(state.options)).toBe(true);
    if (saved.recommendation.kind !== "snapshot") throw new Error("Expected snapshot.");
    expect(Object.isFrozen(saved.recommendation.snapshot)).toBe(true);
    expect(() => Reflect.set(saved.recommendation, "version", "changed")).not.toThrow();
    expect(saved.recommendation.version).toBe("fixture-v1");
  });

  test("stable references preserve optional versions without inventing one", () => {
    for (const recommendation of [
      { kind: "reference", reference: "fixture:stable-id" },
      { kind: "reference", reference: "fixture:stable-id", version: "v2" },
      { kind: "snapshot", snapshot: { fixture: true } },
    ] as const) {
      const state = createFinmatchRound({ seed: 1, options: [{ ...option(), recommendation }] });
      expect(
        chooseFinmatchCard(state, { choice: "yes", timestamp }).state.savedSelections[0]!
          .recommendation,
      ).toEqual(recommendation);
    }
  });

  test("No never removes a previous Yes, records no selection, and cannot be undone", () => {
    const start = createFinmatchRound(input(3));
    const yes = chooseFinmatchCard(start, { choice: "yes", timestamp });
    const no = chooseFinmatchCard(yes.state, { choice: "no" });
    expect(no.events).toEqual([]);
    expect(no.state.savedSelections).toEqual(yes.state.savedSelections);
    expect(no.state.currentIndex).toBe(2);
    for (const choice of ["undo", "back", "save", "learn_more", "YES", null])
      expect(() => chooseFinmatchCard(no.state, { choice })).toThrow();
    expect(() => chooseFinmatchCard(no.state, { choice: "no", undo: true })).toThrow();
  });

  test("exit discards transient progress; restart begins anew, not from saved history", () => {
    const supplied = input(3);
    const start = createFinmatchRound(supplied);
    const partial = chooseFinmatchCard(start, { choice: "yes", timestamp });
    const replayed = chooseFinmatchCard(
      JSON.parse(JSON.stringify(start)),
      JSON.parse(JSON.stringify({ choice: "yes", timestamp })),
    );
    expect(replayed).toEqual(partial);
    expect(createFinmatchRound(supplied)).toEqual(start);
    const returned = createFinmatchRound(input(3, 123));
    expect(returned.currentIndex).toBe(0);
    expect(returned.savedSelections).toEqual([]);
    expect(returned.options).toHaveLength(3);
    expect(partial.events).toHaveLength(1); // Already emitted Yes remains caller-owned.
    expect(() => createFinmatchRound({ ...supplied, previousState: partial.state })).toThrow();
    expect(() => createFinmatchRound(partial.state)).toThrow();
  });

  test("requires explicit valid seeds, tickers, stocks and identifiable provenance", () => {
    for (const seed of [undefined, null, "42", -1, 1.5, 0x1_0000_0000, NaN, Infinity])
      expect(() => createFinmatchRound({ ...input(1), seed })).toThrow();
    for (const ticker of ["", " ", " bad", "BAD TICKER", "X".repeat(33), null, 123])
      expect(() => createFinmatchRound({ seed: 1, options: [{ ...option(), ticker }] })).toThrow();
    for (const assetType of ["stock", "bonds", "funds", undefined])
      expect(() =>
        createFinmatchRound({ seed: 1, options: [{ ...option(), assetType }] }),
      ).toThrow();
    for (const recommendation of [
      undefined,
      {},
      { kind: "reference", reference: " " },
      { kind: "snapshot" },
      { kind: "snapshot", snapshot: null },
      { kind: "reference", reference: "id", version: "" },
    ])
      expect(() =>
        createFinmatchRound({ seed: 1, options: [{ ...option(), recommendation }] }),
      ).toThrow();
    expect(() => createFinmatchRound({ seed: 1, options: [option(), option()] })).toThrow();
    expect(
      createFinmatchRound({ seed: 1, options: [{ ...option(), ticker: "600000" }] }).options[0]!
        .ticker,
    ).toBe("600000");
  });

  test("rejects missing or non-literal metrics and bounded JSON overflow, not guessed freshness", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const sparse = [0, 1];
    Reflect.deleteProperty(sparse, "0");
    let deep: unknown = {};
    for (let index = 0; index < 70; index++) deep = { nested: deep };
    for (const metrics of [
      undefined,
      null,
      { value: undefined },
      { value: NaN },
      { value: () => 1 },
      new Date(timestamp),
      { toJSON: () => ({ value: 1 }) },
      {
        get value() {
          throw new Error("Getter must not run.");
        },
      },
      sparse,
      "x".repeat(16_384),
      cyclic,
      deep,
    ])
      expect(() => createFinmatchRound({ seed: 1, options: [{ ...option(), metrics }] })).toThrow();
    const missing = {
      ticker: "TEST",
      assetType: "stocks",
      recommendation: option().recommendation,
    };
    expect(() => createFinmatchRound({ seed: 1, options: [missing] })).toThrow();
    for (const metrics of [{}, [], "opaque", 0, false, { stale: true, asOf: "fixture" }])
      expect<unknown>(metrics).toEqual(
        createFinmatchRound({ seed: 1, options: [{ ...option(), metrics }] }).options[0]!.metrics,
      );
    expect(() =>
      createFinmatchRound({
        seed: 1,
        options: [
          {
            ...option(),
            recommendation: {
              kind: "snapshot",
              snapshot: "x".repeat(16_384),
            },
          },
        ],
      }),
    ).toThrow();
  });

  test("Yes requires a real ISO timestamp; No has no timestamp or arbitrary action fields", () => {
    const state = createFinmatchRound(input(1));
    for (const value of [
      undefined,
      null,
      123,
      "yesterday",
      "2026-02-30T12:00:00Z",
      "2026-10-14",
      "2026-10-14T12:00:00",
      "2026-10-14T25:00:00Z",
    ])
      expect(() => chooseFinmatchCard(state, { choice: "yes", timestamp: value })).toThrow();
    for (const action of [
      undefined,
      null,
      {},
      { choice: "no", timestamp },
      { choice: "yes", timestamp, ticker: "OTHER" },
    ])
      expect(() => chooseFinmatchCard(state, action)).toThrow();
    expect(
      chooseFinmatchCard(state, { choice: "yes", timestamp: "2026-10-14T12:00:00+08:00" })
        .events[0]!.selection.timestamp,
    ).toBe("2026-10-14T12:00:00+08:00");
    expect(() => chooseFinmatchCard({ ...state, currentIndex: -1 }, { choice: "no" })).toThrow();
    expect(() => chooseFinmatchCard({ ...state, status: "finished" }, { choice: "no" })).toThrow();
  });
});
