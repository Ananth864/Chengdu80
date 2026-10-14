# FinMatch (flagship import)

Port of the standalone `2-finmatch-typescript-javascript.zip` ("Tinder for
stocks" with a local Tushare proxy) into the platform's self-contained legacy
bundle format (schema version 1, screening protocol).

## What was adapted and why

The original was a 3,370-line single-file TS app with a localhost proxy for
live Tushare quotes and localStorage persistence. The platform sandbox allows
neither network nor durable storage (`connect-src 'none'`, opaque origin), so:

- **Universe** — the embedded CSV becomes a 40-company SSE-style array
  (`Large cap / Mid cap / Small cap` × 5 industries). Metrics come from the
  original's deterministic fixture generator (industry bases + seeded RNG),
  keeping its sparse null states (unavailable ≠ zero).
- **Protocol tie-in** — the original's implicit matching gained an explicit
  **value screen** step implementing the screening contract exactly
  (positive finite P/E ≤ ceiling AND finite yield ≥ floor; missing excludes).
  It feeds the dealt deck.
- **Deck** — the swipe round keeps its identity: drag with rotation, KEEP /
  FOLD stamps, keyboard ←/→, dots progress, up to five cards.
- **Persistence** — watchlist is session-only with an honest label; when the
  platform grants `storage.write` to imported releases, keeps sync to shared
  app data automatically.
- Dropped: Tushare token/proxy management (no network), metric-tooltips hover
  (replaced by tap-to-learn modals, friendlier on the preview's pointer).

## Design

"The deal table" identity: sage felt paper, warm card stock, ink borders with
hard offset shadows, brass accents. Signature: the patterned card-back stack
under the top card and the rotated KEEP / FOLD drag stamps. Display face is a
heavy grotesque (Arial Black stack), figures are tabular mono. System stacks
only (sandbox CSP allows no webfonts).

## Files

- `cd80.json` — manifest (protocol `screening`, declared capabilities)
- `index.html` — static body fragment; also the gallery thumbnail at 1000×625
- `app.js` — universe, fixtures, quiz, screen, deck, watchlist, bridge layer
- `calculations.js` — screening protocol engine (verified by platform fixtures)
- `spec.json` — application specification recorded with the release

Register with `bun run seed:flagships` from `platform/`.
