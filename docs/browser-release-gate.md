# P0 Application Release Gate

Legacy source candidates must pass source/calculation checks and an isolated
Chromium application check before activation. Capability simulations receive
browser checks as well; passing those never removes the production mock block.
The verifier uses the same CSP, iframe sandbox and SDK document as production.
It checks saved input compatibility, visible rendering, readiness, runtime/RPC
errors, declared interactions, isolated save/reload behavior, and numeric display
bindings when calculations are used. Browser evidence and the tested data hash
are recorded with successful releases.

Interactive manifests need `browserTests` with click/fill/assert-text steps. Each
step uses a CSS selector; fill/assert-text also specify a value. Apps declaring
storage writes must exercise a save. Numeric protocol outputs must be displayed
with `data-cd80-result="fieldName"`, with no more than two-decimal rounding error.
These checks do not prove every UI feature, financial claim or arbitrary DOM text.

Plugins need explicit manifest `pluginFixtures` containing pluginId, operationId
and result. The verifier validates ownership, enablement, permission, operation
parameters and credential binding, but returns the fixture without an outbound
provider call. AI explanations likewise use a marked fixture. This proves wiring,
not live provider behavior or data credibility; live acceptance remains separate.
Browser storage is cloned and never committed. Browser network requests are
blocked. Verification is bounded, one candidate at a time, and fails closed when
Chromium is unavailable. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` or install Playwright
Chromium. Docker includes system Chromium; the macOS setup launcher uses installed
Chrome when available.

Agent tool limits now produce an incomplete/error result rather than imply
success. Staged files remain available to the next turn. Expired persisted turns
are settled as interrupted after the ownership deadline; fresh concurrent turns
are not cleared. Tools and whole turns are not automatically replayed.
