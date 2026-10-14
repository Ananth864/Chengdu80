import { createHash } from "node:crypto";
import { settings } from "./settings";

export type TushareRow = Record<string, string | number | null>;
export type TushareResult = {
  status:
    | "available"
    | "partial"
    | "no_results"
    | "missing_credentials"
    | "permission_denied"
    | "rate_limited"
    | "error";
  rows: TushareRow[];
  endpoint: string;
  retrieved_at: string;
  fields: string[];
  limitations: string[];
};
export type TushareQuery = (
  endpoint: "daily" | "adj_factor" | "income" | "report_rc",
  params: Record<string, string>,
  fields?: string,
) => Promise<TushareResult>;

const caps = { daily: 6000, adj_factor: 6000, income: 100, report_rc: 3000 };
const ttl = 15 * 60 * 1000;

export function createTushareQuery(options: {
  token?: string;
  fetch?: typeof fetch;
  now?: () => number;
  signal?: AbortSignal;
}): TushareQuery {
  const cache = new Map<string, { expires: number; result: TushareResult }>();
  const now = options.now ?? Date.now;
  return async (endpoint, input, requestedFields = "") => {
    const result: TushareResult = {
      status: "error",
      rows: [],
      endpoint,
      retrieved_at: new Date(now()).toISOString(),
      fields: [],
      limitations: [],
    };
    const fail = (status: TushareResult["status"], reason: string) => {
      result.status = result.rows.length ? "partial" : status;
      result.limitations.push(reason);
      result.retrieved_at = new Date(now()).toISOString();
      return result;
    };
    const params = { ...input };
    const fields = requestedFields ? requestedFields.split(",").map((s) => s.trim()) : [];
    const validFields = (value: unknown): value is string[] =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 200 &&
      value.every((field) => typeof field === "string" && /^[a-z][a-z0-9_]*$/.test(field)) &&
      new Set(value).size === value.length;
    const date = (value: string | undefined) => {
      if (!value || !/^\d{8}$/.test(value)) return NaN;
      const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      const time = Date.parse(iso);
      return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === iso
        ? time
        : NaN;
    };
    if (!Object.hasOwn(caps, endpoint)) return fail("error", "unsupported_endpoint");
    if (fields.length && !validFields(fields)) return fail("error", "invalid_requested_fields");
    const allowed = new Set(["ts_code", "start_date", "end_date"]);
    if (endpoint === "income") {
      for (const key of ["period", "ann_date", "f_ann_date", "report_type", "comp_type"])
        allowed.add(key);
      params.report_type ??= "1";
      if (!["1", "4", "5"].includes(params.report_type))
        return fail("error", "unsupported_statement_scope");
    } else if (endpoint === "report_rc") allowed.add("report_date");
    else allowed.add("trade_date");
    if (
      Object.entries(params).some(
        ([key, value]) => !allowed.has(key) || typeof value !== "string" || value.length > 32,
      ) ||
      !/^\d{6}\.SH$/.test(params.ts_code ?? "")
    )
      return fail("error", "single_sse_company_required_or_invalid_parameters");
    const point =
      params.trade_date ??
      params.report_date ??
      params.period ??
      params.ann_date ??
      params.f_ann_date;
    const start = date(params.start_date ?? point);
    const end = date(params.end_date ?? point);
    const last = new Date(start);
    last.setUTCFullYear(last.getUTCFullYear() + 5);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start > end ||
      end > last.getTime() ||
      (endpoint === "report_rc" && end - start > 89 * 86400000) ||
      Object.entries(params).some(
        ([key, value]) =>
          (key.endsWith("date") || key === "period") && !Number.isFinite(date(value)),
      )
    )
      return fail("error", "valid_bounded_dates_required");
    const token = (options.token ?? (await settings()).TUSHARE_TOKEN)?.trim();
    if (!token) return fail("missing_credentials", "credentials_not_configured");
    if (options.signal?.aborted) return fail("error", "request_aborted");
    const key = JSON.stringify([
      createHash("sha256").update(token).digest("hex"),
      endpoint,
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
      fields,
    ]);
    for (const [entry, value] of cache) if (value.expires <= now()) cache.delete(entry);
    const cached = cache.get(key);
    if (cached) return structuredClone(cached.result);
    const deadline = AbortSignal.timeout(30_000);
    const seen = new Set<string>();
    const limit = caps[endpoint];
    let offset = 0;
    let requests = 0;
    let retried = false;
    while (requests < 20) {
      const signal = AbortSignal.any([
        deadline,
        AbortSignal.timeout(10_000),
        ...(options.signal ? [options.signal] : []),
      ]);
      try {
        requests++;
        signal.throwIfAborted();
        const response = await (options.fetch ?? fetch)("https://api.tushare.pro", {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_name: endpoint,
            token,
            params: endpoint === "report_rc" ? { ...params, offset, limit } : params,
            fields: fields.join(","),
          }),
          signal,
        });
        if (response.status === 429) return fail("rate_limited", "provider_rate_limited");
        if (response.status === 401 || response.status === 403)
          return fail("permission_denied", "provider_permission_denied");
        if ([502, 503, 504].includes(response.status) && !retried) {
          retried = true;
          await response.body?.cancel();
          continue;
        }
        if (!response.ok || response.redirected) return fail("error", "provider_http_failure");
        const payload = await response.json();
        signal.throwIfAborted();
        if (!payload || typeof payload.code !== "number")
          return fail("error", "malformed_provider_payload");
        if (payload.code !== 0) {
          // Inspect only for classification. Never return provider messages or thrown errors.
          const message = typeof payload.msg === "string" ? payload.msg : "";
          if (
            /\u6bcf\u5206\u949f|\u6bcf\u5c0f\u65f6|\u6bcf\u5929|\u9891\u7387|\u9891\u6b21|\u6b21\u6570|rate.?limit|too many/i.test(
              message,
            )
          )
            return fail("rate_limited", "provider_rate_limited");
          if (
            Math.abs(payload.code) === 2002 ||
            /\u6743\u9650|\u79ef\u5206|\u65e0\u6743|permission|forbidden|unauthorized|token/i.test(
              message,
            )
          )
            return fail("permission_denied", "provider_permission_denied");
          return fail("error", "provider_rejected_request");
        }
        const data = payload.data;
        if (
          !data ||
          !validFields(data.fields) ||
          !Array.isArray(data.items) ||
          data.items.length > limit ||
          data.items.some(
            (row: unknown) =>
              !Array.isArray(row) ||
              row.length !== data.fields.length ||
              row.some(
                (cell: unknown) =>
                  cell !== null &&
                  typeof cell !== "string" &&
                  !(typeof cell === "number" && Number.isFinite(cell)),
              ),
          )
        )
          return fail("error", "malformed_provider_table");
        const pageFields: string[] = data.fields;
        if (result.fields.length && JSON.stringify(result.fields) !== JSON.stringify(pageFields))
          return fail("error", "pagination_fields_changed");
        result.fields = [...pageFields];
        if (fields.some((field) => !pageFields.includes(field)))
          return fail("partial", "requested_fields_missing");
        let added = 0;
        for (const cells of data.items as (string | number | null)[][]) {
          const identity = JSON.stringify(cells);
          if (endpoint === "report_rc" && seen.has(identity)) continue;
          seen.add(identity);
          result.rows.push(Object.fromEntries(pageFields.map((field, i) => [field, cells[i]!])));
          added++;
        }
        if (endpoint === "report_rc" && data.items.length > 0 && added === 0)
          return fail("partial", "pagination_cycle_detected");
        if (data.items.length < limit) {
          result.status = result.rows.length ? "available" : "no_results";
          result.retrieved_at = new Date(now()).toISOString();
          if (result.rows.length <= 10_000) {
            if (cache.size >= 64) cache.delete(cache.keys().next().value!);
            cache.set(key, { expires: now() + ttl, result: structuredClone(result) });
          }
          return result;
        }
        if (endpoint !== "report_rc") return fail("partial", "provider_row_cap_reached");
        offset += limit;
      } catch {
        return fail(
          "error",
          signal.aborted ? "request_aborted_or_timed_out" : "provider_transport_or_json_failure",
        );
      }
    }
    return fail("partial", "request_budget_exhausted");
  };
}

export const queryTushare: TushareQuery = createTushareQuery({});
