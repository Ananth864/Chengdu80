import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import * as Effect from "effect/Effect";

import { health } from "./app";
import { Hyperdrive } from "./database";
import { Db } from "./db";
import { relations } from "./schema";

// Effect-native API Worker, and the only Cloudflare-aware runtime code: it connects
// through Hyperdrive and provides that as `Db` to the app logic in `./app`.
// It has no public URL: the web app calls its methods over a service binding
// (see `apps/web/src/components/db-status.tsx`). Every non-`fetch` method returning
// an Effect is callable over RPC.
export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const conn = yield* Cloudflare.Hyperdrive.Connect(Hyperdrive);
    const db = yield* Drizzle.Postgres(conn.connectionString, { relations });
    const provideDb = Effect.provideService(Db, db);

    return {
      health: () => health().pipe(provideDb, Effect.orDie),
    };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding)),
) {}
