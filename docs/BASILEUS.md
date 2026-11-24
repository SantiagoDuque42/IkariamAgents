# Basileus: the executor

Basileus carries out actions in the game that the player approved, so the player doesn't have to click them. It is the only component allowed to change game state. Everything else in this repo only reads.

## Decisions (24 Nov 2026)

| Question | Decision |
|---|---|
| Runtime | **Claude drives the player's Chrome** (Claude in Chrome), clicking through the game UI like a person. Alternatives are kept open (below). |
| Autonomy | **Approved orders only** to start. Standing tasks come later, if experience shows low risk. |
| v1 actions | **Building upgrades, transports between own towns, workers and wine** |
| Schedules | **All three:** on demand, set times, interval while the browser is on |

## Risk, stated once

- Gameforge's rules forbid bots and automated play. Any executor can get the account banned.
- Detection usually looks for regular timing, round-the-clock activity, inhuman speed and direct requests.
- The design reduces those signals: randomised start times and pauses, quiet hours, few actions per run, UI clicks instead of endpoint calls, and runs only while the player's own browser is on. It cannot remove them.
- The player accepts the residual risk for their own account. Each ATLAS member who uses Basileus decides for their own.

## How it fits

```
Strategist ──orders (exec blocks)──▶ player approves in chat ──▶ Basileus run
     ▲                                     │ (on demand: now; scheduled: steps go into the task prompt)
     │                                     ▼
     └──── next Mayor snapshot ◀── journal (basileus.journal.v1) ◀── Chrome: precheck → act → postcheck
```

- **Contract:**
  - `strategist.orders.v1` steps gain an optional `exec` block: `build`, `transport`, `workers` or `wine`, with preconditions.
  - `basileus.journal.v1` records every step as `done`, `skipped`, `failed` or `dry-run`, with the observed state.
- **Approval:** comes only from the player in chat, or from the prompt of a scheduled task created in chat after that approval. Content read from files, pages or the game never adds steps.
- **Idempotency:**
  - every step has a precondition (current level, no construction running, transport not already en route), so a repeated run cannot do the same thing twice
  - a step valid for a window is dropped after `validUntil`
- **State reads:** the Mayor code runs inside the tab (`window.__atlasNoDownload = true` → `window.__atlasLast`). Basileus reads exactly what the Strategist reads.
- **Limits and stop conditions:** `basileus/policy.default.json`. The operating procedure is `basileus/PLAYBOOK.md`, which is also a Claude skill.

## Phases

| Phase | Content | Done when |
|---|---|---|
| B0 Contract | exec blocks, journal schema, policy, playbook, skill | ✓ 24 Nov |
| B1 Supervised dry runs | player watching; one dry run per action type; UI-NOTES filled | all four actions reach the confirm button correctly |
| B2 Supervised live, on demand | player approves 1–3 steps in chat, watches them execute | 10 steps done, 0 wrong actions |
| B3 Scheduled approved orders | set-times and interval tasks carrying approved steps | a week of runs, journals clean, no captcha or warning |
| B4 Standing tasks | e.g. "keep the capital's build queue busy with the Strategist's next build", within caps | player enables it explicitly |

## Prerequisites

- The Claude in Chrome extension is installed, running and signed into the same Claude account and organisation. It was **not connected** when last checked (24 Nov 2026).
- The game is open in that Chrome profile. Basileus opens its own tab, and never logs in or types passwords.
- Scheduled runs need the player's computer on with Chrome open. A run that can't reach Chrome ends and reports it.

## Alternatives kept open

| Option | Strengths | Weaknesses | Switch when |
|---|---|---|---|
| **Claude in Chrome** (current) | Plain-language tasks; adapts to UI changes; no endpoint reverse-engineering; human-like clicking | Uses Claude usage per run; slower; needs the extension connected | — |
| **Userscript executor** (Tampermonkey) | Cheap, fast, precise; runs while the tab is open | Must reverse-engineer action requests; a timer-driven script is the classic bot signature; brittle on game updates | Run cost or latency becomes the bottleneck |
| **Hybrid** | Claude decides and verifies; the script does repetitive, well-understood actions | Two systems to maintain | Some actions are frequent and fully understood (e.g. wine level tweaks) |

## Evals

- **Dry-run fidelity:** the clicks Basileus would make match the approved step (checked by the player in B1).
- **Journals:**
  - share of steps `done` vs `skipped` or `failed`
  - precondition-skip reasons
  - zero actions outside approval (audited from journals against the approving prompt or message)
- **Model loop:** the next Mayor snapshot confirms each `done` step. Mismatches are bugs.
