'use client';

import { ChevronLeft, ChevronRight, CircleHelp, Play, Plus, RotateCcw, Shield, Ship, Swords, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { battlefield, garrisonLimit, simulateCombat } from '../../lib/icariam/combat.mjs';
import './combat.css';

export type CombatMode = 'land' | 'naval';
type Role = 'front' | 'flank' | 'ranged' | 'artillery' | 'air' | 'antiAir' | 'healer' | 'morale' | 'wall' | 'reserve';
type SideIndex = 0 | 1;
type Deployments = Partial<Record<Role, Record<string, number>>>;
type CountMap = Record<string, number>;
type Weapon = {
  name?: string;
  damage?: number | null;
  accuracy?: number | null;
  ammo?: number | null;
};

export type BattleUnit = {
  id: string;
  name: string;
  role: string;
  damage: number | null;
  armor: number | null;
  hp: number | null;
  accuracy: number | null;
  ammo: number | null;
  size: number | null;
  source?: string | string[];
  sourceCrosscheck?: string;
  sourceSupport?: string;
  sourceHealingUpdate?: string;
  faction?: string;
  estimate?: boolean;
  estimated?: boolean;
  supportEstimate?: boolean;
  note?: string;
  weapons?: Weapon[] | Record<string, Weapon>;
};
export type CombatCatalog = Record<CombatMode, BattleUnit[]>;
type Workshop = { weapon?: number; defense?: number };
type WallStats = { hp?: number; armor?: number; damage?: number };
type ExampleSide = Workshop & { army: CountMap; forge?: number; upgrades?: Record<string, Workshop> };
export type CombatExample = {
  id: string;
  title: string;
  mode: CombatMode;
  description: string;
  source?: string;
  observed?: string;
  fieldLevel?: number;
  wallLevel?: number;
  wallStats?: WallStats;
  maxRounds?: number;
  seed?: number;
  sides: [ExampleSide, ExampleSide];
};

type EditableSide = Omit<Required<ExampleSide>, 'army'> & { army: Record<string, string> };
type RoundSide = { losses: CountMap; remaining: CountMap; morale: number; formations?: Deployments; ammo?: CountMap };
type CombatRound = { number: number; sides: [RoundSide, RoundSide]; wallRemaining?: number; openField?: boolean };
type CombatResult = {
  winner: 'attack' | 'defense' | 'draw';
  reason: string;
  rounds: CombatRound[];
  roundMinutes?: number;
  sides: [RoundSide, RoundSide];
  warnings?: string[];
  excluded?: [CountMap, CountMap];
};
type Arena = {
  fieldLevel: number;
  wallLevel: number;
  wallStats: WallStats;
  maxRounds: number;
  seed: number;
  sides: [EditableSide, EditableSide];
  result: CombatResult | null;
  round: number;
  example: CombatExample | null;
  error: string;
};

const ROLES: Role[] = ['front', 'flank', 'ranged', 'artillery', 'air', 'antiAir', 'healer', 'morale', 'wall', 'reserve'];
const ROLE_LABEL: Record<Role, string> = {
  front: 'Primera línea',
  flank: 'Flancos',
  ranged: 'Larga distancia',
  artillery: 'Artillería',
  air: 'Bombardeo',
  antiAir: 'Defensa aérea',
  healer: 'Curación y apoyo',
  morale: 'Apoyo de moral',
  wall: 'Muralla',
  reserve: 'Reserva',
};
const SIDES = ['Atacante', 'Defensor'] as const;
const n = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const format = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : n.format(value);
const bounded = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, Number.isFinite(value) ? Math.trunc(value) : lower));
const counts = (side: EditableSide): CountMap => Object.fromEntries(Object.entries(side.army)
  .map(([id, quantity]) => [id, bounded(Number(quantity), 0, 100000)] as const).filter(([, quantity]) => quantity > 0));
const total = (army: CountMap) => Object.values(army).reduce((sum, count) => sum + count, 0);
const roleOf = (value: string): Role => ROLES.includes(value as Role) ? value as Role : 'reserve';
const isExternal = (url: string) => /^https?:\/\//i.test(url);
const isBarbarian = (unit: BattleUnit) => /barbar|bárbar/i.test(unit.faction ?? '') || /^barbarian[-_]/.test(unit.id);
const accuracy = (value: number | null | undefined) => value == null ? '—' : format(value <= 1 ? value * 100 : value) + ' %';

function initialArena(mode: CombatMode): Arena {
  return {
    fieldLevel: mode === 'land' ? 17 : 22,
    wallLevel: 0,
    wallStats: {},
    maxRounds: 30,
    seed: 1,
    sides: [{ army: {}, weapon: 0, defense: 0, forge: 0, upgrades: {} }, { army: {}, weapon: 0, defense: 0, forge: 0, upgrades: {} }],
    result: null,
    round: 0,
    example: null,
    error: '',
  };
}

function syntheticExample(mode: CombatMode, units: BattleUnit[]): CombatExample {
  const combatants = units.filter((unit) => !isBarbarian(unit));
  function army(strength: number, supports: number): CountMap {
    const entries: [Role, number][] = [
      ['front', strength], ['ranged', Math.floor(strength / 2)], ['flank', Math.floor(strength / 3)],
      ['artillery', Math.floor(strength / 12)], ['morale', supports],
    ];
    return Object.fromEntries(entries.flatMap(([role, quantity]) => {
      const unit = combatants.find((candidate) => candidate.role === role);
      return unit && quantity ? [[unit.id, quantity]] : [];
    }));
  }
  return {
    id: 'demo-' + mode,
    mode,
    title: mode === 'land' ? 'Asedio de ejemplo' : 'Encuentro naval de ejemplo',
    description: 'Composición hipotética para explorar el campo y el desglose de las rondas.',
    fieldLevel: mode === 'land' ? 17 : 22,
    wallLevel: mode === 'land' ? 8 : 0,
    sides: mode === 'land' ? [{ army: army(144, 16) }, { army: army(110, 10) }]
      : [{ army: army(54, 8) }, { army: army(44, 6) }],
  };
}

type NumericProps = { id: string; label: string; min: number; max: number };
type NumericValue =
  | { optional?: false; value: number; onChange: (value: number) => void }
  | { optional: true; value?: number; onChange: (value: number | undefined) => void; placeholder?: string };
function NumberField(props: NumericProps & NumericValue) {
  const { id, label, value, min, max } = props;
  return <label className="field" htmlFor={id}><span>{label}</span>
    <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value ?? ''}
      placeholder={props.optional ? props.placeholder : undefined}
      onChange={(event) => {
        const entered = event.target.value;
        if (props.optional && !entered) props.onChange(undefined);
        else props.onChange(bounded(Number(entered), min, max));
      }} />
  </label>;
}

function ArmyEditor({ side, mode, state, units, unitIndex, update }: {
  side: SideIndex; mode: CombatMode; state: EditableSide; units: BattleUnit[];
  unitIndex: Map<string, BattleUnit>; update: (side: EditableSide) => void;
}) {
  const [selection, setSelection] = useState('');
  const others = units.filter((unit) => unit.id !== 'muralla');
  const available = others.filter((unit) => !Object.hasOwn(state.army, unit.id));
  const core = available.filter((unit) => !isBarbarian(unit));
  const barbarians = available.filter(isBarbarian);
  const listId = 'combat-picker-' + side;
  const active = available.find((unit) => unit.id === selection);
  const entries = Object.entries(state.army).sort(([a], [b]) =>
    ROLES.indexOf(roleOf(unitIndex.get(a)?.role ?? 'reserve')) - ROLES.indexOf(roleOf(unitIndex.get(b)?.role ?? 'reserve')));
  const Icon = side === 0 ? Swords : Shield;
  const militaryWord = mode === 'naval' ? 'barcos' : 'unidades';

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    update({ ...state, army: { ...state.army, [active.id]: '1' } });
    setSelection('');
    requestAnimationFrame(() => document.getElementById('combat-quantity-' + side + '-' + active.id)?.focus());
  }

  function remove(id: string) {
    const army = { ...state.army };
    const upgrades = { ...state.upgrades };
    delete army[id];
    delete upgrades[id];
    update({ ...state, army, upgrades });
    document.getElementById(listId)?.focus();
  }

  return <section className={'panel combat-army combat-army-' + side} aria-labelledby={'combat-army-title-' + side}>
    <div className="combat-army-head">
      <span className="combat-emblem"><Icon size={23} aria-hidden="true" /></span>
      <div><h3 id={'combat-army-title-' + side}>{SIDES[side]}</h3>
        <p>{format(total(counts(state)))} {militaryWord}</p></div>
    </div>
    <form className="combat-add-row" onSubmit={add}>
      <label className="field">
        <span className="sr-only">Unidad del bando {SIDES[side].toLocaleLowerCase('es')}</span>
        <select id={listId} value={active?.id ?? ''} onChange={(event) => setSelection(event.target.value)}>
          <option value="">{available.length ? 'Elegir unidad' : 'Todas las unidades añadidas'}</option>
          {ROLES.map((role) => {
            const list = core.filter((unit) => roleOf(unit.role) === role);
            return list.length > 0 && <optgroup key={role} label={ROLE_LABEL[role]}>{list.map((unit) =>
              <option key={unit.id} value={unit.id}>{unit.name}</option>)}</optgroup>;
          })}
          {barbarians.length > 0 && <optgroup label="Bárbaros">{barbarians.map((unit) =>
            <option key={unit.id} value={unit.id}>{unit.name}</option>)}</optgroup>}
        </select>
      </label>
      <button className="button secondary" type="submit" disabled={!active}><Plus size={17} aria-hidden="true" />Añadir</button>
    </form>
    {entries.length > 0 ? <ul className="combat-unit-list">{entries.map(([id, quantity]) => {
      const unit = unitIndex.get(id);
      const name = unit?.name ?? id;
      const idInput = 'combat-quantity-' + side + '-' + id;
      return <li key={id}>
        <label htmlFor={idInput}><strong>{name}</strong><span>{ROLE_LABEL[roleOf(unit?.role ?? 'reserve')]}</span></label>
        <input id={idInput} aria-label={name + ', cantidad del bando ' + SIDES[side].toLocaleLowerCase('es')}
          value={quantity} type="number" inputMode="numeric" min={0} max={100000}
          onChange={(event) => {
            const raw = event.target.value;
            update({ ...state, army: { ...state.army, [id]: raw ? String(bounded(Number(raw), 0, 100000)) : '' } });
          }} />
        <button type="button" className="combat-remove" aria-label={'Quitar ' + name + ' del bando ' + SIDES[side].toLocaleLowerCase('es')} onClick={() => remove(id)}>
          <X size={17} aria-hidden="true" />
        </button>
      </li>;
    })}</ul> : <p className="combat-unit-empty">Añade las unidades de este bando.</p>}
    <details className="combat-upgrades">
      <summary>Mejoras y milagro</summary>
      <div className="combat-upgrade-grid">
        <NumberField id={'combat-weapon-' + side} label="Nivel de armamento" value={state.weapon} min={0} max={600} onChange={(weapon) => update({ ...state, weapon })} />
        <NumberField id={'combat-defense-' + side} label="Nivel de armadura" value={state.defense} min={0} max={600} onChange={(defense) => update({ ...state, defense })} />
        <label className="field"><span>Fragua de Hefesto</span>
          <select value={state.forge} onChange={(event) => update({ ...state, forge: Number(event.target.value) })}>
            <option value={0}>Desactivada</option>
            {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>Nivel {level}</option>)}
          </select>
        </label>
      </div>
      <p className="quiet">Valores de taller por defecto para este bando.</p>
      {entries.length > 0 && <details className="combat-unit-upgrades">
        <summary>Ajustes por unidad</summary>
        {entries.map(([id]) => {
          const upgrade = state.upgrades[id] ?? {};
          function change(key: keyof Workshop, value: number | undefined) {
            update({ ...state, upgrades: { ...state.upgrades, [id]: { ...upgrade, [key]: value } } });
          }
          return <fieldset key={id} className="combat-unit-workshop">
            <legend>{unitIndex.get(id)?.name ?? id}</legend>
            <div className="combat-upgrade-grid">
              <NumberField id={'combat-unit-weapon-' + side + '-' + id} label="Armamento" min={0} max={600}
                optional value={upgrade.weapon} placeholder={String(state.weapon)} onChange={(value) => change('weapon', value)} />
              <NumberField id={'combat-unit-defense-' + side + '-' + id} label="Armadura" min={0} max={600}
                optional value={upgrade.defense} placeholder={String(state.defense)} onChange={(value) => change('defense', value)} />
            </div>
          </fieldset>;
        })}
      </details>}
    </details>
  </section>;
}

function grouped(army: CountMap, lookup: Map<string, BattleUnit>): Deployments {
  const group: Deployments = {};
  for (const [id, count] of Object.entries(army)) {
    const role = roleOf(lookup.get(id)?.role ?? 'reserve');
    (group[role] ??= {})[id] = count;
  }
  return group;
}

function FormationCell({ units, unitIndex }: { units?: CountMap; unitIndex: Map<string, BattleUnit> }) {
  const entries = Object.entries(units ?? {}).filter(([, count]) => count > 0);
  if (!entries.length) return <span className="combat-none">Vacío</span>;
  return <ul>{entries.map(([id, count]) =>
    <li key={id}><strong>{format(count)}</strong><span>{unitIndex.get(id)?.name ?? (id === 'muralla' ? 'Muralla' : id)}</span></li>)}</ul>;
}

function Board({ mode, level, wall, round, initial, unitIndex }: {
  mode: CombatMode; level: number; wall: number; round?: CombatRound; initial: [CountMap, CountMap]; unitIndex: Map<string, BattleUnit>;
}) {
  const field = battlefield(mode, round?.openField ? 100 : level);
  const groups = initial.map((army, i) => round
    ? round.sides[i].formations ?? grouped(round.sides[i].remaining, unitIndex)
    : grouped(army, unitIndex));
  const lanes = field.lanes as Partial<Record<Role, { slots: number; capacity: number }>>;
  const battleRoles = [...ROLES.filter((role) => (lanes[role]?.slots ?? 0) > 0 || groups.some((group) => total(group[role] ?? {}) > 0))];
  return <section className="combat-board" aria-labelledby="combat-board-title">
    <div className="combat-board-head"><div><h3 id="combat-board-title">Campo de batalla</h3>
      <p>{round ? 'Inicio de la ronda ' + round.number : 'Composición inicial por línea'}</p></div>
      <span>{round?.openField ? 'Campo abierto' : field.label}</span>
    </div>
    <table className="combat-lines">
      <thead><tr><th scope="col">Atacante</th><th scope="col">Línea</th><th scope="col">Defensor</th></tr></thead>
      <tbody>{battleRoles.map((role) => <tr key={role}>
        <td><FormationCell units={groups[0][role]} unitIndex={unitIndex} /></td>
        <th scope="row">{ROLE_LABEL[role]}{(lanes[role]?.slots ?? 0) > 0 && <span>{format(lanes[role]?.slots)} huecos</span>}</th>
        <td><FormationCell units={groups[1][role]} unitIndex={unitIndex} /></td>
      </tr>)}</tbody>
    </table>
    {round?.wallRemaining != null && mode === 'land' && <p className="combat-board-note">Secciones intactas de muralla en esta ronda <strong>{format(round.wallRemaining)}</strong></p>}
    {!round && <p className="combat-board-note">Límite de guarnición del escenario <strong>{format(garrisonLimit(mode, level, wall))}</strong></p>}
  </section>;
}

function Forces({ side, units, unitIndex, lossesLabel }: {
  side: SideIndex; units: RoundSide; unitIndex: Map<string, BattleUnit>; lossesLabel: string;
}) {
  const rows = [...new Set([...Object.keys(units.losses), ...Object.keys(units.remaining), ...Object.keys(units.ammo ?? {})])]
    .filter((id) => units.losses[id] > 0 || units.remaining[id] > 0);
  const morale = bounded(units.morale, 0, 100);
  const hasAmmo = rows.some((id) => Number.isFinite(units.ammo?.[id]));
  return <article className={'combat-force-summary combat-summary-' + side}>
    <header><h4>{SIDES[side]}</h4><span>{morale} % de moral</span></header>
    <meter value={morale} min={0} max={100} aria-label={'Moral del bando ' + SIDES[side].toLocaleLowerCase('es')} />
    {rows.length > 0 ? <div className="combat-table-wrap"><table className="combat-stat-table">
      <thead><tr><th scope="col">Unidad</th><th scope="col">{lossesLabel}</th><th scope="col">Restan</th>
        {hasAmmo && <th scope="col" title="Munición restante estimada del grupo, incluida la reserva">Munición</th>}</tr></thead>
      <tbody>{rows.map((id) => <tr key={id}>
        <th scope="row">{unitIndex.get(id)?.name ?? id}</th>
        <td>{format(units.losses[id] ?? 0)}</td><td>{format(units.remaining[id] ?? 0)}</td>{hasAmmo && <td>{format(units.ammo?.[id])}</td>}
      </tr>)}</tbody>
    </table></div> : <p className="quiet">Sin unidades activas en el cálculo.</p>}
  </article>;
}

function BattleResults({ result, roundIndex, selectRound, units }: {
  result: CombatResult; roundIndex: number; selectRound: (round: number) => void; units: Map<string, BattleUnit>;
}) {
  const { rounds } = result;
  const current = rounds[roundIndex];
  const active = current?.sides ?? result.sides;
  const winner = result.winner === 'attack' ? 'Victoria atacante' : result.winner === 'defense' ? 'Victoria defensora' : 'Sin vencedor en la simulación';
  return <section className="panel combat-results" aria-labelledby="combat-result-title">
    <div className="card-head"><div>
      <p className="overline">Resultado estimado</p><h3 id="combat-result-title">{winner}</h3>
      <p>{result.reason}</p>
    </div><span className="chip">{format(rounds.length)} {rounds.length === 1 ? 'ronda' : 'rondas'}
      {rounds.length && result.roundMinutes ? ' · ' + format(rounds.length * result.roundMinutes) + ' min' : ''}</span></div>
    {!!result.warnings?.length && <ul className="combat-warning">{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
    <dl className="combat-result-totals">{result.sides.map((side, i) => <div key={i}>
      <dt>{SIDES[i]} · bajas totales</dt><dd>{format(total(side.losses))}</dd>
    </div>)}</dl>
    {current && <div className="combat-round-control">
      <button type="button" className="button secondary icon-button" aria-label="Ronda anterior" onClick={() => selectRound(roundIndex - 1)} disabled={roundIndex === 0}>
        <ChevronLeft size={19} aria-hidden="true" />
      </button>
      <label><span>Ronda {current.number} de {rounds.length}</span>
        <input type="range" min={0} max={Math.max(0, rounds.length - 1)} value={roundIndex} disabled={rounds.length < 2}
          onChange={(event) => selectRound(Number(event.target.value))} aria-valuetext={'Ronda ' + current.number + ' de ' + rounds.length} />
      </label>
      <button type="button" className="button secondary icon-button" aria-label="Ronda siguiente" onClick={() => selectRound(roundIndex + 1)} disabled={roundIndex >= rounds.length - 1}>
        <ChevronRight size={19} aria-hidden="true" />
      </button>
    </div>}
    <div className="combat-result-grid">{active.map((side, i) => <Forces key={SIDES[i]} side={i as SideIndex} units={side}
      unitIndex={units} lossesLabel={current ? 'Bajas en ronda' : 'Bajas totales'} />)}</div>
  </section>;
}

function UnitCatalog({ units, mode }: { units: BattleUnit[]; mode: CombatMode }) {
  const [query, setQuery] = useState('');
  const normalize = (value: string) => value.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const term = normalize(query.trim());
  const visible = units.filter((unit) => normalize(unit.name + ' ' + ROLE_LABEL[roleOf(unit.role)]).includes(term));
  return <details className="panel combat-catalog">
    <summary><CircleHelp size={19} aria-hidden="true" /><strong>Estadísticas y supuestos</strong></summary>
    <div className="combat-catalog-body">
      <p>Las estadísticas base se complementan con las mejoras que introduzcas. La asignación exacta del daño, la puntería y la pérdida de moral del servidor se aproximan. Compara los resultados con tus informes del juego.</p>
      <label className="field"><span>Buscar {mode === 'land' ? 'unidad' : 'barco'}</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Por nombre o línea" /></label>
      <div className="combat-table-wrap"><table className="combat-stat-table combat-catalog-table">
        <caption className="sr-only">Estadísticas base del catálogo {mode === 'land' ? 'terrestre' : 'naval'}</caption>
        <thead><tr><th scope="col">Unidad</th><th scope="col">Línea</th><th scope="col">Vida</th><th scope="col">Daño</th><th scope="col">Armadura</th>
          <th scope="col">Puntería</th><th scope="col">Munición</th><th scope="col">Tamaño</th><th scope="col">Fuente</th></tr></thead>
        <tbody>{visible.map((unit) => {
          const sources = [...new Set([
            ...(typeof unit.source === 'string' ? [unit.source] : unit.source ?? []),
            unit.sourceCrosscheck, unit.sourceSupport, unit.sourceHealingUpdate,
          ].filter((source): source is string => !!source && isExternal(source)))];
          const alternatives = Object.values(unit.weapons ?? {}).slice(1);
          const estimate = unit.estimate || unit.estimated || unit.supportEstimate;
          return <tr key={unit.id}><th scope="row">{unit.name}
            {estimate && <small>{unit.note ?? 'Parámetros de apoyo estimados.'}</small>}
            {alternatives.length > 0 && <details className="combat-weapons"><summary>Armas alternativas</summary>
              {alternatives.map((weapon, i) => <small key={i}>{weapon.name ? weapon.name + ' · ' : ''}{format(weapon.damage)} de daño
                {' · ' + accuracy(weapon.accuracy)} de puntería{' · ' + (weapon.ammo == null ? 'munición ilimitada' : format(weapon.ammo) + ' disparos')}</small>)}
            </details>}
          </th><td>{ROLE_LABEL[roleOf(unit.role)]}</td><td>{format(unit.hp)}</td>
            <td>{format(unit.damage)}</td><td>{format(unit.armor)}</td><td>{accuracy(unit.accuracy)}</td>
            <td>{unit.ammo == null ? (unit.damage != null && unit.damage > 0 ? 'Sin límite' : '—') : format(unit.ammo)}</td><td>{format(unit.size)}</td>
            <td>{sources.length ? sources.map((source, i) => <a className="text-link" href={source} key={source}
              target="_blank" rel="noopener noreferrer" aria-label={'Fuente ' + (i + 1) + ' sobre ' + unit.name}>{i ? 'Más' : 'Ver'}</a>) : '—'}</td></tr>;
        })}</tbody>
      </table></div>
      {!visible.length && <p className="quiet">Ninguna unidad coincide con la búsqueda.</p>}
    </div>
  </details>;
}

function loadExample(example: CombatExample, units: Map<string, BattleUnit>): Arena {
  const start = initialArena(example.mode);
  const unknown = [...new Set(example.sides.flatMap((side) => Object.keys(side.army).filter((id) => !units.has(id))))];
  function edit(side: ExampleSide): EditableSide {
    return {
      army: Object.fromEntries(Object.entries(side.army).filter(([id, value]) => units.has(id) && value > 0)
        .map(([id, value]) => [id, String(bounded(value, 0, 100000))])),
      weapon: bounded(side.weapon ?? 0, 0, 600),
      defense: bounded(side.defense ?? 0, 0, 600),
      forge: bounded(side.forge ?? 0, 0, 5),
      upgrades: side.upgrades ?? {},
    };
  }
  return {
    ...start,
    fieldLevel: bounded(example.fieldLevel ?? start.fieldLevel, example.mode === 'land' ? 1 : 0, 100),
    wallLevel: bounded(example.wallLevel ?? start.wallLevel, 0, 100),
    wallStats: example.wallStats ?? {},
    maxRounds: bounded(example.maxRounds ?? start.maxRounds, 1, 70),
    seed: bounded(example.seed ?? start.seed, 0, 4294967295),
    example,
    sides: [edit(example.sides[0]), edit(example.sides[1])],
    error: unknown.length ? 'Comprueba el catálogo de este escenario. ' + unknown.join(', ') + '.' : '',
  };
}

export function Combat({ units, examples = [] }: { units: CombatCatalog; examples?: CombatExample[] }) {
  const [mode, setMode] = useState<CombatMode>('land');
  const [arenas, setArenas] = useState(() => ({ land: initialArena('land'), naval: initialArena('naval') }));
  const arena = arenas[mode];
  const currentUnits = units[mode];
  const unitIndex = useMemo(() => new Map(currentUnits.map((unit) => [unit.id, unit])), [currentUnits]);
  const options = [...examples.filter((example) => example.mode === mode), syntheticExample(mode, currentUnits)];
  const initial: [CountMap, CountMap] = [counts(arena.sides[0]), counts(arena.sides[1])];
  const canRun = total(initial[0]) > 0 && (total(initial[1]) > 0 || (mode === 'land' && arena.wallLevel > 0));
  const currentRound = arena.result?.rounds[arena.round];

  function replace(patch: Partial<Arena>) {
    setArenas((old) => ({ ...old, [mode]: { ...old[mode], ...patch } }));
  }
  function edit(patch: Partial<Arena>) {
    replace({ ...patch, result: null, round: 0, error: '' });
  }
  function changeSide(i: SideIndex, side: EditableSide) {
    const sides: [EditableSide, EditableSide] = [...arena.sides];
    sides[i] = side;
    edit({ sides });
  }
  function run() {
    if (!canRun) return;
    try {
      const [left, right] = arena.sides;
      const result = simulateCombat({
        mode,
        units: currentUnits,
        sides: [{ ...left, army: initial[0] }, { ...right, army: initial[1] }],
        fieldLevel: arena.fieldLevel,
        wallLevel: mode === 'land' ? arena.wallLevel : 0,
        wallStats: mode === 'land' ? arena.wallStats : undefined,
        maxRounds: arena.maxRounds,
        seed: arena.seed,
      }) as unknown as CombatResult;
      replace({ result, round: 0, error: '' });
      requestAnimationFrame(() => document.getElementById('combat-result-title')?.scrollIntoView({ block: 'nearest' }));
    } catch (error) {
      replace({ result: null, round: 0, error: error instanceof Error ? error.message : 'Ha fallado el cálculo de este escenario.' });
    }
  }

  return <div className="combat-workbench">
    <section className="hero-dash combat-hero">
      <div><h1>Simulador de combate</h1><p className="hero-intro">Configura los dos bandos y compara el despliegue, la moral y las bajas por ronda.</p></div>
      <div className="combat-mode" role="group" aria-label="Tipo de batalla">
        <button type="button" aria-pressed={mode === 'land'} onClick={() => setMode('land')}><Swords size={18} aria-hidden="true" />Terrestre</button>
        <button type="button" aria-pressed={mode === 'naval'} onClick={() => setMode('naval')}><Ship size={18} aria-hidden="true" />Naval</button>
      </div>
    </section>

    <section className="panel combat-settings" aria-label="Parámetros del combate">
      <div className="combat-settings-main">
        <NumberField id="combat-field-level" label={mode === 'land' ? 'Intendencia' : 'Mayor nivel de puerto o astillero'}
          value={arena.fieldLevel} min={mode === 'land' ? 1 : 0} max={100} onChange={(fieldLevel) => edit({ fieldLevel })} />
        {mode === 'land' && <NumberField id="combat-wall-level" label="Muralla del defensor" value={arena.wallLevel}
          min={0} max={100} onChange={(wallLevel) => edit({ wallLevel })} />}
        <label className="field"><span>Cargar un escenario</span>
          <select value={arena.example?.id ?? ''} onChange={(event) => {
            const choice = options.find((option) => option.id === event.target.value);
            if (choice) replace(loadExample(choice, unitIndex));
          }}>
            <option value="">Seleccionar un escenario</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </label>
        <button type="button" className="button secondary combat-reset" onClick={() => replace(initialArena(mode))}>
          <RotateCcw size={17} aria-hidden="true" />Reiniciar
        </button>
      </div>
      {arena.example && <p className="quiet combat-example-description">{arena.example.description}
        {arena.example.observed && <> {arena.example.observed}</>}
        {arena.example.source && isExternal(arena.example.source) && <> <a className="text-link"
          href={arena.example.source} target="_blank" rel="noopener noreferrer">Consultar el informe</a></>}
      </p>}
      <details className="combat-run-settings">
        <summary>Ajustes de simulación</summary>
        <div className="combat-upgrade-grid">
          <NumberField id="combat-max-rounds" label="Máximo de rondas" value={arena.maxRounds} min={1} max={70}
            onChange={(maxRounds) => edit({ maxRounds })} />
          <NumberField id="combat-seed" label="Semilla de la simulación" value={arena.seed} min={0} max={4294967295}
            onChange={(seed) => edit({ seed })} />
        </div>
        <p className="quiet">Mantén la semilla para repetir el resultado. Cámbiala para comparar otra distribución del daño.</p>
        {mode === 'land' && arena.wallLevel > 0 && <fieldset className="combat-unit-workshop">
          <legend>Estadísticas por sección de muralla</legend>
          <div className="combat-upgrade-grid">
            {([['hp', 'Puntos de vida', 1], ['armor', 'Armadura', 0], ['damage', 'Daño', 0]] as const).map(([stat, label, min]) =>
              <NumberField key={stat} id={'combat-wall-' + stat} label={label} min={min} max={10000000}
                optional value={arena.wallStats[stat]} placeholder="Estimación"
                onChange={(value) => edit({ wallStats: { ...arena.wallStats, [stat]: value } })} />)}
          </div>
        </fieldset>}
      </details>
    </section>

    <div className="combat-layout">
      <ArmyEditor key={mode + '-0'} side={0} mode={mode} state={arena.sides[0]} units={currentUnits} unitIndex={unitIndex} update={(value) => changeSide(0, value)} />
      <Board mode={mode} level={arena.fieldLevel} wall={mode === 'land' ? arena.wallLevel : 0}
        round={currentRound} initial={initial} unitIndex={unitIndex} />
      <ArmyEditor key={mode + '-1'} side={1} mode={mode} state={arena.sides[1]} units={currentUnits} unitIndex={unitIndex} update={(value) => changeSide(1, value)} />
    </div>
    <div className="combat-run">
      <button type="button" className="button primary" onClick={run} disabled={!canRun}><Play size={18} aria-hidden="true" />Simular combate</button>
      <p className="quiet">{!canRun ? 'Completa ambos bandos o defiende con una muralla.' : 'Calcula hasta ' + arena.maxRounds + ' rondas.'}</p>
    </div>
    {arena.error && <p className="panel field-message" role="alert">{arena.error}</p>}
    <div aria-live="polite" className="sr-only">{arena.result && ('Simulación completada en ' + arena.result.rounds.length + ' rondas. ' + arena.result.reason)}</div>
    {arena.result && <BattleResults result={arena.result} roundIndex={arena.round} selectRound={(round) => replace({ round })} units={unitIndex} />}
    <UnitCatalog key={mode} units={currentUnits} mode={mode} />
  </div>;
}
