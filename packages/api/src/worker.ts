import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as RpcServer from "effect/rpc/RpcServer";

import {
  ApiHandlers,
  // @if auth
  RequireViewerLive,
  // @endif
} from "./app";
import { Hyperdrive } from "./database";
import { Db } from "./db";
import { ApiRpcs } from "./rpc";
import { relations } from "./schema";

// Effect-native API Worker, and the only Cloudflare-aware runtime code: it connects
// through Hyperdrive, provides that as `Db` to the handlers in `./app`, and serves the
// `ApiRpcs` contract over HTTP. It has no public URL: the web app forwards `/api/rpc`
// to it over the `API` service binding (see `apps/web/src/routes/api/rpc.tsx`).
export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const conn = yield* Cloudflare.Hyperdrive.Connect(Hyperdrive);
    const db = yield* Drizzle.Postgres(conn.connectionString, { relations });

    const fetch = yield* RpcServer.toHttpEffect(ApiRpcs).pipe(
      Effect.provide(
        Layer.mergeAll(
          ApiHandlers.pipe(Layer.provide(Layer.succeed(Db, db))),
          RpcSerialization.layerJson,
          // @if auth
          RequireViewerLive,
          // @endif
        ),
      ),
    );
    return { fetch };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding)),
) {}
