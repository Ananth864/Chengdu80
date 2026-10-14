import assert from "node:assert/strict";
import { createTushareQuery } from "../apps/web/src/server/tushare";

const params = { ts_code: "600000.SH", start_date: "20260701", end_date: "20260928" };
const table = (fields: unknown = ["close"], items: unknown = [[12]]) =>
  Response.json({ code: 0, data: { fields, items } });
const fake = (handler: (url: string, init: RequestInit) => Response | Promise<Response>) =>
  ((url: string, init: RequestInit) => handler(url, init)) as unknown as typeof fetch;
let checks = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks++;
  console.log(`PASS fixture: ${name}`);
}

await check(
  "fixed HTTPS, blocked redirects, field selection, null and zero preservation",
  async () => {
    const query = createTushareQuery({
      token: "fixture",
      fetch: fake((url, init) => {
        assert.equal(url, "https://api.tushare.pro");
        assert.equal(init.redirect, "error");
        assert.equal(init.method, "POST");
        assert.equal(typeof init.body, "string");
        assert.equal(JSON.parse(init.body as string).fields, "close,pre_close");
        assert(init.signal instanceof AbortSignal);
        return table(["close", "pre_close"], [[null, 0]]);
      }),
    });
    const result = await query("daily", params, "close,pre_close");
    assert.equal(result.status, "available");
    assert.deepEqual(result.rows, [{ close: null, pre_close: 0 }]);
  },
);

await check(
  "missing credentials, invalid bounds, unsupported parameters and statement scopes",
  async () => {
    const query = createTushareQuery({
      token: "",
      fetch: fake(() => {
        throw new Error("must not fetch");
      }),
    });
    assert.equal((await query("daily", params)).status, "missing_credentials");
    for (const input of [
      { ...params, ts_code: "600000.SH,600001.SH" },
      { ...params, start_date: "20200230" },
      { ...params, start_date: "20200101" },
      { ...params, offset: "0" },
    ])
      assert.equal((await query("daily", input)).status, "error");
    assert.equal((await query("income", { ...params, report_type: "6" })).status, "error");
    assert.equal((await query("report_rc", { ...params, start_date: "20260101" })).status, "error");
    assert.equal((await query("daily", params, "close,close")).status, "error");
  },
);

await check(
  "malformed tables are not empty results; requested fields are validated even for empty pages",
  async () => {
    const responses = [
      table(["close", "close"], [[1, 2]]),
      table([7], [[1]]),
      table([], []),
      table(["close"], [[1, 2]]),
      table(["close"], [[]]),
      table(["close"], [[true]]),
      table(["close"], [[{}]]),
      table(["close"], [[[]]]),
      Response.json({ code: 0, data: null }),
      Response.json({ data: { fields: ["close"], items: [] } }),
    ];
    for (const response of responses) {
      const query = createTushareQuery({ token: "fixture", fetch: fake(() => response) });
      assert.equal((await query("daily", params, "close")).status, "error");
    }
    const empty = createTushareQuery({ token: "fixture", fetch: fake(() => table(["close"], [])) });
    assert.equal((await empty("daily", params, "close")).status, "no_results");
    assert.equal((await empty("daily", params, "high")).status, "partial");
  },
);

await check(
  "provider permissions, rate limits and failures never expose echoed secrets",
  async () => {
    for (const [code, msg, status] of [
      [-2002, "fixture-secret", "permission_denied"],
      [2002, "fixture-secret", "permission_denied"],
      [-1, "\u79ef\u5206\u4e0d\u8db3 fixture-secret", "permission_denied"],
      [-1, "\u6ca1\u6709\u6743\u9650 fixture-secret", "permission_denied"],
      [-2002, "\u6bcf\u5206\u949f\u8bf7\u6c42\u6b21\u6570 fixture-secret", "rate_limited"],
      [-1, "fixture-secret", "error"],
    ] as const) {
      const query = createTushareQuery({
        token: "fixture-secret",
        fetch: fake(() => Response.json({ code, msg })),
      });
      const result = await query("daily", params);
      assert.equal(result.status, status);
      assert(!JSON.stringify(result).includes("fixture-secret"));
    }
    for (const [http, status] of [
      [429, "rate_limited"],
      [403, "permission_denied"],
      [302, "error"],
    ] as const) {
      const query = createTushareQuery({
        token: "fixture",
        fetch: fake(() => new Response("fixture-secret", { status: http })),
      });
      assert.equal((await query("daily", params)).status, status);
    }
    const redirect = createTushareQuery({
      token: "fixture",
      fetch: fake(() => {
        throw new TypeError("redirect fixture-secret");
      }),
    });
    const result = await redirect("daily", params);
    assert.equal(result.status, "error");
    assert(!JSON.stringify(result).includes("fixture-secret"));
  },
);

await check(
  "15-minute cache includes fields and runtime token, clones records and expires",
  async () => {
    let calls = 0;
    let clock = Date.parse("2026-10-15T00:00:00Z");
    const previous = process.env.TUSHARE_TOKEN;
    try {
      process.env.TUSHARE_TOKEN = "fixture-one";
      const query = createTushareQuery({
        now: () => clock,
        fetch: fake((_url, init) => {
          calls++;
          const fields = JSON.parse(init.body as string).fields.split(",");
          return table(fields, [fields.map(() => calls)]);
        }),
      });
      const first = await query("daily", params, "close");
      first.rows[0]!.close = 999;
      first.fields.push("mutated");
      assert.deepEqual((await query("daily", params, "close")).fields, ["close"]);
      assert.equal((await query("daily", params, "close")).rows[0]!.close, 1);
      assert.equal(calls, 1);
      await query("daily", params, "high");
      process.env.TUSHARE_TOKEN = "fixture-two";
      await query("daily", params, "close");
      assert.equal(calls, 3);
      clock += 15 * 60 * 1000;
      await query("daily", params, "close");
      assert.equal(calls, 4);
      for (let i = 0; i < 65; i++) await query("daily", params, `field_${i}`);
      await query("daily", params, "close");
      assert.equal(calls, 70);
    } finally {
      if (previous === undefined) delete process.env.TUSHARE_TOKEN;
      else process.env.TUSHARE_TOKEN = previous;
    }
  },
);

await check("errors and missing-field partials do not cache; same-key recovery does", async () => {
  const secret = "fixture-secret-do-not-echo";
  const cases = [
    {
      status: "permission_denied",
      reason: "provider_permission_denied",
      response: () => Response.json({ code: -2002, msg: secret, data: { token: secret } }),
    },
    {
      status: "rate_limited",
      reason: "provider_rate_limited",
      response: () => new Response(secret, { status: 429, statusText: secret }),
    },
    {
      status: "permission_denied",
      reason: "provider_permission_denied",
      response: () => new Response(secret, { status: 401, statusText: secret }),
    },
    {
      status: "error",
      reason: "provider_http_failure",
      response: () => new Response(secret, { status: 500, statusText: secret }),
    },
    {
      status: "error",
      reason: "provider_rejected_request",
      response: () => Response.json({ code: -1, msg: secret }),
    },
    {
      status: "error",
      reason: "malformed_provider_payload",
      response: () => Response.json({ code: secret, msg: secret }),
    },
    {
      status: "error",
      reason: "malformed_provider_payload",
      response: () => Response.json({ code: "-2002", msg: secret }),
    },
    {
      status: "error",
      reason: "malformed_provider_payload",
      response: () =>
        Response.json({ code: "0", msg: secret, data: { fields: ["close"], items: [[secret]] } }),
    },
    {
      status: "error",
      reason: "malformed_provider_table",
      response: () => table(["close"], [[{ token: secret }]]),
    },
    {
      status: "error",
      reason: "provider_transport_or_json_failure",
      response: () => new Response(secret),
    },
    {
      status: "error",
      reason: "provider_transport_or_json_failure",
      response: () => {
        throw new Error(secret);
      },
    },
    { status: "partial", reason: "requested_fields_missing", response: () => table(["high"], []) },
    {
      status: "error",
      reason: "provider_http_failure",
      attempts: 2,
      response: () => new Response(null, { status: 503, statusText: secret }),
    },
  ] as const;
  for (const fixture of cases) {
    let recovering = false;
    let calls = 0;
    const clock = Date.parse("2026-10-15T00:00:00Z");
    const query = createTushareQuery({
      token: secret,
      now: () => clock,
      fetch: fake(() => {
        calls++;
        return recovering ? table() : fixture.response();
      }),
    });
    const failure = await query("daily", params, "close");
    assert.deepEqual(failure, {
      status: fixture.status,
      endpoint: "daily",
      retrieved_at: new Date(clock).toISOString(),
      fields: fixture.status === "partial" ? ["high"] : [],
      rows: [],
      limitations: [fixture.reason],
    });
    assert(!JSON.stringify(failure).includes(secret));
    const failedCalls = "attempts" in fixture ? fixture.attempts : 1;
    assert.equal(calls, failedCalls);
    recovering = true;
    const success = await query("daily", params, "close");
    assert.equal(success.status, "available");
    assert.deepEqual(success.rows, [{ close: 12 }]);
    assert.deepEqual(success.limitations, []);
    assert.equal(calls, failedCalls + 1);
    assert.deepEqual(await query("daily", params, "close"), success);
    assert.equal(calls, failedCalls + 1);
  }
});

await check("documented report pagination sends offset/limit and stops on short page", async () => {
  const offsets: number[] = [];
  const query = createTushareQuery({
    token: "fixture",
    fetch: fake((_url, init) => {
      const body = JSON.parse(init.body as string);
      offsets.push(body.params.offset);
      assert.equal(body.params.limit, 3000);
      assert.equal(body.fields, "report_title");
      return table(
        ["report_title"],
        body.params.offset === 0
          ? Array.from({ length: 3000 }, (_, i) => [`report-${i}`])
          : [["last"]],
      );
    }),
  });
  const result = await query("report_rc", params, "report_title");
  assert.equal(result.status, "available");
  assert.equal(result.rows.length, 3001);
  assert.deepEqual(offsets, [0, 3000]);
});

await check("pagination cycles, saturation and later failures retain partial rows", async () => {
  for (const mode of ["cycle", "budget", "failure", "fields"] as const) {
    let calls = 0;
    let recovering = false;
    const query = createTushareQuery({
      token: "fixture",
      fetch: fake((_url, init) => {
        calls++;
        if (recovering) {
          assert.equal(JSON.parse(init.body as string).params.offset, 0);
          return table(["report_title"], [["recovered"]]);
        }
        if (mode === "failure" && calls === 2)
          return Response.json({ code: -2002, msg: "fixture-secret" });
        if (mode === "fields" && calls === 2) return table(["different"], []);
        return table(
          ["report_title"],
          Array.from({ length: 3000 }, (_, i) => [`report-${mode === "budget" ? calls : 0}-${i}`]),
        );
      }),
    });
    const result = await query("report_rc", params, "report_title");
    assert.equal(result.status, "partial");
    assert.equal(calls, mode === "budget" ? 20 : 2);
    assert.equal(result.rows.length, mode === "budget" ? 60000 : 3000);
    assert.deepEqual(result.limitations, [
      {
        cycle: "pagination_cycle_detected",
        budget: "request_budget_exhausted",
        failure: "provider_permission_denied",
        fields: "pagination_fields_changed",
      }[mode],
    ]);
    const failedCalls = calls;
    recovering = true;
    const success = await query("report_rc", params, "report_title");
    assert.equal(success.status, "available");
    assert.deepEqual(success.rows, [{ report_title: "recovered" }]);
    assert.deepEqual(success.limitations, []);
    assert.equal(calls, failedCalls + 1);
    assert.deepEqual(await query("report_rc", params, "report_title"), success);
    assert.equal(calls, failedCalls + 1);
  }
  for (const endpoint of ["daily", "adj_factor", "income"] as const) {
    let calls = 0;
    const query = createTushareQuery({
      token: "fixture",
      fetch: fake((_url, init) => {
        calls++;
        const body = JSON.parse(init.body as string);
        assert.equal(body.params.offset, undefined);
        if (endpoint === "income") assert.equal(body.params.report_type, "1");
        if (calls > 1) return table();
        return table(
          ["close"],
          Array.from({ length: endpoint === "income" ? 100 : 6000 }, () => [12]),
        );
      }),
    });
    const partial = await query(endpoint, params, "close");
    assert.equal(partial.status, "partial");
    assert.deepEqual(partial.limitations, ["provider_row_cap_reached"]);
    const success = await query(endpoint, params, "close");
    assert.equal(success.status, "available");
    assert.deepEqual(success.rows, [{ close: 12 }]);
    assert.deepEqual(success.limitations, []);
    assert.equal(calls, 2);
    assert.deepEqual(await query(endpoint, params, "close"), success);
    assert.equal(calls, 2);
  }
});

await check("only one safe transient HTTP retry; aborted requests never fetch", async () => {
  let calls = 0;
  const query = createTushareQuery({
    token: "fixture",
    fetch: fake(() => (++calls === 1 ? new Response(null, { status: 503 }) : table())),
  });
  assert.equal((await query("daily", params)).status, "available");
  assert.equal(calls, 2);
  const aborted = createTushareQuery({
    token: "fixture",
    signal: AbortSignal.abort(),
    fetch: fake(() => {
      throw new Error("must not fetch");
    }),
  });
  assert.equal((await aborted("daily", params)).status, "error");
});

await check("real request timeout aborts a stalled transport with sanitized output", async () => {
  let calls = 0;
  const query = createTushareQuery({
    token: "fixture-secret",
    fetch: fake((_url, init) => {
      calls++;
      if (calls > 1) return table();
      return new Promise((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(new Error("fixture-secret")), {
          once: true,
        });
      });
    }),
  });
  const result = await query("daily", params);
  assert.equal(result.status, "error");
  assert.deepEqual(result.limitations, ["request_aborted_or_timed_out"]);
  assert(!JSON.stringify(result).includes("fixture-secret"));
  const success = await query("daily", params);
  assert.equal(success.status, "available");
  assert.deepEqual(success.limitations, []);
  assert.equal(calls, 2);
  assert.deepEqual(await query("daily", params), success);
  assert.equal(calls, 2);
});

console.log(`PASS ${checks} Tushare transport fixture groups (not live observations)`);
