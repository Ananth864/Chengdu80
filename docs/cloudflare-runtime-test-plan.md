# Cloudflare generated-code runtime: evidence and hosted acceptance check

Investigation date: 2026-10-13. Scope: installed platform source and public primary documentation; no credentials inspected, deployment attempted, account created, or infrastructure changed by this investigation.

## Hosted result, 13 October 2026

The implementation team subsequently deployed the paid-account candidate at [Chengdu80 studio](https://chengdu80-web-live-ananthacharya-mb7epyiddt4jehqm.chengdu80-1610dcd1.workers.dev), using the supplied account token and existing HTTP proxy. `APP_LOADER` upload succeeded. Fifteen live checks passed, including three independent protocol fixtures, separate current/preview source versions, imports, acceptance, data retention and runtime recovery. An outbound fetch failed with `This worker is not permitted to access the internet via global functions like fetch()`. An infinite calculation failed with `Worker exceeded CPU time limit.` at a measured request round trip of 2,960 ms; this is transport time, not a measurement of the configured 50 ms CPU budget. A normal calculation succeeded afterward.

The portfolio UI rendered in the hosted browser. Convex persistence and platform-managed GLM explanations were also verified remotely. Authentication was explicitly deferred by the user: the deployed product is a shared demo, so authenticated account isolation is not part of this result. App calculations use Dynamic Workers; Alchemy's Durable Object is for deployment state. Full AI code generation is a separate model gate.

Machine-readable evidence is in ignored `platform/.local/hosted-evidence.json`; repeat with `bun scripts/test-hosted.ts <hosted-url>` over the permitted proxy path. The test creates or updates a dedicated verification app using synthetic inputs.

## Initial conclusion before credentials

Local isolated execution is demonstrated by the implementation team's prototype checks: custom calculation modules execute in Miniflare/workerd, outbound requests receive 403, and infinite calculations terminate through the local timeout/disposal path. The final implementation run reports 10 runtime/financial/storage checks, 12 HTTP lifecycle checks and 3 mock model-transport checks passing. This investigator inspected implementation/test source but did not independently rerun those suites; the parent agent performed the runs.

Cloudflare-hosted execution remains unverified because no authenticated paid-account deployment has been demonstrated. The local result supports continuing the prototype; it does not establish account entitlement, upload acceptance, deployed Worker Loader behavior, or hosted CPU enforcement. VPN/proxy use is accepted for this prototype, so ordinary mainland carrier access is not a required gate.

## Installed runtime and smallest approach

`platform/bun.lock` resolves Miniflare **4.20260730.0** with workerd **1.20260730.1**. Alchemy **2.0.0-beta.81** separately uses `@alchemy.run/cloudflare-runtime` with workerd **1.20260918.1**. These are separate dependency resolutions; a passing Miniflare test does not imply the Alchemy runtime executed the same binary.

The smallest working local approach is the existing two-module Worker: a trusted `entry.js` accepts JSON and calls the generated self-contained `calculations.js` export `analyze(input)`. Miniflare receives `modules`, `modulesRoot: '/'`, `cf: false`, and a denying `outboundService`. No Cloudflare account is needed for this local path. The host caches instances by bundle hash and disposes them on timeout or eviction. The generated module receives inputs, rather than platform secrets or host APIs. See `platform/apps/web/src/server/runtime.ts` and `platform/scripts/test-prototype.ts`.

This is a calculation-runtime feasibility result, not proof that an arbitrary generated full-stack application can run. The preview UI, financial-provider adapter, account-owned storage, and model calls are platform capabilities outside the calculation isolate. Syntax/permission checks complement runtime boundaries; they are not themselves a sandbox.

There is no need for a second direct-workerd prototype now. Installed Alchemy source already supports native local Worker Loader lowering: `RuntimeBindings.ts` maps `worker_loader` to `WorkerLoader.local(name)`, and the runtime's `core/bindings/WorkerLoader.ts` produces `{ name, workerLoader: {} }`. This is source evidence of a route for testing the hosted API shape locally, not a completed runtime test of that route.

## Verified Alchemy binding and hosted API shape

The installed Alchemy async-Worker example declares the loader on `env`; the platform uses the same form:

```ts
env: {
  APP_LOADER: Cloudflare.WorkerLoader('APP_LOADER'),
}
```

`Workers/WorkerAsyncBindings.ts` lowers this to upload metadata `{ type: 'worker_loader', name: 'APP_LOADER' }`. `Workers/InferEnv.ts` maps it to the native `WorkerLoader` type. The platform declaration is in `platform/apps/web/alchemy.run.ts`.

The hosted calculation path obtains `env.APP_LOADER`, calls `get(bundleHash, callback)` with the same two modules, sets `globalOutbound: null` and `limits: { cpuMs: 50 }`, then invokes `getEntrypoint().fetch(request)`. Cloudflare documents cached `get()` for repeated application requests, a loader binding that does not refer to a separately provisioned external resource, and the requirement to compile TypeScript/npm dependencies before loading. Keeping generated calculations as self-contained JavaScript avoids that extra bundling prerequisite. [Dynamic Workers getting started](https://developers.cloudflare.com/dynamic-workers/getting-started/), [API reference](https://developers.cloudflare.com/dynamic-workers/api-reference/).

`globalOutbound: null` causes hosted `fetch()` and `connect()` to throw. Local denial instead returns a controlled 403 response. Tests should assert denial as an outcome without assuming identical response/error shape across both runtimes. [Egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/).

## Hosted account, permissions, and resources

Dynamic Workers currently require **Workers Paid**, whose subscription minimum is **$5/month**. Creation, request, and CPU usage can add charges. For repeated calculations, stable `get()` IDs avoid counting every invocation as a fresh creation; code changes still affect creation counts. [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

For the smallest hosted probe, provide the intended account ID and a token scoped to that account. Current role documentation requires Workers **Admin at product scope to create a new Worker**; **Editor on an existing Worker** is sufficient to deploy new versions. The upload API still lists legacy **Workers Scripts Write** as accepted. Do not assume a new per-Worker Editor token can create the initial Worker. No separate Worker Loader permission/resource is documented. [Workers authorization](https://developers.cloudflare.com/workers/authorization/workers/), [Worker upload API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/).

Routes/custom domains require **Workers Routes Write** for the affected zone when creating or changing the connection. A workers.dev probe avoids that zone configuration. Account discovery may require **Account Settings Read**; specifying the account avoids treating unrelated discovery permissions as runtime requirements. The broad legacy “Edit Cloudflare Workers” template includes KV/R2 permissions that this calculation isolate does not itself need. [Token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/).

The actual platform uses `Cloudflare.state()`, so its first deployment can bootstrap additional Alchemy infrastructure: an `alchemy-state-store` Worker, a Durable Object class/namespace, an account Secrets Store adopted or created, and two state-store secrets. This is verified from installed `Cloudflare/StateStore/{State,Api,Store,Token}.ts`; it is separate from generated-app storage. Bootstrap therefore needs resource creation authority and **Secrets Store Write**, not merely permission to update the website Worker. The Secrets Store create API explicitly requires that permission. Durable Object deployment permissions should be checked during this bootstrap against the account's current role model. [Secrets Store create API](https://developers.cloudflare.com/api/resources/secrets_store/subresources/stores/methods/create/).

Convex deployment/auth and platform OpenAI credentials remain independent prerequisites for the full hosted product. The user's chosen main-model label is `gpt-6-luna`; this runtime investigation does not verify that model's availability on the intended OpenAI account.

## Next concrete acceptance check

Once the target paid account and deployment credentials are available, deploy the smallest existing calculation path through Alchemy to a workers.dev URL. Record account/plan confirmation without secret values, successful loader upload, a deterministic custom-module result matching local output, denial of outbound access, hosted 50 ms CPU-limit failure for an infinite calculation, and a successful normal request after that failure. Repeat across two code hashes to check version isolation. Only then call the hosted generated-code runtime validated. Follow with one authenticated end-to-end build/preview/approval/data-retention flow to validate the whole product.

No need to provision D1, R2, Browser Rendering, a Docker container, or a custom domain solely for this calculation probe. That statement concerns this narrowed prototype architecture, not the older whole-VibeSDK proposal.
