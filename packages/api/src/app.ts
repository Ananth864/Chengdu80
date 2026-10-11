import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
// @if auth
import * as Layer from "effect/Layer";
// @endif

import { Db } from "./db";
import {
  ApiRpcs,
  // @if auth
  CurrentViewer,
  RequireViewer,
  Unauthorized,
  Viewer,
  // @endif
  DatabaseUnavailable,
  User,
  UserNotFound,
  // @if auth
  viewerHeader,
  // @endif
} from "./rpc";
import { Users } from "./schema";

// App logic: implements the `ApiRpcs` contract. Knows nothing about Cloudflare; it
// needs a `Db`, and `worker.ts` plugs one in. Driver errors become `DatabaseUnavailable`
// so clients only ever see contract errors.
export const ApiHandlers = ApiRpcs.toLayer(
  Effect.gen(function* () {
    const db = yield* Db;
    const unavailable = Effect.mapError(() => new DatabaseUnavailable());

    return {
      Health: () => db.execute(sql`select 1`).pipe(unavailable, Effect.as("ok" as const)),
      GetUser: ({ id }) =>
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
      // @if auth
      Me: () =>
        Effect.gen(function* () {
          return yield* CurrentViewer;
        }),
      // @endif
    };
  }),
);
// @if auth

export const RequireViewerLive = Layer.succeed(RequireViewer)((effect, { headers }) => {
  const id = headers[viewerHeader];
  return id
    ? Effect.provideService(effect, CurrentViewer, new Viewer({ id }))
    : Effect.fail(new Unauthorized());
});
// @endif
