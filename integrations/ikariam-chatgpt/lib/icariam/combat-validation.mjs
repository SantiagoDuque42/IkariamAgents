import { COMBAT_MODEL_VERSION, simulateCombat } from './combat.mjs';

const winners = new Set(['attack', 'defense', 'draw']);
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Compare a frozen scenario with a complete report at exactly the same round.
 * Partial reports never fill absent unit counts with zero. No parameter fitting.
 */
export function compareBattleReport({ scenario, observed, provenance }) {
  if (!scenario || !['land','naval'].includes(scenario.mode) || scenario.sides?.length !== 2)
    throw new Error('invalid_scenario');
  const allowed = new Set(['mode','units','sides','fieldLevel','wallLevel','wallStats','maxRounds','seed']);
  if (Object.keys(scenario).some((key) => !allowed.has(key))) throw new Error('unmodelled_scenario_field');
  for (const side of scenario.sides) {
    if (!side.army || Object.keys(side.army).length > 40
        || Object.values(side.army).some((n) => !count(n) || n > 100000)) throw new Error('invalid_scenario_counts');
  }
  if (!provenance || !['real_game','synthetic'].includes(provenance.datasetType)
      || !['development','holdout'].includes(provenance.partition)
      || !provenance.gameVersion || !provenance.source || !provenance.world
      || !['live','pts'].includes(provenance.environment)
      || !Number.isFinite(Date.parse(provenance.observedAt))
      || !/^[a-f0-9]{64}$/.test(provenance.catalogSha256 ?? '')) throw new Error('incomplete_provenance');
  if (!observed || !Number.isSafeInteger(observed.round) || observed.round < 1
      || observed.round > 70 || observed.remaining?.length !== 2) throw new Error('invalid_observed_round');
  const result = simulateCombat({ ...scenario, maxRounds: observed.round });
  const barbarian = scenario.sides.some((s) => Object.keys(s.army).some((id) =>
    s.army[id] > 0 && scenario.units?.some((unit) => unit.id === id && unit.faction === 'barbarian')));
  const opponentType = barbarian ? 'barbarian' : 'regular';
  if (result.excluded.some((units) => Object.keys(units).length)) throw new Error('unsupported_scenario_units');
  const atRound = result.rounds.find((r) => r.number === observed.round);
  if (!atRound) return { comparable: false, reason: 'model_ended_before_observation',
    mode: scenario.mode, opponentType, modelVersion: COMBAT_MODEL_VERSION, modelRounds: result.rounds.length, provenance };
  const absoluteErrors = [], bySide = [];
  for (const i of [0,1]) {
    const initial = scenario.sides[i].army;
    const seen = observed.remaining[i];
    if (!seen || typeof seen !== 'object' || Array.isArray(seen)) throw new Error('invalid_report_counts');
    const ids = Object.keys(initial);
    if (ids.some((id) => !Object.hasOwn(seen, id))
        || Object.keys(seen).some((id) => !Object.hasOwn(initial, id))) throw new Error('partial_report_counts');
    const errors = {};
    for (const id of ids) {
      if (!count(initial[id]) || !count(seen[id]) || seen[id] > initial[id]) throw new Error('invalid_report_counts');
      const predicted = atRound.sides[i].remaining[id] ?? 0;
      errors[id] = { predicted, observed: seen[id], error: predicted - seen[id] };
      absoluteErrors.push(Math.abs(predicted - seen[id]));
    }
    bySide.push(errors);
  }
  if (observed.winner !== undefined && !winners.has(observed.winner)) throw new Error('invalid_report_winner');
  // A round-limited draw is censored, not an observed end of combat.
  const terminal = observed.terminal === true;
  return { comparable: true, mode: scenario.mode, opponentType, modelVersion: COMBAT_MODEL_VERSION, atRound: observed.round,
    remainingUnitsMAE: mean(absoluteErrors), comparedUnitTypes: absoluteErrors.length,
    outcomeAgreement: terminal && observed.winner && result.winner !== 'draw'
      ? result.winner === observed.winner : null,
    bySide, provenance };
}

/** Report separate strata; synthetic tests cannot certify live-game fidelity. */
export function reviewCombatReports(cases) {
  const seen = new Set();
  const partitions = new Map();
  const rows = cases.map((item) => {
    if (!item.id || seen.has(item.id)) throw new Error('duplicate_or_missing_report_id');
    seen.add(item.id);
    const p = item.provenance;
    if (p) {
      const origin = [p.source,p.world,p.gameVersion,p.environment].join(':');
      if (partitions.has(origin) && partitions.get(origin) !== p.partition)
        throw new Error('development_holdout_leak');
      partitions.set(origin,p.partition);
    }
    return { id: item.id, ...compareBattleReport(item) };
  });
  const strata = {};
  for (const row of rows) {
    const p = row.provenance;
    const key = [row.mode,row.opponentType,p.datasetType,p.partition,p.gameVersion,p.environment,p.world,p.catalogSha256].join(':');
    const group = strata[key] ??= { cases: 0, comparable: 0, remainingUnitsMAE: null, errors: [] };
    group.cases++;
    if (row.comparable) { group.comparable++; group.errors.push(row.remainingUnitsMAE); }
  }
  for (const group of Object.values(strata)) {
    group.remainingUnitsMAE = mean(group.errors); delete group.errors;
  }
  const holdouts = rows.filter((r) => r.comparable && r.provenance.datasetType === 'real_game'
    && r.provenance.partition === 'holdout' && r.provenance.environment === 'live');
  return { modelVersion: COMBAT_MODEL_VERSION, reports: rows, strata,
    realLiveHoldoutCases: holdouts.length,
    fidelityStatus: holdouts.length ? 'measured_on_supplied_reports' : 'not_validated_against_real_holdouts' };
}
