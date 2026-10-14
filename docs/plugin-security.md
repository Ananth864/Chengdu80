# Plugin Security and Builder Scope

Plugin calls from the agent and generated apps require an owned application, an
enabled plugin, and `plugin.call` in the applicable manifest. Agent inspection
uses the staged workspace; browser execution uses the current verified release.
Only GET/HEAD operations are callable. Other operations remain discoverable but
are blocked until explicit action approval is implemented. GET/HEAD is a method
restriction, not a guarantee that an arbitrary provider has no side effects.

Authenticated plugins require an operator-managed, server-only
`CD80_PLUGIN_CREDENTIAL_BINDINGS` JSON array. Each entry binds `credentialEnv`,
`ownerId`, and the exact normalized `baseUrl`, including its path. For example:

```json
[
  {
    "credentialEnv": "CD80_PLUGIN_WEATHER_KEY",
    "ownerId": "shared-prototype-owner",
    "baseUrl": "https://weather.example/v1"
  }
]
```

Set the credential separately in the server environment. Quote JSON when using a
shell-sourced env file. Bindings are checked at registration and on every
authenticated call; removing one revokes credential access. Existing credential
plugins without a matching binding now fail closed. Public operations do not
receive credentials. Docker deployments must explicitly provide bindings and
the relevant credential variables to the web container; never use `VITE_` names.

Shared demo visitors share access to the demo workspace and its enabled plugins.
Do not bind sensitive credentials to that workspace or claim account privacy.

Scope checks cover complete specifications at release creation and activation,
including imports and agent deployment. Agent deployment also checks the current
user request. These are narrow deterministic scope guardrails, not a complete
capability/data feasibility assessment. Successful activation synchronizes staged
source and specification; failed candidates preserve them. Imports are rejected
during an active agent turn, and turns cannot checkpoint over a changed release.

## Workflow Visualization

The user retained graph architecture for user-facing workflow visualization.
This security update does not implement the graph or make it authoritative for
execution. A future visualization should reflect actual data sources,
capabilities, transformations, and outputs rather than imply unimplemented
orchestration.
