# Strategist protocol

The Strategist is a Claude session: chat in the "Ikariam" project, or Claude Code in this repo. It is the only point of contact with the player. Each session runs these steps:

1. **Load the doctrine.** Read `doctrine.md` from the Drive folder `Agentic Development` (template: `doctrine.template.md`). It holds goals, horizons, constraints and standing preferences, and it changes only when the player says so.
2. **Load the state.** Take the newest `mayor.snapshot.v1` from `data/mayor/` (or `inbox/`), plus any `cartographer.map.v1` and `spymaster.reports.v1` the question needs. Validate them with `tools/validate.py`. If the snapshot is older than 12 h, say so and ask for a fresh one before planning moves.
3. **Close the loop.** Compare the snapshot with the last `strategist.orders.v1`:
   - which steps were done, skipped or deviated
   - how far the engine's prediction (`expected`) was from reality, per town population and production
   
   Report this briefly, and keep the error log for calibration.
4. **Simulate.** Use `strategist/engine/engine.js` (`simulate`, `candidates`, `equilibrium`, `routes`) on the state built from the snapshot. Compare scenarios by robust patterns: the greedy simulator moves ±1–2% on small input changes.
5. **Emit orders.** Write a `strategist.orders.v1` with `basis` pointing at the files used. Per town, give the exact clicks in order (build, allocate, wine level, transports, trader), each with `why`. Add `expected` checkpoints for step 3 of the next session. Save it to `Agentic Development/orders/` and show it as a short click list.
6. **The player executes**, clicks the Mayor, and the loop restarts.

Never execute anything in the game, and never suggest tools that do.
