// @if drizzle
// import { mutationOptions, queryOptions } from "@tanstack/react-query";
// import { createSerializationAdapter } from "@tanstack/react-router";
// import { createIsomorphicFn } from "@tanstack/react-start";
// import * as contract from "@web-starter/api/contract";
// import { Api } from "@web-starter/api/contract";
// import * as Cause from "effect/Cause";
// import * as Context from "effect/Context";
// import * as Effect from "effect/Effect";
// import * as Exit from "effect/Exit";
// import * as FetchHttpClient from "effect/http/FetchHttpClient";
// import type { HttpClientError } from "effect/http/HttpClientError";
// import type * as HttpApi from "effect/http-api/HttpApi";
// import * as HttpApiClient from "effect/http-api/HttpApiClient";
// import type * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
// import type * as HttpApiGroup from "effect/http-api/HttpApiGroup";
// import type * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";
// import * as Layer from "effect/Layer";
// import * as ManagedRuntime from "effect/ManagedRuntime";
// import * as Predicate from "effect/Predicate";
// import * as Schema from "effect/Schema";
//
// // Typed client for the API contract (`@web-starter/api/contract`), as TanStack Query
// // options with keys derived from the endpoint and its input:
// //
// //   const { data, error } = useQuery(api.getUser.queryOptions({ params: { id } }));
// //   queryClient.invalidateQueries({ queryKey: api.getUser.key() });
// //
// // `data` is `User`; `error` is `UserNotFound | DatabaseUnavailable | HttpClientError |
// // SchemaError`. Works in components, loaders, and SSR: the browser calls `/api/v1`, and
// // the server calls the API Worker directly over its service binding.
//
// type Client = HttpApiClient.ForApi<typeof Api>;
// type Endpoints =
//   typeof Api extends HttpApi.HttpApi<string, infer Groups> ? HttpApiGroup.Endpoints<Groups> : never;
// type Name = Endpoints["identifier"];
// type Of<N extends Name> = Extract<Endpoints, { readonly identifier: N }>;
//
// type Input<N extends Name> = Omit<
//   Exclude<
//     HttpApiEndpoint.ClientRequest<
//       Of<N>["~Params"],
//       Of<N>["~Query"],
//       Of<N>["~Payload"],
//       Of<N>["~Headers"],
//       "decoded-only"
//     >,
//     void
//   >,
//   "responseMode" | "sseOptions"
// >;
// type Success<N extends Name> = HttpApiClient.SuccessType<Of<N>["~Success"]>;
// type Failure<N extends Name> =
//   | Of<N>["~Error"]["Type"]
//   | HttpApiMiddleware.Error<Of<N>["~Middleware"]>
//   | HttpClientError
//   | Schema.SchemaError;
//
// class ApiClient extends Context.Service<ApiClient, Client>()("ApiClient") {}
//
// const makeRuntime = (baseUrl: string, fetch: typeof globalThis.fetch) =>
//   ManagedRuntime.make(
//     Layer.effect(ApiClient, HttpApiClient.make(Api, { baseUrl })).pipe(
//       Layer.provide(FetchHttpClient.layer),
//       Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
//     ),
//   );
//
// let runtime: ReturnType<typeof makeRuntime> | undefined;
//
// const getRuntime = createIsomorphicFn()
//   .client(async () => (runtime ??= makeRuntime(location.origin, fetch)))
//   .server(async () => {
//     // Imported here so the binding and session code stay out of the browser bundle.
//     const { forwardToApi } = await import("./api.server");
//     return (runtime ??= makeRuntime("http://api", (input, init) =>
//       forwardToApi(new Request(input, init)),
//     ));
//   });
//
// // Rejects with the typed failure so TanStack Query's `error` matches the contract.
// // Defects (bugs, not contract errors) reject with whatever was thrown.
// async function call<N extends Name>(name: N, input: Input<N> | undefined): Promise<Success<N>> {
//   const exit = await (
//     await getRuntime()
//   ).runPromiseExit(
//     Effect.gen(function* () {
//       const client = yield* ApiClient;
//       // Each name has its own method type; `Input<N>` already matches it.
//       const method = client[name] as unknown as (
//         input: object,
//       ) => Effect.Effect<Success<N>, Failure<N>>;
//       return yield* method(input ?? {});
//     }),
//   );
//   if (Exit.isSuccess(exit)) return exit.value;
//   throw Cause.squash(exit.cause);
// }
//
// // Query and mutation options for one endpoint. Keys are `["api", name, input]`, so
// // `key()` (`["api", name]`) matches every call of the endpoint.
// const endpoint = <N extends Name>(name: N) => ({
//   key: () => ["api", name] as const,
//   queryOptions: (...[input]: {} extends Input<N> ? [input?: Input<N>] : [input: Input<N>]) =>
//     queryOptions<Success<N>, Failure<N>>({
//       queryKey: ["api", name, input ?? {}],
//       queryFn: () => call(name, input),
//     }),
//   mutationOptions: () =>
//     mutationOptions<Success<N>, Failure<N>, Input<N>>({
//       mutationKey: ["api", name],
//       mutationFn: (input) => call(name, input),
//     }),
// });
//
// const names = Object.values(Api.groups).flatMap((group) => Object.keys(group.endpoints) as Name[]);
//
// export const api = Object.fromEntries(names.map((name) => [name, endpoint(name)])) as {
//   readonly [N in Name]: ReturnType<typeof endpoint<N>>;
// };
//
// type SchemaClass = Schema.Codec<object, unknown> & {
//   readonly identifier: string;
//   readonly prototype: object;
// };
// const isSchemaClass = (u: unknown): u is SchemaClass =>
//   Schema.isSchema(u) && typeof u === "function";
// const classes = Object.values(contract).flatMap((c) => (isSchemaClass(c) ? [c] : []));
// const classOf = (value: object) =>
//   classes.find((c) => Object.getPrototypeOf(value) === c.prototype);
//
// // SSR hands query data and errors to the browser through TanStack Start's serializer,
// // which rejects class instances. This sends contract classes (`User`, tagged errors) as
// // their encoded fields and rebuilds the class on the other side. Registered in `start.ts`.
// export const apiSerializationAdapter = createSerializationAdapter({
//   key: "api",
//   test: (value): value is object => Predicate.isObject(value) && classOf(value) !== undefined,
//   toSerializable: (value) => {
//     const schema = classOf(value)!;
//     return { id: schema.identifier, fields: Schema.encodeUnknownSync(schema)(value) };
//   },
//   fromSerializable: ({ id, fields }: { id: string; fields: unknown }) =>
//     Schema.decodeUnknownSync(classes.find((c) => c.identifier === id)!)(fields),
// });
// @endif
