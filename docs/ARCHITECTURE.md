# IkariamAgents: architecture and plan (v0.3, 24 Nov 2026)

Code: github.com/SantiagoDuque42/IkariamAgents. ATLAS members' Claudes work on branches there. Data: the private Drive folder `IKARIAM [ATLAS]/Agentic Development`.

## Decisions
- **Purpose:** a real agent architecture that is also usable every day.
- **Audience:** built for one player, reusable by ATLAS.
- **Data flow:** bookmarklets download files into the Drive-synced `inbox/`.
- **Map sources:** the in-game map, plus ikadatos read inside the player's browser (ikadatos refuses server-side requests).
- **Writing to sheets:** the Apps Script importer, with **one spreadsheet per exporter** (Farmeos for spy reports; military history, transports, … get their own).
- **Executor:** **Basileus** acts only through Claude in Chrome. Approved orders only to start (standing tasks later), v1 actions build/transport/workers/wine, on demand, at set times or on an interval. See `docs/BASILEUS.md`.

## Principles
1. **One reasoning agent per role; everything else deterministic.** The Strategist plans and Basileus executes, both as Claude sessions. Extractors and importers are versioned, tested code.
2. **The contract is the system.** Every file is an envelope with a versioned schema. Consumers read files, never internals.
3. **Only Basileus changes game state,** only on approved steps, within its policy. Extractors only read, on a click, at a human pace.
4. **Closed loop.** Orders → executed (by the player or Basileus) → next snapshot → diff against the orders and the prediction → calibration.
5. **Discover, don't guess.** Unknown responses are captured as structure-only `diag`, and parsers are fixed from real data.

## Components

| Component | Kind | Reads | Writes |
|---|---|---|---|
| Mayor | bookmarklet | own towns, own islands | `mayor.snapshot.v1` |
| Cartographer · game | bookmarklet | world-map area, island views | `cartographer.map.v1` |
| Cartographer · ikadatos | bookmarklet on ikadatos.com | island, inactive and player pages | `cartographer.map.v1` (`source: ikadatos`) |
| Spymaster | bookmarklet | Hideout reports, target town + island | `spymaster.reports.v1` |
| Military history, transports, … | bookmarklets (planned) | combat reports, movements | one schema each |
| AtlasImporter | Apps Script | `inbox/*.json` | one spreadsheet per subsystem; moves files to `data/<subsystem>/` |
| Strategist | Claude session + `strategist/engine` | store + doctrine | `strategist.orders.v1` (steps may carry `exec`) |
| Basileus | Claude session + Claude in Chrome | approved steps, live game state (Mayor read in the tab) | game actions, `basileus.journal.v1` |

## Store layout (Drive)

```
Agentic Development/
  inbox/            bookmarklet downloads (browser download folder → Drive for desktop)
  data/<subsystem>/ processed files (importer) and Basileus journals
  orders/           strategist.orders.v1
  doctrine.md       goals, constraints, preferences
```

File name: `<schema-prefix>_<server>_<YYYYMMDD-HHmm>[_<tag>].json`. Envelope: `schema`, `producedAt`, `producer`, `server`, `player`, `scope`, `diag`, `payload`. A breaking change gets a new major version; consumers support N and N−1.

## Plan

| Phase | Content | Status / done when |
|---|---|---|
| 0 Contracts | envelope + schemas, repo, tests, doctrine template | ✓ 24 Nov |
| 1 Mayor v0.2 | envelope + download, island-read fix | a real file validates with island levels |
| 2 Spymaster + importer | reports → Farmeos (targets + Historial) | a real run updates Farmeos correctly |
| 3 Cartographer | game area + filters; ikadatos page/island adapter | validated files from both sources; ikadatos data URLs discovered |
| 4 Strategist v1 | protocol, orders with `exec`, diff/calibration | one full loop with an error report |
| B0 Basileus contract | exec blocks, journal, policy, playbook, skill | ✓ 24 Nov |
| B1 Basileus dry runs | supervised, one per action, UI-NOTES filled | all four actions reach the confirm control correctly |
| B2 Basileus live, on demand | approved in chat, watched | 10 steps done, 0 wrong actions |
| B3 Basileus scheduled | set times / interval carrying approved steps | a week of clean journals |
| B4 Standing tasks | e.g. keep build queues busy, within caps | the player enables it explicitly |
| 5 More exporters | military history, transports → their own spreadsheets | one importer handler each |

**Blocking now:**
- the Claude in Chrome extension must be connected (Basileus, and faster ikadatos access)
- first real runs of the Mayor, Spymaster and Cartographer bookmarklets

## Evals
- **Extractors:** fixture tests, and real-run `diag` being empty.
- **Importer:** pure-function tests against the real sheet layout.
- **Strategist:** prediction error per town against the next snapshot.
- **Basileus:** journals show 0 actions outside approval; the next snapshot confirms every `done` step.
