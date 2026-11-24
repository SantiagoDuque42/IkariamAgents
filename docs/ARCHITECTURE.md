# Architecture (v0.2, 24 Nov 2026)

## Decisions
- **Purpose:** a real agent architecture that is also usable every day.
- **Audience:** built for one player, reusable by the alliance through the shared Drive.
- **Data flow:** bookmarklets download files into the Drive-synced `inbox/`.
- **Map sources:** the in-game map and ikadatos.
- **Code:** this public repo, with no real data in it. Data lives in the private Drive folder `IKARIAM [ATLAS]/Agentic Development`.
- **Writing to the alliance sheets:** an Apps Script importer that runs with the player's own permissions. Claude's Drive connector reports these sheets as not editable.

## Principles
1. **One agent, many tools.** Only the Strategist reasons. Extractors and importers are deterministic, versioned and tested.
2. **The contract is the system.** Every file is an envelope with a versioned schema. Consumers read files, never internals.
3. **The human executes.** Tools read only, on a click, at a human pace. The Strategist's output is a click list.
4. **Closed loop.** Orders → executed → next snapshot → diff against the orders and against the prediction → calibration.
5. **Discover, don't guess.** Unknown responses are captured as structure-only `diag` and the parser is fixed from real data.

## Components

| Subsystem | Kind | Reads | Writes |
|---|---|---|---|
| Mayor | bookmarklet | own towns (`cityMilitary`, `city`), own islands (`island`) | `mayor.snapshot.v1` |
| Cartographer (game) | bookmarklet | world map area, island views | `cartographer.map.v1` |
| Cartographer (ikadatos) | bookmarklet on ikadatos page (planned) | ikadatos map/rankings | `cartographer.map.v1` |
| Spymaster | bookmarklet | Hideout reports (`safehouse`), target town + island views | `spymaster.reports.v1` |
| Military history, transports, … | bookmarklets (planned) | combat reports, trade/transport views | one schema each |
| AtlasImporter | Apps Script | `inbox/*.json` | Google Sheets (Farmeos: "Hoja 1" + "Historial"), moves files to `data/<subsystem>/` |
| Strategist | Claude session + `strategist/engine` | store + doctrine | `strategist.orders.v1` |

## Store layout (Drive: `IKARIAM [ATLAS]/Agentic Development/`)

```
inbox/                 bookmarklet downloads land here (browser download folder → Drive for desktop)
data/mayor/ …          files moved here by the importer (or by Claude) after processing
data/spymaster/ …
orders/                strategist.orders.v1 files
doctrine.md            goals, constraints, preferences (template in strategist/)
```

File name: `<schema-prefix>_<server>_<YYYYMMDD-HHmm>[_<tag>].json`.

## Envelope

```json
{ "schema": "mayor.snapshot.v1", "producedAt": "…Z", "producer": "mayor@0.2.0",
  "server": "s74-es", "player": "…", "scope": {}, "diag": {}, "payload": {} }
```

- A breaking payload change gets a new major version. Consumers support N and N−1.
- `diag` holds key names, types and array lengths only.

## Phases

| Phase | Content | Done when |
|---|---|---|
| 0 Contracts | envelope + schemas, repo, tests, doctrine template | ✓ 24 Nov |
| 1 Mayor v0.2 | envelope + download, island read fix | a real file passes validation with island levels |
| 2 Spymaster v0.1 + importer | reports → Farmeos | a real run updates Farmeos correctly |
| 3 Cartographer v0.1 | game area + filter; then ikadatos adapter | "wine islands in a box with free spots" returns a validated file |
| 4 Strategist v1 | protocol, orders, diff/calibration | one full loop: orders → executed → snapshot → diff report |
| 5 More exporters | military history, transports, … | — |

## Evals
- Extractors: fixture tests, plus real-run `diag` being empty.
- Importer: pure-function tests against the real sheet layout.
- Strategist: prediction error (simulated vs. next real snapshot) per town, tracked over time.
