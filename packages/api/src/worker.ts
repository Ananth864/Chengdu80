import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle/Postgres";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiScalar from "effect/http-api/HttpApiScalar";
import * as Layer from "effect/Layer";

import {
  ApiHandlers,
  // @if auth
  RequireViewerLive,
  // @endif
} from "./app";
import { Api } from "./contract";
import { Hyperdrive } from "./database";
import { Db } from "./db";
import { relations } from "./schema";

// Effect-native API Worker, and the only Cloudflare-aware runtime code: it connects
// through Hyperdrive, provides that as `Db` to the handlers in `./app`, and serves the
// `Api` contract plus its OpenAPI document and docs page. It has no public URL: the web
// app forwards `/api/v1/*` to it over the `API` service binding (see
// `apps/web/src/integrations/api.server.ts`).
export default class ApiWorker extends Cloudflare.Worker<ApiWorker>()(
  "Api",
  { main: import.meta.url, workersDev: false },
  Effect.gen(function* () {
    const conn = yield* Cloudflare.Hyperdrive.Connect(Hyperdrive);
    const db = yield* Drizzle.Postgres(conn.connectionString, { relations });

    const fetch = yield* HttpRouter.toHttpEffect(
      Layer.mergeAll(
        HttpApiBuilder.layer(Api, { openapiPath: "/api/v1/openapi.json" }),
        HttpApiScalar.layerCdn(Api, { path: "/api/v1/docs" }),
      ).pipe(
        Layer.provide(ApiHandlers),
        Layer.provide([
          Layer.succeed(Db, db),
          // @if auth
          RequireViewerLive,
          // @endif
        ]),
        Layer.provide(HttpServer.layerServices),
      ),
    );
    return { fetch };
  }).pipe(Effect.provide(Cloudflare.Hyperdrive.ConnectBinding)),
) {}
