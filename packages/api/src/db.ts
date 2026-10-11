import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
import * as Context from "effect/Context";

import type { relations } from "./schema";

// The database app logic depends on. App code yields `Db` and never touches the
// platform; `worker.ts` provides the Hyperdrive-backed implementation.
export class Db extends Context.Service<Db, EffectPgDatabase<typeof relations>>()("Db") {}
