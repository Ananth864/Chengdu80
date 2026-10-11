// @if drizzle
// import { mutationOptions, queryOptions, type QueryKey } from "@tanstack/react-query";
// import { ApiRpcs } from "@web-starter/api/rpc";
// import * as Cause from "effect/Cause";
// import * as Context from "effect/Context";
// import * as Effect from "effect/Effect";
// import * as Exit from "effect/Exit";
// import * as FetchHttpClient from "effect/http/FetchHttpClient";
// import * as Layer from "effect/Layer";
// import * as ManagedRuntime from "effect/ManagedRuntime";
// import * as RpcClient from "effect/rpc/RpcClient";
// import type { RpcClientError } from "effect/rpc/RpcClientError";
// import * as RpcSerialization from "effect/rpc/RpcSerialization";
//
// // Typed client for the API contract (`@web-starter/api/rpc`). Requests go to `/api/rpc`,
// // which the web Worker forwards to the API Worker. Browser only: the relative URL does
// // not resolve during SSR, so call these from components, not loaders.
// class Api extends Context.Service<Api, RpcClient.FromGroup<typeof ApiRpcs, RpcClientError>>()(
//   "Api",
// ) {}
//
// const runtime = ManagedRuntime.make(
//   Layer.effect(Api, RpcClient.make(ApiRpcs)).pipe(
//     Layer.provide(RpcClient.layerProtocolHttp({ url: "/api/rpc" })),
//     Layer.provide([RpcSerialization.layerJson, FetchHttpClient.layer]),
//   ),
// );
//
// type Client = Api["Service"];
//
// // Rejects with the typed failure so TanStack Query's `error` matches the contract.
// // Defects (bugs, not contract errors) reject with whatever was thrown.
// async function run<A, E>(call: (api: Client) => Effect.Effect<A, E>): Promise<A> {
//   const exit = await runtime.runPromiseExit(
//     Effect.gen(function* () {
//       return yield* call(yield* Api);
//     }),
//   );
//   if (Exit.isSuccess(exit)) return exit.value;
//   throw Cause.squash(exit.cause);
// }
//
// // `useQuery(apiQuery(["user", id], (api) => api.GetUser({ id })))`: `data` is `User`,
// // `error` is `UserNotFound | DatabaseUnavailable | RpcClientError`.
// export const apiQuery = <A, E>(queryKey: QueryKey, call: (api: Client) => Effect.Effect<A, E>) =>
//   queryOptions<A, E>({ queryKey, queryFn: () => run(call) });
//
// // `useMutation(apiMutation((api, input: { id: string }) => api.GetUser(input)))`.
// export const apiMutation = <I, A, E>(call: (api: Client, input: I) => Effect.Effect<A, E>) =>
//   mutationOptions<A, E, I>({ mutationFn: (input) => run((api) => call(api, input)) });
// @endif
