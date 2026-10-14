import { configuredEnvironment } from "./environment";
import { createTushareQuery, type TushareQuery } from "../apps/web/src/server/tushare";

const environment = configuredEnvironment();
const query = createTushareQuery({ token: environment.TUSHARE_TOKEN ?? "" });
const timestamp = new Date().toISOString();
const asOf = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const end = asOf.replaceAll("-", "");
const start = new Date(`${asOf}T00:00:00Z`);
start.setUTCDate(start.getUTCDate() - 89);
const recent = {
  ts_code: "600000.SH",
  start_date: start.toISOString().slice(0, 10).replaceAll("-", ""),
  end_date: end,
};
const requests: {
  endpoint: Parameters<TushareQuery>[0];
  params: Record<string, string>;
  fields: string;
}[] = [
  { endpoint: "daily", params: recent, fields: "ts_code,trade_date,open,high,low,close,pre_close" },
  { endpoint: "adj_factor", params: recent, fields: "ts_code,trade_date,adj_factor" },
  {
    endpoint: "income",
    params: {
      ts_code: "600000.SH",
      start_date: `${Number(asOf.slice(0, 4)) - 5}${end.slice(4)}`,
      end_date: end,
      report_type: "1",
    },
    fields:
      "ts_code,ann_date,f_ann_date,end_date,report_type,total_revenue,n_income,n_income_attr_p,update_flag",
  },
  {
    endpoint: "report_rc",
    params: recent,
    fields:
      "ts_code,org_name,author_name,report_date,report_title,quarter,rating,max_price,min_price",
  },
];
console.log(
  JSON.stringify({
    timestamp,
    as_of: asOf,
    company: "600000.SH",
    recent_window: { start: recent.start_date, end },
    families: 3,
  }),
);
for (const request of requests) {
  const result = await query(request.endpoint, request.params, request.fields);
  const completeness = Object.fromEntries(
    request.fields.split(",").map((field) => [
      field,
      {
        present: result.fields.includes(field),
        non_null: result.rows.filter(
          (row) => row[field] !== null && row[field] !== undefined && row[field] !== "",
        ).length,
        null: result.rows.filter((row) => row[field] === null).length,
      },
    ]),
  );
  console.log(
    JSON.stringify({
      endpoint: request.endpoint,
      status: result.status,
      retrieved_at: result.retrieved_at,
      rows: result.rows.length,
      completeness,
      limitations: result.limitations,
    }),
  );
}
