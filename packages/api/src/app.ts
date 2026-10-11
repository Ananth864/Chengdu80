import { sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

import { Db } from "./db";

// App logic. Knows nothing about Cloudflare: it needs a `Db`, and the worker plugs one in.
export const health = Effect.fn("health")(function* () {
  const db = yield* Db;
  yield* db.execute(sql`select 1`);
  return "ok" as const;
});
