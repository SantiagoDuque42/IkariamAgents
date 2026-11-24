# Mechanics model: formulas and sources

The engine (`strategist/engine/engine.js`) uses the formulas below.

| Quantity | Formula | Verified |
|---|---|---|
| Housing | 2·⌊10·L^1.5⌋ + 40 (Town Hall L ≤ 40), + 50 Holiday, + 50 capital Well Digging, + 200 capital Utopia, + 20 per Economic Future | yes, 5 towns (Nov 2026) |
| Satisfaction | (196 + 25 Holiday + 50 capital + tavern table + wine-served table + museum table + 50/cultural good + government) × (1 − corruption) | populations within ~20 |
| Growth | P(t) = S − (S − P₀)·e^(−t/50), capped at housing | — |
| Wine use | table[serving level] × (1 − Wine Press level %) | yes, 5 towns (`tests/engine.test.mjs`) |
| Production | 1/worker/h × (1 + 2%/bonus-building level + 20% item + blessing); Helping Hands +50% workers at ¼ | — |
| Costs | base × (1 − 14% research − reducer level %), reducer ≤ 50 | yes, Town Hall 19→20 |
| Corruption | 1 − (residence level + 1)/towns; the capital is exempt while Palace ≥ colonies | — |
| Safe resources | 100 + 480·Σwarehouse levels per resource (inactive: 15 + 80·Σ) | matches one ATLAS report |

## Sources
- Building costs: in-game Help, scraped by IkaEasy (`tools/gen-costs.mjs`, github.com/RandGor/IkaEasy).
- Housing, satisfaction, wine and museum tables, build times: Ikariam Empire Overview userscript (github.com/oliezekat/IkariamEmpireOverview).
- Island worker caps: "Donation Table" thread, official Ikariam forum.
- Research, Gods' Shrine, Helping Hands: ikariam.fandom.com.
- Spy report markup and safe formula: IkaEasy `js/page/tpl/safehouse.js`.
