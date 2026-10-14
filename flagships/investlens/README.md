# InvestLens (flagship import)

Port of the standalone `1-InvestLens-typescript-javascript.zip` (SSE research
dashboard with a Tushare backend) into the platform's self-contained legacy
bundle format (schema version 1, portfolio protocol).

## What was adapted and why

The original ran a Node backend (10 `/api/*` endpoints, Tushare token
management, result store, rule-based chatbot over stored records). The platform
sandbox renders client-only bundles with `connect-src 'none'`, so the backend
cannot come along. Instead:

- **Universe** — the 196 KB CSV is replaced by an 8-company SSE sample universe
  bundled in `app.js`. Series are deterministic per-ticker samples; every panel
  stamps its data as a sample and names its fictional sources.
- **Bridge upgrade path** — on boot the app probes `window.cd80`
  (`storage.read`, then `market.prices` per selection, `ai.explain` for open
  chat questions). When the platform grants capability access to imported
  releases, chips flip to "live platform data" and shared inputs replace the
  bundled holdings. Today imported releases have no build record, so every
  capability call is refused and the labelled sample fallback renders.
- **Portfolio lens** — the protocol view required by the portfolio contract:
  holdings valued with the same bundled closes, mirroring `calculations.js`.
- **Chatbot** — the rule-based responder now answers from the bundled records
  only and keeps the honest unsupported-question reply.

## Design

"Research memo" identity: ivory quotation-sheet ground, ink-navy text, CN
market convention (red gains / jade declines), monospaced tabular figures,
CNY 万/亿 units. Signature elements: the dark ticker strip under the masthead
and the rotated rubber-stamp status chips. System font stacks only (the sandbox
CSP allows no webfonts).

## Files

- `cd80.json` — manifest (protocol `portfolio`, declared capabilities)
- `index.html` — static body fragment; also the gallery thumbnail at 1000×625
- `app.js` — sample universe, deterministic series, panels, chat, bridge layer
- `calculations.js` — portfolio protocol engine (verified by platform fixtures)
- `spec.json` — application specification recorded with the release

Register with `bun run seed:flagships` from `platform/`.
