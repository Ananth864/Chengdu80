# Cloudflare feasibility in mainland China

This records the initial VibeSDK/network investigation. The user subsequently chose web-starter; the current architecture and local runtime evidence are in `cloudflare-runtime-test-plan.md` and `implementation-status.md`. The earlier 37-table/D1/R2/VibeSDK plan below is not the implemented prototype.

Checked on 13 October 2026. Network measurements were taken approximately 02:11 to 02:13 China time. Follow-up checks inspected local tool availability and pinned public upstream source. Status: investigation evidence; deployed runtime remains unverified.

## Finding

The user has accepted VPN/proxy access for this prototype. Ordinary mainland access without a proxy is therefore no longer a required gate. Public Cloudflare and VibeSDK pages responded over this laptop's existing network paths, which is enough to continue investigating Cloudflare as a prototype host. A complete deployed build and generated-app runtime remain unverified.

Cloudflare classified the application-proxy-bypassed request IP as Singapore and the explicitly proxied request IP as the United States. This identifies the observed request-IP classification, not this laptop's physical location or a particular tunneling mechanism. These measurements cannot support a claim about ordinary mainland carrier access.

No application deployment, account login, resource creation, model inference, or network-setting change was performed. This workspace contains proposal and planning documents, rather than an implemented platform or account configuration.

## Exact architecture under consideration

The plan forks `cloudflare/vibesdk`, pinned by the document to commit `9da158d`, and retains its Think agent, SpaceDO workspace and git workflow, runtime bundling, Dynamic Worker previews, per-app Durable Object Facets with SQLite, authentication, gallery, and browser capture. Follow-up read-only requests retrieved selected upstream files at that abbreviated commit. Its `package.json` declares version `1.5.0` and Node `>=22`. The full commit SHA, complete repository and all planned modifications were not audited.

The proposed finance layer adds:

- A platform Hono Worker on `cd80.<account>.workers.dev`, with preview and published apps served through paths on that same host. Published URLs use `/a/<slug>/`.
- Worker Loader `LOADER.get(...)` to run each generated application. No Workers for Platforms or custom domain is planned initially.
- A `Cd80Service` RPC binding carrying an app ID and scopes, injected as `env.CD80`. Browser calls use intercepted `/cd80/*` paths.
- A second D1 database, `FIN_DB`, for 37 finance tables, plus the platform D1 database for users, apps, and app-scoped key-value state.
- App-scoped files in R2, cached Tushare responses in KV, and Qwen inference through DashScope.
- A `WorkerEntrypoint` gateway as `globalOutbound` to inject model credentials and reject other outbound destinations.
- Browser Rendering to load previews, collect console errors and screenshots, and feed repair results to the coding agent.
- WebSocket communication in the builder and server-sent events for streaming AI within generated apps.

The documents do not propose Cloudflare Realtime, SFU, TURN, WebRTC media, or a live video service. Those products are not dependencies of this plan.

Sources within this workspace: `chengdu80-plan.html`, sections 1, 2, WP0, WP2 to WP4, WP7, WP9 and WP12; `chengdu80-tasks.html`, H01 to H03, T02 to T04, T19, T24, T26 and G1.

## Verified platform facts

| Question                                                      | Current primary-source evidence                                                                                                                                                                                                                                                                                                                                                 | Consequence                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is Worker Loader generally obtainable?                        | Dynamic Workers entered open beta for all paid Workers users on 24 March 2026. [Cloudflare announcement](https://developers.cloudflare.com/changelog/post/2026-03-24-dynamic-workers-open-beta/)                                                                                                                                                                                | The document's access check should verify a paid account and successful deployment, rather than presume private-beta admission.                                                                                             |
| Are the core sandbox mechanisms documented?                   | Worker Loader supports `load` and cached `get`; code may receive custom bindings. [Getting started](https://developers.cloudflare.com/dynamic-workers/getting-started/), [bindings](https://developers.cloudflare.com/dynamic-workers/usage/bindings/)                                                                                                                          | The proposed mechanism exists. Its exact integration into SpaceDO still needs a deployed spike.                                                                                                                             |
| Do generated apps have isolated SQL storage?                  | Facets run child Durable Object classes with SQLite databases separate from the supervisor. [Facets](https://developers.cloudflare.com/dynamic-workers/usage/durable-object-facets/)                                                                                                                                                                                            | This storage model is documented; persistence through this fork's publishing, redeployment and migration workflow remains untested.                                                                                         |
| Can the gateway intercept outbound access?                    | `globalOutbound` can deny access or route `fetch` and `connect` through an entrypoint that injects credentials. [Egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/)                                                                                                                                                                       | The design has a documented basis. Browser traffic needs separate controls and tests.                                                                                                                                       |
| Does `ctx.exports` need a flag?                               | Current documentation requires `enable_ctx_exports`. [Context API](https://developers.cloudflare.com/workers/runtime-apis/context/)                                                                                                                                                                                                                                             | Retain the explicit flag and the SpaceDO integration spike.                                                                                                                                                                 |
| Does an ordinary paid Worker include mainland infrastructure? | China Network is a separate subscription for Enterprise customers, and onboarding requires an ICP filing or license for the apex domain. [China Network overview](https://developers.cloudflare.com/china-network/)                                                                                                                                                             | Workers Paid and a custom domain do not themselves activate China Network.                                                                                                                                                  |
| What does China Network support?                              | Its list includes Workers, KV, Assets, service bindings, WebSockets and R2 with restrictions. D1, Durable Objects/Facets, Dynamic Workers and Browser Rendering are not listed. R2 buckets cannot be created in mainland China; its custom domains are not supported there. [Available products](https://developers.cloudflare.com/china-network/reference/available-products/) | Do not assume this entire VibeSDK stack can run inside China Network. Obtain explicit feature confirmation if that route is chosen. Absence from the list is not proof that a global deployment is inaccessible from China. |
| Does China Network remove other onboarding requirements?      | A proof of concept requires an ICP number and JD Cloud content vetting. Turnstile is not supported in mainland China. Pages is not available within mainland China, with possible extension from a global zone. [FAQ](https://developers.cloudflare.com/china-network/faq/)                                                                                                     | Pages is not a tested replacement for the runtime, and any Turnstile dependency needs review.                                                                                                                               |
| Is `workers.dev` the recommended production address?          | Cloudflare recommends a Workers route or custom domain for production; it describes `workers.dev` as intended for personal or hobby projects. [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)                                                                                                                                       | A custom domain is worth testing, but must not be called a guaranteed mainland-access fix.                                                                                                                                  |

## Read-only measurements from this laptop

No HTTP, HTTPS, ALL_PROXY or NO_PROXY environment variables were set. macOS system proxies were enabled: HTTP and HTTPS at loopback port 15236, SOCKS at loopback port 15235. The default route was through `en0`. Tunnel interfaces existed; their presence alone does not identify which application or route was active.

The first mode used `curl -q --noproxy '*'`. This bypasses application-level proxy settings, not every possible system, upstream or transparent tunnel. The second mode explicitly used the already configured HTTP proxy with `--proxy http://127.0.0.1:15236 --noproxy ''`. Requests used verified HTTPS, followed redirects, and had a 6-second connect timeout and a 16-second total timeout. Each listed result is one request, not a reliability sample.

| Endpoint                                                   | Application proxy bypassed | Explicit system HTTP proxy |
| ---------------------------------------------------------- | -------------------------- | -------------------------- |
| `https://workers.dev/`                                     | HTTP 200, 2.62 s           | HTTP 200, 12.29 s          |
| `https://developers.cloudflare.com/`                       | HTTP 200, 0.93 s           | HTTP 200, 4.60 s           |
| `https://dash.cloudflare.com/`                             | HTTP 403, 0.65 s           | HTTP 403, 2.34 s           |
| `https://www.cloudflare.com/cdn-cgi/trace`                 | HTTP 200, 0.65 s           | HTTP 200, 2.82 s           |
| `https://www.baidu.com/`                                   | HTTP 200, 0.82 s           | HTTP 200, 3.38 s           |
| `https://dashscope.aliyuncs.com/compatible-mode/v1/models` | HTTP 401, 0.66 s           | HTTP 401, 5.47 s           |
| `https://build.cloudflare.dev/`                            | HTTP 200, 1.20 s           | HTTP 200, 2.97 s           |

`build.cloudflare.dev` is the public demo linked by the [official VibeSDK repository](https://github.com/cloudflare/vibesdk). Only its home document was requested; no login, build, preview or generated application was exercised.

Trace fields from separate read-only requests were:

| Field                                         | Application proxy bypassed | Explicit system HTTP proxy |
| --------------------------------------------- | -------------------------- | -------------------------- |
| `loc`, apparent client-country classification | `SG`                       | `US`                       |
| `colo`, serving Cloudflare location           | `SIN`                      | `LAX`                      |
| `warp`                                        | `off`                      | `off`                      |
| `gateway`                                     | `off`                      | `off`                      |

The SG client classification prevents treating the first mode as a confirmed mainland baseline. Serving location alone would not establish this, since normal mainland visitors can be served overseas. `warp=off` and `gateway=off` do not rule out third-party tunneling. The two paths have different apparent egress, but the mechanism behind the first path was not identified. Public IP addresses and proxy credentials were not retained.

Dashboard 403 is an HTTP response, not proof of firewall blocking or usable dashboard access. DashScope 401 confirms an unauthenticated endpoint response, not approved-model access, streaming, or inference from a deployed Worker. The `workers.dev` root landing page is not a substitute for testing the team's actual Worker subdomain.

## Local tools and account evidence

Read-only executable/version checks found Qwen Code `0.24.7` at `/Users/ananthacharya/.local/bin/qwen`, Bun `1.3.14`, Node `v26.5.1`, npm `11.17.0`, and Git `2.54.0`. Only `qwen --version` was run; Qwen authentication and model access were not tested. No `wrangler` executable was available in this shell's PATH. No auth file existed at the checked standard locations `.wrangler/config/default.toml`, `.config/.wrangler/config/default.toml`, or `.config/wrangler/config/default.toml` beneath the home directory. The current shell did not contain `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CF_API_TOKEN`, or `DASHSCOPE_API_KEY`.

Only file existence and variable presence were inspected. No credential contents were opened or printed. No software was installed and no `npx`/`bunx` command that might download Wrangler was run. Without an authenticated CLI context, no account identity, paid-plan entitlement, permissions or resource quota could be verified. A browser login or credentials elsewhere may exist; this check does not rule them out.

## Pinned source findings that change the bootstrap

The upstream [Wrangler configuration](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/wrangler.jsonc) has `workers_dev: false`, `preview_urls: false`, upstream custom-domain routes, and upstream resource IDs. To use the plan's path-based `workers.dev` deployment, enable `workers_dev`, replace the upstream routes and resources, and set `CUSTOM_DOMAIN` to the actual hostname. Setting `CUSTOM_DOMAIN` alone does not enable the endpoint. The upstream `preview_urls` switch refers to Cloudflare version-preview URLs; it is distinct from generated-app path previews.

That configuration also retains Containers, a Workers for Platforms dispatcher, Artifacts, a templates R2 bucket and remote Workers AI/Browser bindings. The [pinned setup guide](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/docs/setup.md) says the current Think/SpaceDO preview path needs `SPACE_DO` and `LOADER`, does not need Docker, and can use SQLite workspace storage with Artifacts off. It describes setup as creating remote resources. Strip the legacy resource configuration and review setup's resource-creation path before running it for this fork. The upstream README's broader production requirements include Workers for Platforms and custom domains; the proposed fork intentionally removes those paths and must prove its replacement.

Cloudflare's current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) lists a $5 USD/month account minimum for Workers Paid, with usage-based extras. [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/) confirms paid-plan-only availability and bills daily worker creations from 26 May 2026, in addition to requests and CPU. The older open-beta announcement's temporary creation-charge waiver is obsolete. D1, R2, KV, Durable Object storage and browser usage also need a budget and quota check. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) cap each paid database at 10 GB, which cannot be increased; a database executes queries sequentially. The 37-table finance load needs a size check and representative performance tests before promising a single `FIN_DB` will suffice.

## Qwen and an instruction-led builder

The pinned [ThinkAgent source](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/think/ThinkAgent.ts) builds an OpenAI-compatible client from configurable model URL/key fields and uses Chat Completions. Its system prompt combines a model-family prompt with project context, and its tools read, write and edit workspace files, commit and deploy. The pinned [model config](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/think/model-config.ts) defaults to a Gemini model. The inspected [direct-provider switch](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/inferutils/core.ts) contains no DashScope case. Qwen therefore needs an explicit model/provider integration and an authenticated tool-calling test; it is not already verified by the stock configuration.

[Alibaba's compatibility documentation](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) supports Qwen via OpenAI-compatible Chat Completions, with streaming. The endpoint and API key must match the selected region. Current docs recommend workspace-specific Beijing/Singapore URLs, while the existing DashScope domains still work. Pick the organizer-approved endpoint and model, then test them from the deployed Worker. The earlier unauthenticated 401 does not establish model access.

The pinned [skills catalog](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/think/skills.ts) imports Markdown skills and exposes them to Think. Together with project context and existing file-editing tools, this provides a concrete seam for finance protocols selected by app type while retaining free application code generation. An executable node graph is not required by these mechanisms. This is a source-grounded design inference, not a demonstrated Qwen behavior. Prompt and skill instructions alone do not enforce permissions or numerical correctness; app capabilities, scope checks, deterministic finance functions and validation still need code.

The pinned [SpaceDO loader](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/space/src/space/durable-object.ts) does load an `App` Durable Object class through `LOADER.get` and serves a Facet, but passes no `env.CD80` or `globalOutbound` in that call. The proposed service/gateway injection is new work.

## Smallest next deployed spike

Ordinary mainland carrier tests are optional for this prototype under the accepted VPN/proxy requirement. The remaining runtime gate needs an authenticated paid Cloudflare account, resource permissions, and the approved Qwen credential. The current workspace and shell do not provide that context.

The smallest useful Qwen-built spike is one finance app in the retained VibeSDK builder, not the full platform. Keep the stock interface and file-editing loop, switch the model to Qwen, and give it one small app-type protocol. Deploy through `SPACE_DO` and `LOADER` at the actual candidate hostname. Inject a scoped `env.CD80` stub that returns two fixed bond records; have Qwen generate a screener with a persistent watchlist in Facet SQLite and an AI explanation streamed through the gateway. Require a second user instruction to change the app and redeploy it. Verify browser WebSocket progress, preview/backend access, SSE completion, state surviving reload/redeploy, one permitted finance call, one rejected scope call, and one rejected direct external fetch. Capture URLs, request results and errors over the team's accepted proxy path.

That spike tests the risky builder/model/sandbox integration without loading 37 tables. A subsequent infrastructure check must exercise a tiny D1 table, R2 upload/download, and Browser Rendering on the actual account; then measure representative real finance queries. These account-dependent checks have not been performed here.

A custom domain may help a hostname-specific reachability problem. It does not guarantee reliable international routing or convert the design into a China Network deployment. The referenced "Hong Kong Docker plan" is not present among the reviewed files and cannot yet be treated as an executable fallback. Moving this architecture away from Cloudflare would require replacement plans for Worker Loader, Durable Objects/Facets, bindings, D1 and R2, plus isolation for generated code.
