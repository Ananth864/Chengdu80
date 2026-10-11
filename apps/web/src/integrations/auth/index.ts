// @if auth
// @if workos
export { auth } from "./workos";
// @endif
// @if clerk
// export { auth } from "./clerk";
// @endif
export type { Viewer } from "./types";
// @endif
