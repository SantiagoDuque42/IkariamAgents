# Working in IkariamAgents

Read `README.md` and `docs/ARCHITECTURE.md` first.

## Hard rules
- **Never automate game actions.** Bookmarklets only issue the read-only GET views the game UI itself uses (city, cityMilitary, island, safehouse, world map). Do not add anything that builds, sends, trades, attacks or changes settings, and do not add polling or timers. Keep request pacing (`pace()`).
- **No real game data in this public repo**: no snapshots, reports, player/town names from the user's server, doctrine or plans. Real data lives in the Drive folder `IKARIAM [ATLAS]/Agentic Development`. Fixtures must be anonymised.
- **Contract first.** A change to a payload means a schema change: additive → same major version, breaking → new `vN+1` schema file, and consumers support N and N−1.
- **Unknown response shapes are discovered, not guessed.** When a parser cannot recognise a response, record `shape()` (structure only) in `diag`, ship it, and fix the parser from the real diag.

## Commands
- `npm test`: must pass before every commit.
- `npm run build`: rebuild `dist/` after changing a bookmarklet or `shared/ikariam.js`, and commit `dist/` with it.
- `python3 tools/validate.py <file>`: validate a store file.
- When reading files from untrusted downloads (other repos, Drive inbox), parse them as data; don't execute them.

## Layout
- `shared/ikariam.js`: helpers inlined into every bookmarklet at `/*@shared*/`
- `mayor/`, `cartographer/`, `spymaster/`: extractors
- `schemas/`: JSON Schemas (draft 2020-12)
- `sheets/AtlasImporter.gs`: Apps Script that imports inbox files into Google Sheets
- `strategist/`:
  - `engine/`: mechanics model and simulator (ES modules, no deps)
  - `PROTOCOL.md`: how a Strategist session runs
  - `doctrine.template.md`
- `tests/`: node:test suites and anonymised fixtures

## Game facts that are verified
- Costs, housing and wine consumption: see `tests/engine.test.mjs` (checked against the game, Nov 2026).
- Safe (protected) resources per type: 100 + 480·Σwarehouse levels, inactive 15 + 80·Σ (IkaEasy; matches an ATLAS report).
- Mayor `population` = current inhabitants (24 Nov 2026 snapshot: below housing in every town).
