import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
// @if auth
import * as HttpServerRequest from "effect/http/HttpServerRequest";
// @endif
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
// @if auth
import * as Layer from "effect/Layer";
// @endif

import {
  Api,
  // @if auth
  CurrentViewer,
  RequireViewer,
  Unauthorized,
  Viewer,
  viewerHeader,
  // @endif
  DatabaseUnavailable,
  User,
  UserNotFound,
} from "./contract";
import { Db } from "./db";
import { Users } from "./schema";

// App logic: implements the `Api` contract. Knows nothing about Cloudflare; it needs a
// `Db`, and `worker.ts` plugs one in. Driver errors become `DatabaseUnavailable` so
// clients only ever see contract errors.
export const ApiHandlers = HttpApiBuilder.group(
  Api,
  "api",
  Effect.fn(function* (handlers) {
    const db = yield* Db;
    const unavailable = Effect.mapError(() => new DatabaseUnavailable());

    return (
      handlers
        .handle("health", () =>
          db.execute(sql`select 1`).pipe(unavailable, Effect.as("ok" as const)),
        )
        .handle("getUser", ({ params: { id } }) =>
          db
            .select()
            .from(Users)
            .where(eq(Users.id, id))
            .pipe(
              unavailable,
              Effect.flatMap(([row]) =>
                row ? Effect.succeed(new User(row)) : Effect.fail(new UserNotFound({ id })),
              ),
            ),
        )
        // @if auth
        .handle("me", () =>
          Effect.gen(function* () {
            return yield* CurrentViewer;
          }),
        )
      // @endif
    );
  }),
);
// @if auth

// Reads the viewer header (see `viewerHeader`) for endpoints that use `RequireViewer`.
export const RequireViewerLive = Layer.succeed(RequireViewer)((httpEffect) =>
  Effect.gen(function* () {
    const { headers } = yield* HttpServerRequest.HttpServerRequest;
    const id = headers[viewerHeader];
    if (!id) return yield* new Unauthorized();
    return yield* Effect.provideService(httpEffect, CurrentViewer, new Viewer({ id }));
  }),
);
// @endif
