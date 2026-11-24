// One formation slot may contain only one unit type. Each pair is [slots, spaces per slot].
const LINE_ROLES = ['front', 'flank', 'ranged', 'artillery', 'air', 'antiAir'];
const LAND = [
  [[3,30],[0,0],[3,30],[1,30],[1,10],[1,10]],
  [[5,30],[2,30],[5,30],[2,30],[1,20],[1,20]],
  [[7,30],[4,30],[7,30],[3,30],[1,30],[1,30]],
  [[7,40],[6,30],[7,40],[4,30],[2,20],[2,20]],
  [[7,50],[6,40],[7,50],[5,30],[2,30],[2,30]],
];
const NAVAL = [
  [[3,15],[0,0],[3,15],[1,15],[1,10],[1,10]],
  [[5,15],[2,15],[5,15],[2,15],[1,10],[1,10]],
  [[7,15],[4,15],[7,15],[3,15],[1,15],[1,15]],
  [[7,20],[6,15],[7,20],[4,15],[2,10],[2,10]],
  [[7,25],[6,20],[7,25],[5,15],[2,15],[2,15]],
];
const TIERS = ['Muy pequeño','Pequeño','Mediano','Grande','Máximo'];
const LAND_PHASES = ['antiAir','air','artillery','ranged','front','flank'];
const NAVAL_PHASES = ['antiAir','air','flank','artillery','ranged','front'];
const PRIORITIES = {
  antiAir: ['air','antiAir'],
  air: ['antiAir','artillery','ranged','front','flank'],
  flank: ['flank','ranged','artillery','front'],
  artillery: ['wall','front','flank'],
  ranged: ['front','flank','ranged'],
  front: ['wall','front','ranged','artillery','flank'],
};
const TIER_DAMAGE = [0,.075,.075,.1,.125,.15];
const TIER_ARMOR = [0,0,10,10,20,20];
const WALL_ID = 'muralla';
const LAND_MACHINES = new Set(['steam-giant','battering-ram','catapult','mortar','gyrocopter','bombardier']);
export const COMBAT_MODEL_VERSION = '1.1.0';
export const COMBAT_ASSUMPTIONS = [
  'Catálogo heredado: comprobar estadísticas y mejoras en la versión del servidor.',
  'Puntería, reparto de daño, moral y curación son aproximaciones pendientes de calibración.',
  'Munición agrupada por tipo; no modela cargadores individuales ni rotaciones manuales.',
  'Escenario cerrado: no incluye llegadas, retiradas, cambio de milagro ni órdenes entre rondas.',
];
const MECHANICS = [
  'https://gameforge.com/en-GB/games/ikariam-battlefield.html',
  'https://forum.ikariam.gameforge.com/forum/thread/117436-guia-campo-de-batalha-e-suas-prioridades-2/',
  'https://forum.ikariam.gameforge.com/forum/thread/108845-infinite-horizons-milestone-3/',
  'https://www.ikadatos.com/campo-batalla.php',
];

const boundedInt = (x, min, max, fallback = min) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.trunc(x))) : fallback;
const sum = (xs) => xs.reduce((total, x) => total + x, 0);

export function battlefield(mode, fieldLevel) {
  const naval = mode === 'naval';
  const level = boundedInt(fieldLevel, naval ? 0 : 1, 100, naval ? 29 : 25);
  const limits = naval ? [7,14,21,28] : [4,9,16,24];
  const index = limits.findIndex((end) => level <= end);
  return makeField(mode, index < 0 ? 4 : index, level);
}

function makeField(mode, index, level) {
  const lanes = (mode === 'naval' ? NAVAL : LAND)[index];
  return {
    tier: index + 1,
    level,
    label: TIERS[index],
    lanes: Object.fromEntries(LINE_ROLES.map((role, i) => [role, { slots: lanes[i][0], capacity: lanes[i][1] }])),
  };
}

export function garrisonLimit(mode, fieldLevel, wallLevel = 0) {
  return mode === 'naval'
    ? 125 + 25 * boundedInt(fieldLevel, 0, 100, 29)
    : 250 + 50 * (boundedInt(fieldLevel, 1, 100, 25) + boundedInt(wallLevel, 0, 100));
}

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function supported(u) {
  return u && ['damage','armor','hp','size','accuracy'].every((key) => Number.isFinite(u[key]))
    && u.hp >= 1 && u.size >= 1 && u.damage >= 0 && u.armor >= 0 && u.accuracy >= 0
    && [...LINE_ROLES, 'healer', 'morale', 'reserve'].includes(u.role);
}

function sideState(input, catalog, warnings, excluded, label) {
  const groups = [];
  for (const [id, amount] of Object.entries(input?.army ?? {})) {
    const count = boundedInt(amount, 0, 100000);
    if (!count) continue;
    const unit = catalog.get(id);
    if (!supported(unit)) {
      excluded[id] = count;
      warnings.add(label + ' · ' + (unit?.name ?? id) + ' queda fuera del cálculo por falta de estadísticas utilizables.');
      continue;
    }
    if (unit.estimated || unit.estimate || unit.supportEstimate) warnings.add('Estadísticas estimadas para ' + unit.name + '.');
    const ammunition = unit.ammo ?? unit.weapons?.[0]?.ammo;
    groups.push({ unit, start: count, count, veterans: [],
      ammo: ammunition == null ? null : count * boundedInt(ammunition, 0, 100) });
  }
  // Reports put weaker front and bombing units first. Compare base damage within a class.
  groups.sort((a, b) => {
    const byRole = a.unit.role.localeCompare(b.unit.role);
    if (byRole) return byRole;
    const difference = a.unit.damage - b.unit.damage;
    const weakerFirst = a.unit.role === 'front' || a.unit.role === 'air';
    return (weakerFirst ? difference : -difference) || a.unit.id.localeCompare(b.unit.id);
  });
  const combatants = groups.filter((g) => LINE_ROLES.includes(g.unit.role));
  return {
    groups, morale: 100,
    immuneMorale: combatants.length > 0 && combatants.every((g) => g.unit.faction === 'barbarian'),
    weapon: boundedInt(input?.weapon, 0, 600),
    defense: boundedInt(input?.defense, 0, 600),
    forge: boundedInt(input?.forge, 0, 5),
    upgrades: input?.upgrades ?? {},
  };
}

function wallSpec(level, override) {
  const classic = level < 10 ? 10 + 2 * level : level < 20 ? 30 + 5 * level : 50 + 10 * level;
  return {
    id: WALL_ID,
    hp: boundedInt(override?.hp, 1, 10000000, 1800 + 900 * level),
    armor: boundedInt(override?.armor, 0, 10000000, 72 * level),
    damage: boundedInt(override?.damage, 0, 10000000, Math.round(classic * 3.6)),
    accuracy: level >= 20 ? .8 : level >= 10 ? .5 : .3,
    ammo: null,
  };
}

function armySize(state) {
  return sum(state.groups.filter((g) => LINE_ROLES.includes(g.unit.role)).map((g) => g.count));
}

function takeSquad(group, capacity) {
  const n = Math.min(group.available, Math.floor(capacity / group.unit.size));
  group.available -= n;
  return Array.from({ length: n }, () => group.queue.shift() ?? { hp: group.unit.hp });
}

function deploy(state, field, walls, siege, mode) {
  for (const g of state.groups) {
    g.available = g.count;
    g.queue = [...g.veterans];
  }
  const lightFirst = [...state.groups].sort((a, b) => a.unit.hp - b.unit.hp || a.unit.id.localeCompare(b.unit.id));
  const slots = [];
  if (walls) {
    for (const { units, position } of walls) {
      if (units.some((u) => u.hp > 0)) slots.push({ role: 'wall', position, units });
    }
  }
  for (const role of LINE_ROLES) {
    const { slots: columns, capacity } = field.lanes[role];
    if (role === 'flank' && siege) continue;
    const roles = role === 'front' ? ['front','flank','ranged'] : [role];
    for (let position = 0; position < columns; position++) {
      if (role === 'front' && slots.some((s) => s.role === 'wall' && s.position === position)) continue;
      const group = roles.map((r) => {
        let preferred = role === 'front' || role === 'flank' || role === 'air' ? lightFirst : state.groups;
        if (mode === 'land') {
          // Official deployment order: swordsmen before spearmen; weakest ranged
          // substitute first on the main line, strongest ranged first in the RCL.
          const descending = r === 'flank' || (r === 'ranged' && role !== 'front') || r === 'artillery';
          preferred = [...state.groups].sort((a, b) =>
            (descending ? b.unit.damage - a.unit.damage : a.unit.damage - b.unit.damage)
            || a.unit.id.localeCompare(b.unit.id));
        }
        return preferred.find((g) => g.unit.role === r && g.available > 0 && g.unit.size <= capacity);
      }).find(Boolean);
      if (group) slots.push({ role, position, group, units: takeSquad(group, capacity) });
    }
  }
  return slots;
}

function numberOfWalls(walls) {
  return walls.filter((s) => s.units.some((u) => u.hp > 0)).length;
}

function snapshotFormation(slots, state) {
  const formations = {};
  for (const s of slots) {
    const id = s.group?.unit.id ?? WALL_ID;
    const line = formations[s.role] ??= {};
    line[id] = (line[id] ?? 0) + s.units.length;
  }
  for (const g of state.groups) {
    if (!g.available) continue;
    const role = ['healer','morale'].includes(g.unit.role) ? g.unit.role : 'reserve';
    (formations[role] ??= {})[g.unit.id] = g.available;
  }
  return formations;
}

const alive = (slot) => slot.units.some((u) => u.hp > 0);
function equipment(state, unit, isWall, step) {
  if (isWall || unit.faction === 'barbarian') return { arm: unit.armor, bonus: 0, factor: 1 };
  const overrides = state.upgrades[unit.id];
  return {
    arm: unit.armor + boundedInt(overrides?.defense, 0, 600, state.defense) * step + TIER_ARMOR[state.forge],
    bonus: boundedInt(overrides?.weapon, 0, 600, state.weapon) * step,
    factor: 1 + TIER_DAMAGE[state.forge],
  };
}

function chooseWeapon(unit, remainingAmmo, line, targetRole) {
  const initial = unit.weapons?.[0] ?? unit;
  const secondary = unit.weapons?.[1];
  // The battering ram uses a different weapon against units even with ammunition available.
  if (secondary && (((initial.target === 'wall' || unit.id === 'battering-ram') && targetRole !== 'wall')
    || (line === 'front' && unit.role === 'ranged') || remainingAmmo === 0)) return secondary;
  return remainingAmmo === 0 ? null : initial;
}

function attacks(roles, own, enemy, side, other, wall, mode, random) {
  const step = mode === 'naval' ? 10 : 5;
  const shots = [];
  for (const slot of own.filter((s) => roles.includes(s.role))) {
    const unit = slot.group?.unit ?? wall;
    // Land bombers attack artillery first, not enemy air defence. Naval logic
    // retains its own existing target policy pending versioned report evidence.
    const priorities = mode === 'land' && slot.role === 'air'
      ? ['artillery','ranged','front','flank']
      : PRIORITIES[slot.role === 'wall' ? 'front' : slot.role];
    const role = priorities.find((r) => !(mode === 'naval' && slot.role === 'air' && r === 'antiAir')
      && enemy.some((target) => target.role === r && alive(target)));
    if (!role) continue;
    const targets = enemy.filter((target) => target.role === role && alive(target))
      .sort((a, b) => Math.abs(a.position - slot.position) - Math.abs(b.position - slot.position));
    const ownGear = equipment(side, unit, !slot.group, step);
    for (const actor of slot.units) {
      if (actor.hp <= 0) continue;
      const weapon = chooseWeapon(unit, slot.group?.ammo ?? null, slot.role, role);
      if (!weapon || !Number.isFinite(weapon.damage)) continue;
      const accuracy = weapon.accuracy > 1 ? weapon.accuracy / 100 : weapon.accuracy;
      const focus = random() < accuracy;
      const target = focus ? targets[0] : targets[Math.floor(random() * targets.length)];
      const armor = equipment(other, target.group?.unit ?? wall, !target.group, step).arm;
      const damage = Math.max(0, Math.round((weapon.damage + ownGear.bonus) * ownGear.factor - armor));
      if (slot.group?.ammo > 0 && weapon === (unit.weapons?.[0] ?? unit)) slot.group.ammo--;
      if (damage > 0) shots.push({ target, damage, focus });
    }
  }
  return shots;
}

function applyDamage(shots, random) {
  let inflicted = 0;
  for (const {target, damage, focus} of shots) {
    const recipients = target.units.filter((u) => u.hp > 0);
    if (!recipients.length) continue;
    const unit = focus ? recipients.reduce((a, b) => a.hp <= b.hp ? a : b)
      : recipients[Math.floor(random() * recipients.length)];
    inflicted += Math.min(unit.hp, damage);
    unit.hp -= damage;
    if (unit.hp <= 0 && target.group) {
      const group = target.group;
      // A casualty carries the remaining ammunition attributable to their unit type.
      if (group.ammo !== null) group.ammo -= Math.floor(group.ammo / group.count);
      group.count--;
    }
  }
  return inflicted;
}

function recover(state, slots, mode) {
  // Support units do not occupy combat slots. They heal damaged survivors, never casualties.
  let healing = sum(state.groups.map((g) => (g.unit.heal ?? g.unit.healPerRound ?? 0) * g.count));
  for (const slot of slots.filter((s) => s.group && (mode === 'naval' || !LAND_MACHINES.has(s.group.unit.id)))) {
    for (const u of slot.units) {
      if (healing <= 0 || u.hp <= 0 || u.hp >= slot.group.unit.hp) continue;
      const healed = Math.min(healing, slot.group.unit.hp - u.hp);
      u.hp += healed;
      healing -= healed;
    }
  }
  for (const g of state.groups) {
    g.veterans = [...g.queue, ...slots.filter((s) => s.group === g).flatMap((s) => s.units.filter((u) => u.hp > 0))];
  }
}

function recap(state, previous, formations) {
  const remaining = Object.fromEntries(state.groups.map((g) => [g.unit.id, g.count]));
  const losses = Object.fromEntries(state.groups.flatMap((g) => {
    const lost = (previous?.[g.unit.id] ?? g.start) - g.count;
    return lost ? [[g.unit.id, lost]] : [];
  }));
  const ammo = Object.fromEntries(state.groups.filter((g) => g.ammo !== null).map((g) => [g.unit.id, g.ammo]));
  return { remaining, losses, morale: state.morale, ammo, ...(formations ? { formations } : {}) };
}

function assessEnd(states, wallIntact) {
  // Units in reserve can sustain another round even if the active front was entirely lost.
  const ready = states.map((s, i) => s.morale > 0 && (
    s.groups.some((g) => ['front','flank','ranged'].includes(g.unit.role) && g.count > 0)
    || (i === 1 && wallIntact)));
  if (ready[0] && ready[1]) return null;
  if (!ready[0] && !ready[1]) return { winner: 'draw', reason: 'Los dos bandos pierden su capacidad de mantener el frente.' };
  const winner = ready[0] ? 'attack' : 'defense';
  const losing = states[ready[0] ? 1 : 0];
  const bando = ready[0] ? 'defensor' : 'atacante';
  const reason = losing.morale <= 0 ? 'El bando ' + bando + ' se retira al agotar la moral.'
    : 'El bando ' + bando + ' se queda sin línea de frente.';
  return { winner, reason };
}

export function simulateCombat({ mode = 'land', units = [], sides = [], fieldLevel, wallLevel, wallStats, maxRounds, seed } = {}) {
  const theatre = mode === 'naval' ? 'naval' : 'land';
  const field = battlefield(theatre, fieldLevel);
  const wallLevelUsed = theatre === 'land' ? boundedInt(wallLevel, 0, 100) : 0;
  const limit = garrisonLimit(theatre, field.level, wallLevelUsed);
  const wall = wallSpec(wallLevelUsed, wallStats);
  const walls = !wallLevelUsed ? [] : Array.from({ length: field.lanes.front.slots }, (_, position) => ({
    position, units: [{ hp: wall.hp }],
  }));
  const seedUsed = boundedInt(seed, 0, 4294967295, 1);
  const random = randomSource(seedUsed);
  const rounds = [];
  const catalog = new Map(units.map((u) => [u.id, u]));
  const warnings = new Set();
  if (wallLevelUsed && !['hp','armor','damage'].every((name) => Number.isFinite(wallStats?.[name]))) {
    warnings.add('Las estadísticas de la muralla son una aproximación del balance posterior a Horizontes Infinitos.');
  }
  const excluded = [Object.create(null), Object.create(null)];
  const states = ['Atacante','Defensor'].map((label, i) => sideState(sides[i], catalog, warnings, excluded[i], label));
  const roundLimit = boundedInt(maxRounds, 1, 70, 30);
  let outcome = { winner: 'draw', reason: 'Límite de rondas alcanzado con ambos bandos aún en combate.' };
  let inactivity = 0;
  for (let number = 1; number <= roundLimit; number++) {
    const open = armySize(states[1]) > limit;
    const used = open ? makeField(theatre, 4, field.level) : field;
    const showWalls = !open && numberOfWalls(walls) > 0;
    const slots = [deploy(states[0], used, null, showWalls, theatre), deploy(states[1], used, showWalls ? walls : null, showWalls, theatre)];
    const finished = assessEnd(states, showWalls && numberOfWalls(walls) === walls.length);
    if (finished) { outcome = finished; break; }

    const previous = states.map((s) => recap(s).remaining);
    const formations = states.map((s, i) => snapshotFormation(slots[i], s));
    const before = states.map(armySize);
    let damage = 0;
    for (const phase of (theatre === 'naval' ? NAVAL_PHASES : LAND_PHASES)) {
      const roles = phase === 'front' ? ['front','wall'] : [phase];
      // Resolve both volleys from the same phase before applying losses to either side.
      const shotLists = states.map((s, i) =>
        attacks(roles, slots[i], slots[1-i], s, states[1-i], wall, theatre, random));
      for (const shots of shotLists) damage += applyDamage(shots, random);
    }
    const after = states.map(armySize);
    states.forEach((s, i) => {
      recover(s, slots[i], theatre);
      if (s.immuneMorale) return;
      const support = sum(s.groups.map((g) => (g.unit.morale ?? g.unit.moralePerRound ?? 0) * g.count));
      const casualtyShare = (before[i] - after[i]) / Math.max(1, before[i]);
      const enemyShare = (before[1-i] - after[1-i]) / Math.max(1, before[1-i]);
      s.morale = Math.round(Math.max(0, Math.min(100, s.morale - 10 - Math.max(0, 20 * (casualtyShare - enemyShare)) + support)) * 10) / 10;
    });
    const wallRemaining = showWalls ? numberOfWalls(walls) : 0;
    rounds.push({ number, fieldTier: used.tier, openField: open, wallRemaining,
      sides: states.map((s, i) => recap(s, previous[i], formations[i])) });
    const end = assessEnd(states, showWalls && wallRemaining === walls.length);
    if (end) { outcome = end; break; }
    inactivity = damage ? 0 : inactivity + 1;
    if (inactivity >= 3 && states.every((s) => s.morale >= 100 || s.immuneMorale)) {
      outcome = { winner: 'draw', reason: 'Bloqueo durante tres rondas sin daño ni retirada por moral.' };
      break;
    }
  }
  return { ...outcome, mode: theatre, field, garrisonLimit: limit, seed: seedUsed,
    modelVersion: COMBAT_MODEL_VERSION, assumptions: [...COMBAT_ASSUMPTIONS],
    roundMinutes: 15, rounds, sides: states.map((s) => recap(s)), warnings: [...warnings], excluded,
    sources: MECHANICS, model: 'Estimación por rondas con puntería y reparto de daño parametrizados. Moral aproximada. Las formaciones muestran el despliegue al inicio de la ronda.' };
}
