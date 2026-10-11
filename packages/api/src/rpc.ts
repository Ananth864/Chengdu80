// @if auth
import * as Context from "effect/Context";
// @endif
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
// @if auth
import * as RpcMiddleware from "effect/rpc/RpcMiddleware";
// @endif
import * as Schema from "effect/Schema";

// The API contract, shared by the Worker (`./app.ts` implements it) and the web client
// (`apps/web/src/integrations/api.ts` calls it). Imports only `effect`, so it is safe
// to bundle for the browser. Every success, payload, and error is a schema: values are
// validated on both sides, and errors arrive at the client as their typed classes.

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
}) {}

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {},
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
  id: Schema.String,
}) {}

// @if auth
// Session header set by the web app's `/api/rpc` route, which replaces any value the
// browser sent. Trusted because the API Worker is only reachable through that route.
export const viewerHeader = "x-viewer-id";

export class Viewer extends Schema.Class<Viewer>("Viewer")({ id: Schema.String }) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}) {}

// The signed-in user, provided to handlers of procedures that use `RequireViewer`.
export class CurrentViewer extends Context.Service<CurrentViewer, Viewer>()("CurrentViewer") {}

// Add `.middleware(RequireViewer)` to a procedure to require a session: its handler can
// `yield* CurrentViewer`, and `Unauthorized` joins its error union.
export class RequireViewer extends RpcMiddleware.Service<
  RequireViewer,
  { provides: CurrentViewer }
>()("RequireViewer", { error: Unauthorized }) {}

// @endif
export class ApiRpcs extends RpcGroup.make(
  Rpc.make("Health", { success: Schema.Literal("ok"), error: DatabaseUnavailable }),
  Rpc.make("GetUser", {
    payload: { id: Schema.String },
    success: User,
    error: Schema.Union([UserNotFound, DatabaseUnavailable]),
  }),
  // @if auth
  Rpc.make("Me", { success: Viewer }).middleware(RequireViewer),
  // @endif
) {}
