# Credentials and hosted handoff

Use the workspace `.env`. `bun run setup:env` created it only when absent, with mode 0600 and generated cookie/internal secrets. Existing credentials were not replaced. The file is ignored by Git. `bun run credentials` reports names, never values.

## Next local gate

On 2026-10-14 the platform briefly switched to OpenAI, but `api.openai.com` was unreachable from the current network (requests time out; Gitee AI remains reachable), so GLM through Gitee AI stays the active provider with the existing `GLM_API_KEY`, `GLM_MODEL=GLM-5.3` and `GLM_BASE_URL=https://ai.gitee.com/v1` in the workspace `.env`. Swap providers with `bun run provider glm` or `bun run provider openai` (only the `MODEL_PROVIDER` line changes), or launch directly with `bun run dev:glm` / `bun run dev:openai`; restart `bun run dev:local` after changing credentials. The platform manages models; there is no BYOK product UI.

Test specification creation, source generation, verified preview, a visible requested update, acceptance with data continuity, and an app explanation. Mock Responses and GLM Chat Completions tests prove SDK wiring only. GLM JSON mode is validated against the same specification/source schemas. Live checks are reported separately.

## Hosted services

| Service             | Configuration                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex              | `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `CONVEX_DEPLOY_KEY`. Run `bun run deploy:backend` from `platform/`; the launcher loads workspace credentials and requires a development deploy key. |
| WorkOS              | Deferred by the user. No WorkOS credentials are needed for the shared demo.                                                                                                                 |
| Trusted persistence | Matching `PLATFORM_INTERNAL_KEY` in Worker and Convex, at least 32 characters. Already generated locally.                                                                                   |
| Cloudflare          | `CLOUDFLARE_ACCOUNT_ID`, account-scoped token or Alchemy profile, Workers Paid with Dynamic Workers.                                                                                        |
| Tushare, optional   | `TUSHARE_TOKEN` with daily access. Portfolio/screening currently use fixtures or entered records.                                                                                           |

`CD80_DEMO_MODE=1` and the matching workspace `PLATFORM_INTERNAL_KEY` were set successfully on the development backend using the deployment API. They need no further manual setup for this deployment. Hosted launchers set both Worker demo mode and the matching public UI flag. All visitors share this demo's apps and data.

Account authentication can be restored later by explicitly setting `CD80_DEMO_MODE=0` in the workspace and Convex, then configuring WorkOS. It is outside this prototype's current acceptance gate.

`bun run deploy:backend` and `bun run codegen` succeeded against `giddy-chicken-826`. The auth configuration reads WorkOS variables only when demo mode is disabled, so no WorkOS credentials are required now. Live checks verified shared reads/writes, persisted data and source hashes, rejected ownership changes, untrusted server keys, unauthenticated account queries and duplicate creates. The four prepared local examples were copied to `demo-<local-app-id>` IDs in Convex; local files were preserved. `bun scripts/seed-hosted.ts` repeats the checks and skips existing hosted examples instead of overwriting changes.

Use `bun run dev:hosted` or `bun run deploy:hosted` from `platform/`. Wrappers load workspace credentials and remove local-mode flags, retaining the starter's Alchemy target. Do not deploy a build created with `VITE_LOCAL_MODE=1` as the authenticated product.

## Cloudflare proof

`APP_LOADER` matches installed Alchemy support and needs no separate loader resource. Dynamic Workers requires Workers Paid. `Cloudflare.state()` may bootstrap a state-store Worker, Durable Object and Secrets Store; initial permissions must cover those resources. See `cloudflare-runtime-test-plan.md` for dated primary sources and exact account/permission checks.

After the user upgraded Workers, the supplied account token successfully deployed the complete application, including `APP_LOADER`. The live URL is [Chengdu80 studio](https://chengdu80-web-live-ananthacharya-mb7epyiddt4jehqm.chengdu80-1610dcd1.workers.dev). No broader token, GitLab connection or additional Cloudflare credentials are needed for this prototype. The saved public account ID was corrected to the account the token could access; the token itself was unchanged.

Alchemy's required Bun/Node runtime peers are installed at 4.0.2 to match Effect. The hosted launcher passes `--yes` to apply the authorized deployment without terminal prompts. From this mainland connection, the current system proxy at port 3213 unblocked workers.dev state access. Retry with the current proxy after the upgrade:

```bash
cd /Users/ananthacharya/Documents/Chengdu80/platform
HTTP_PROXY=http://127.0.0.1:3213 HTTPS_PROXY=http://127.0.0.1:3213 NODE_USE_ENV_PROXY=1 NO_PROXY=127.0.0.1,localhost bun run deploy:hosted
```

The proxy port is an observed system setting, not a guaranteed permanent address. System proxy settings were not changed. Deployment success must be followed by the runtime tests below.

Fifteen live checks passed at the hosted URL: calculations for three protocols, anonymous shared-workspace access, imports, verified acceptance, updates, data retention, version separation, denied egress, CPU-limit failure and recovery. The browser rendered the portfolio app. GLM returned a hosted specification and a financial explanation using server-recomputed values. Actual externally prepared GLM source was imported, passed all eleven release checks, accepted and executed on Cloudflare. Built-in model generation/update evidence is tracked separately in `implementation-status.md`.

## China and test data

VPN/proxy use is allowed. The successful local path used Node 26 with `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY` and `HTTP_PROXY` pointing at the existing HTTP proxy, and `NO_PROXY=127.0.0.1,localhost`. Use the current proxy URL; no system settings were changed.

Alpha Vantage's fixed public demo returned 5,068 rows for `600104.SHH`. Strategy saved the last 252, dated 2025-09-16 through 2026-10-12. Another direct attempt failed, so availability is observed rather than guaranteed. Failed loads preserve saved inputs. Licensing and unadjusted-price limitations apply. This is not proof of Tushare or competition dataset access.

## Competition model

The user initially chose GPT-6 Luna and subsequently switched to GLM-5.3 through Gitee AI. The brief requires Qwen for development during the competition. This run assumes pre-competition prototyping and makes no competition-compliance or Qwen inference claim.

## Get the Cloudflare variables

1. Log in at [Cloudflare dashboard](https://dash.cloudflare.com/), select the intended account, press Cmd/Ctrl+K, and search **Copy account ID**. Paste it into `CLOUDFLARE_ACCOUNT_ID` in the workspace `.env`. [Account ID instructions](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/).
2. Go to **My Profile > API Tokens > Create Token > Create Custom Token**. Name it `chengdu80-prototype`. Add these account permissions and restrict **Account Resources** to the intended account:

   | Group   | Permission       | Access |
   | ------- | ---------------- | ------ |
   | Account | Workers Scripts  | Edit   |
   | Account | Account Settings | Read   |
   | Account | Secrets Store    | Edit   |

   If the dashboard instead exposes Workers product roles, creating the initial Worker needs **Workers Admin** at product scope. Legacy **Workers Scripts Edit** is the corresponding broad token permission. Secrets Store Edit is needed because Alchemy uses it for its deployment-state service. No custom-domain/zone permissions are requested for a workers.dev deployment. [Create token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/), [Workers permissions](https://developers.cloudflare.com/workers/authorization/workers/), [Secrets Store permissions](https://developers.cloudflare.com/secrets-store/access-control/), [Alchemy state and token permissions](https://alchemy.run/environments/ci/).

3. Select **Continue to summary > Create Token**. Copy the token when shown and put it into `CLOUDFLARE_API_TOKEN` in the workspace `.env`. This pair is the supported Alchemy environment configuration. [Alchemy profiles](https://alchemy.run/environments/profiles/).
4. The Dynamic Workers runtime requires the **Workers Paid** subscription. Its base subscription is **$5/month**, with usage charges beyond allowances. Select the Workers subscription for the same account; a paid domain/CDN plan is a different subscription. [Dynamic Workers pricing](https://developers.cloudflare.com/dynamic-workers/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_token
```

The Cloudflare account token passed the account-scoped token verification endpoint and successfully deployed resources. The account initially had no workers.dev subdomain, so `chengdu80-1610dcd1` was registered using the Workers API. An existing subdomain would have been preserved. Convex and the application are configured and deployed. Custom calculations use Worker Loader; Convex stores app source, releases and shared data. Alchemy's Durable Object holds deployment state, separate from application storage.

Gitee AI confirms the Chat Completions base URL `https://ai.gitee.com/v1` in its [integration documentation](https://ai.gitee.com/docs/integrations/Development-Tools/Qoder). GLM-5.3 is listed in its [model catalog](https://ai.gitee.com/docs/products/apis). The user-supplied Gitee key is sent only to that configured endpoint.
