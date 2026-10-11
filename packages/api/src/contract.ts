// @if auth
import * as Context from "effect/Context";
// @endif
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
// @if auth
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
// @endif
import * as OpenApi from "effect/http-api/OpenApi";
import * as Schema from "effect/Schema";

// The API contract, shared by the Worker (`./app.ts` implements it) and the web client
// (`apps/web/src/integrations/api.ts` calls it). Imports only `effect`, so it is safe
// to bundle for the browser. Successes, inputs, and errors are schemas: values are
// validated on both sides, errors arrive at the client as their typed classes, and
// `httpApiStatus` sets each error's HTTP status in responses and the OpenAPI document.

export class User extends Schema.Class<User>("User")({
  id: Schema.String,
  email: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
}) {}

export class DatabaseUnavailable extends Schema.TaggedError<DatabaseUnavailable>()(
  "DatabaseUnavailable",
  {},
  { httpApiStatus: 503 },
) {}

export class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  { id: Schema.String },
  { httpApiStatus: 404 },
) {}

// @if auth

// Session header set by the web app's `/api/v1` route, which replaces any value the
// caller sent. Trusted because the API Worker is only reachable through that route.
export const viewerHeader = "x-viewer-id";

export class Viewer extends Schema.Class<Viewer>("Viewer")({ id: Schema.String }) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  { httpApiStatus: 401 },
) {}

// The signed-in user, provided to handlers of endpoints that use `RequireViewer`.
export class CurrentViewer extends Context.Service<CurrentViewer, Viewer>()("CurrentViewer") {}

// Add `.middleware(RequireViewer)` to an endpoint to require a session: its handler can
// `yield* CurrentViewer`, and `Unauthorized` joins its error union.
export class RequireViewer extends HttpApiMiddleware.Service<
  RequireViewer,
  { provides: CurrentViewer }
>()("RequireViewer", { error: Unauthorized }) {}
// @endif

// Endpoint names become client methods (`api.getUser`). Everything is served under
// `/api/v1`, with the OpenAPI document at `/api/v1/openapi.json` and docs at `/api/v1/docs`.
export class Api extends HttpApi.make("api")
  .add(
    HttpApiGroup.make("api", { topLevel: true }).add(
      HttpApiEndpoint.get("health", "/health", {
        success: Schema.Literal("ok"),
        error: DatabaseUnavailable,
      }),
      HttpApiEndpoint.get("getUser", "/users/:id", {
        params: { id: Schema.String },
        success: User,
        error: [UserNotFound, DatabaseUnavailable],
      }),
      // @if auth
      HttpApiEndpoint.get("me", "/me", { success: Viewer }).middleware(RequireViewer),
      // @endif
    ),
  )
  .prefix("/api/v1")
  .annotateMerge(OpenApi.annotations({ title: "web-starter API" })) {}
