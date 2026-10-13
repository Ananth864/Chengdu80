# Prototype assumptions

These are implementation decisions made under the user's authorization to build autonomously on 13 October 2026. They can be revised without changing the confirmed product direction.

1. This is a pre-competition prototype. The platform uses the user's selected `gpt-6-luna` through OpenAI Responses. The competition brief still requires Qwen for competition software development and evaluation. No competition-compliance claim follows from this prototype.
2. The starter's TanStack AI integration is sufficient initially. A second AI SDK is unnecessary unless a concrete missing capability appears.
3. Local mode is an explicitly labelled single-owner prototype. It works before hosted Convex, WorkOS, and Cloudflare credentials arrive. It must not be presented as proof of authenticated cloud isolation.
4. Initial example protocols cover portfolio analysis, asset screening, and strategy comparison. These are provisional examples, not the user's final application categories.
5. Three working financial examples demonstrate distinct calculations. The platform also accepts new compatible source applications and generates new applications from confirmed specifications.
6. Generated and imported applications follow a documented source contract with a permissions manifest, an HTML entry point, and browser JavaScript. Arbitrary server frameworks are outside the first supported import format.
7. Applications use normalized financial APIs, platform-managed AI, and shared app storage. Provider credentials remain server-side. Adding a financial provider means writing an adapter, not substituting an arbitrary URL.
8. Release checks include source-contract validation, permissions, deterministic numerical fixtures, and a sandbox execution check. User acceptance activates a verified preview; failed checks cannot activate a release.
9. Synthetic data is visibly labelled and repeatable. A narrow Alpha Vantage demo endpoint supplies a real-data adapter test, with coverage and provider limits displayed. It is not a replacement for the competition dataset or an unrestricted commercial data feed.
10. English requests only. One owner per account. Private apps by default. App data is shared within that app. Monitoring, team roles, and specification-only imports are deferred.
11. Credentials belong in the workspace `.env`. Existing secret values will never be overwritten or printed. Only the Convex URL and explicit prototype-mode flags may reach browser code.
12. A saved working release remains available during follow-up changes. Ordinary updates retain app data; changes that require destructive migrations must not silently erase it.
13. The initial supported import format is self-contained HTML/CSS/browser JavaScript plus a pure calculation module; arbitrary npm packages and server frameworks are deferred. The public source contract makes this limit explicit.
14. Public sharing is deferred. Accepted apps have private account-scoped URLs; local mode has an explicit demo owner.
15. The baseline strategy comparison is buy-and-hold versus a 0% cash benchmark, with a simple two-transaction fee approximation. It is not a general trading/backtesting engine.
16. Release checks establish fixture-level protocol correctness, not proof of every custom financial calculation or complete semantic specification compliance. Browser rendering is reviewed manually in this prototype.

17. User correction on 2026-10-13: WorkOS and login are deferred. Hosted launchers default to an explicit shared demo workspace. Everyone with the URL can access the same apps and data. This overrides the prototype privacy/login statements in items 3, 10 and 14; authenticated account privacy remains a future product decision. Convex stays as hosted storage, with matching server-only internal keys and `CD80_DEMO_MODE=1` on both services.

18. Subsequent user correction: the main model is GLM-5.3, supplied through Gitee AI. The workspace now supplies `GLM_API_KEY`, `GLM_BASE_URL=https://ai.gitee.com/v1` and case-sensitive `GLM_MODEL=GLM-5.3`. This overrides item 1's OpenAI model selection. Use TanStack AI's compatible Chat Completions adapter, enabled thinking, and JSON-object output validated against platform schemas. OpenAI remains an explicit optional fallback.

19. The supplied Convex key targets the development backend. Deploy only there and keep it separate from production. Populate the hosted shared demo with the four prepared public-data examples, preserving local copies and skipping any existing hosted app. No other local apps are copied.

20. The Cloudflare account had no workers.dev subdomain. Register `chengdu80-1610dcd1` as its initial subdomain to enable deployment. Preserve an existing account subdomain; do not purchase or upgrade a subscription without the user.

21. The user confirmed the Workers upgrade. The provided account token authorized deployment to the account with the registered prototype subdomain. Correct the public account ID when API checks prove a mismatch; preserve credentials. No GitLab integration is required because Alchemy deploys from this workspace.

22. Hosted acceptance tests use one dedicated verification app with synthetic inputs. They may create/import/accept test versions to prove updates and persistence; they never replace the four prepared examples or their saved data. A separate GLM-generated app is used for the live model gate.

23. Release hashes use a canonical object representation so Convex key ordering cannot invalidate an unchanged preview. Arrays and exact source strings remain significant. Older pending previews must be freshly verified rather than bypassing acceptance checks.

24. Use low GLM reasoning and a 12,288-token source-generation budget for the interactive prototype after a max-reasoning request exceeded an 11-minute caller deadline. Each model call has a 180-second deadline that cancels its transport. Keep mandatory checks and one explicit source repair; do not silently substitute sample code on a failed model build. GLM-5.3 supports low/high/max effort in the [publisher's model card](https://huggingface.co/zai-org/GLM-5.3); the chosen budget is an implementation assumption, not a guarantee of latency or correctness.

25. Portfolio holdings use `cost` and `price` in CNY per unit and `units` as the quantity held. Invested position cost is `units × cost`. A live model misinterpreted cost as a position total and failed the numerical fixture; the source remains blocked. Make units explicit in the protocol and public capability contract before asking for repair. Do not relax expected financial values to accept generated code.

26. The custom calculation's `error` string is a reserved failure signal. Both throwing an error and returning `{error:string}` reject the request; neither is successful financial data. This also prevents invalid inputs from being saved through storage.write. Include a runtime version in isolate cache IDs when the trusted wrapper changes. Re-run preview checks against current runtime behavior without changing source or activating the release.
