# BoardSight (flagship import)

Port of the standalone `3-BoardSight-typescript-javascript.zip` (annual-report
dashboard with a local PDF-extraction backend) into the platform's
self-contained legacy bundle format (schema version 1, strategy protocol).

## What was adapted and why

The original uploaded a PDF to a small Node backend that extracted page text
with a pdf.js worker, then parsed comparative columns client-side. The platform
sandbox allows no backend and no PDF.js (bundle size caps + `connect-src
'none'`), so:

- **Input** — PDF upload becomes _paste the report text_ (income statement and
  balance sheet pages). The original's line-based parsers, year-column
  detection, candidate rows and manual assignment are ported; when no year
  header is found the current-first column order is assumed and the assumption
  is stated in the evidence view.
- **Fictional example** — the original's Northstar Studio demo dataset is kept
  as the default workspace, labelled as fictional.
- **Protocol tie-in** — the original dashboard gained a "What the market paid"
  panel computed with the strategy contract (gross return, max drawdown,
  two-transaction fee approximation) on a deterministic sample series, so the
  report's story sits next to price action. Shared platform prices are used
  automatically when capability access is granted.
- **Persistence** — the original used localStorage; the sandbox has none, so
  the workspace is per-session with an honest label.

## Design

"Printed statement" identity: bond-white sheets on a light ground, ink rules
with double-line statement headers, tabular monospaced figures, audit green
for improvements and vermilion for declines. Signature: the evidence tags
(`p.1 · row 3`) that open the exact source line behind every figure. Georgia
appears only in the masthead and headline; system stacks only (sandbox CSP
allows no webfonts).

## Files

- `cd80.json` — manifest (protocol `strategy`, declared capabilities)
- `index.html` — static body fragment; also the gallery thumbnail at 1000×625
- `app.js` — parsing, cards, evidence, market panel, bridge layer
- `calculations.js` — strategy protocol engine (verified by platform fixtures)
- `spec.json` — application specification recorded with the release

Register with `bun run seed:flagships` from `platform/`.
