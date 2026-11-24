// Ikariam growth engine: mechanics model + greedy-ROI build planner + hourly simulator.
// Sources of constants: see docs/MECHANICS.md.
import { COSTS } from './costs.js';

export const RES = ['wood', 'wine', 'marble', 'glass', 'sulfur'];
export const LUX_BONUS = { wine: 'winegrower', marble: 'stonemason', glass: 'glassblowing', sulfur: 'alchemist' };
export const REDUCER = { wood: 'carpentering', wine: 'vineyard', marble: 'architect', glass: 'optician', sulfur: 'fireworker' };
export const GOD_RES = { pan: 'wood', dionysus: 'wine', tyche: 'marble', theia: 'glass', hephaestus: 'sulfur', plutus: 'gold' };

export const NAMES = {
  townHall: 'Town Hall', tavern: 'Tavern', museum: 'Museum', academy: 'Academy', warehouse: 'Warehouse',
  port: 'Trading Port', forester: "Forester's House", winegrower: 'Winegrower (Winery)', stonemason: 'Stonemason',
  glassblowing: 'Glassblower', alchemist: "Alchemist's Tower", carpentering: "Carpenter's Workshop",
  architect: "Architect's Office", vineyard: 'Wine Press', optician: 'Optician', fireworker: 'Firework Test Area',
  palace: 'Palace', palaceColony: "Governor's Residence", shrineOfOlympus: "Gods' Shrine", barracks: 'Barracks',
  wall: 'Town Wall', safehouse: 'Hideout', shipyard: 'Shipyard', embassy: 'Embassy', workshop: 'Workshop',
  branchOffice: 'Trading Post', dump: 'Dump', temple: 'Temple', pirateFortress: 'Pirate Fortress',
};

// ---- Tables (index = level unless noted) ----
// Tavern: satisfaction from the building level (index = tavern level)
export const TAVERN_SAT = [0,12,24,36,48,61,73,86,99,112,125,138,152,165,179,193,207,222,236,251,266,282,297,313,329,345,361,378,395,412,430,448,466,484,502,521,540,560,580,600,620,641,662,683,705,727,749,772,795,819,843,867,891,916,942,968,994,1021,1048,1075,1103,1131,1160,1189,1219,1249,1280,1311,1343,1375,1408];
// Satisfaction from wine served (index = serving level, max = tavern level)
export const WINE_SAT = [0,60,120,181,242,304,367,430,494,559,624,691,758,826,896,966,1037,1109,1182,1256,1332,1408,1485,1564,1644,1725,1807,1891,1975,2061,2149,2238,2328,2419,2512,2606,2702,2800,2898,2999,3101,3204,3310,3416,3525,3635,3747,3861,3976,4094,4213,4334,4457,4582,4709,4838,4969,5103,5238,5375,5515,5657,5801,5947,6096,6247,6400,6556,6714,6875,7038];
// Wine consumed per hour at each serving level, before Wine Press reduction
export const WINE_USE = [0,4,8,13,18,24,30,37,44,51,60,68,78,88,99,110,122,136,150,165,180,197,216,235,255,277,300,325,351,378,408,439,472,507,544,584,626,670,717,766,818,874,933,995,1060,1129,1203,1280,1361,1449,1541,1640,1745,1857,1976,2102,2237,2380,2532,2694,2867,3050,3246,3453,3675,3910,4160,4426,4710,5011,5332];
// Museum satisfaction by level
export const MUSEUM_SAT = [0,20,41,63,88,114,144,176,211,250,294,341,395,453,518,590,670,759,857,965,1086,1219,1367,1530,1711,1912,2134,2380,2652,2953,3286,3655,4064,4516,5016,5569,6182];
// Max scientists by Academy level
export const ACADEMY_SCI = [0,8,12,16,22,28,35,43,51,60,69,79,89,100,111,122,134,146,159,172,185,198,212,227,241,256,271,287,302,318,335,351,368,385,404,424,444,466,488,512,537,563,590,619,649,680,713,748,784,822,862];
// Island worker caps per city, index = island building level - 1 (forum donation table, levels 1-60)
export const SAWMILL_WORKERS = [30,40,52,66,81,97,115,134,154,174,196,218,241,264,289,314,340,366,393,420,449,477,506,536,566,597,628,659,692,724,757,790,824,858,893,928,964,999,1036,1072,1109,1147,1184,1222,1261,1299,1339,1378,1418,1458,1498,1539,1580,1622,1663,1705,1748,1790,1833,1876];
export const LUX_WORKERS = [20,33,49,67,88,110,133,158,184,212,241,270,301,333,365,399,433,468,504,541,578,616,655,695,735,776,817,859,902,946,990,1034,1079,1125,1171,1218,1265,1313,1361,1410,1459,1509,1559,1610,1661,1713,1765,1817,1870,1924,1977,2032,2086,2142,2197,2253,2309,2366,2423,2481];
// Warehouse capacity per resource, index = level-1
export const WAREHOUSE_CAP = [8000,16401,25455,35331,46181,58159,71421,86138,102493,120687,140942,163502,188637,216646,247860,282647,321416,364622,412768,466416,526189,592779,666959,749584,841609,944094,1058219,1185297,1326787,1484315,1659690,1854922,2072252,2314171,2583453,2883186,3216807,3588142,4001450,4461476];
export const PORT_LOAD = [30,60,93,129,169,213,261,315,373,437,508,586,672,766,869,983,1108,1246,1398,1565,1748,1950,2172,2416,2685,2980,3305,3663,4056,4489,4965,5488,6064,6698,7394,8161,9004,9931,10951,12073];

export function housing(L) {
  if (L <= 0) return 0;
  if (L < 41) return Math.floor(10 * Math.pow(L, 1.5)) * 2 + 40;
  return Math.round(5099.12 * Math.pow(1.038283, L - 40) - 1.7) + (L === 58 || L === 62 ? 1 : 0);
}

// ---- Build time (seconds) for reaching level L ----
const TP = {
  townHall: { a: 1800, b: 1, c: 1.17, d: -1080, e: [3186] },
  tavern: { a: 10800, b: 1, c: 1.06, d: 10440 },
  museum: { a: 18000, b: 1, c: 1.1, d: 14040 },
  academy: { a: 1440, b: 1, c: 1.2, d: 720, e: [983] },
  warehouse: { a: 2880, b: 1, c: 1.14, d: 2160, e: [1063, 1163] },
  port: { a: 50400, b: 23, c: 1.15, d: 1512, e: [588] },
  forester: { a: 72000, b: 11, c: 1.1, d: 6120 }, glassblowing: { a: 72000, b: 11, c: 1.1, d: 6120 },
  alchemist: { a: 72000, b: 11, c: 1.1, d: 6120 }, winegrower: { a: 72000, b: 11, c: 1.1, d: 6120 },
  stonemason: { a: 72000, b: 11, c: 1.1, d: 6120 },
  carpentering: [{ a: 125660, b: 37, c: 1.06, d: 2808 }, { a: 125031, b: 56, c: 1.069394, d: 0 }],
  architect: [{ a: 125660, b: 37, c: 1.06, d: 2628 }, { a: 156455, b: 68, c: 1.068703, d: 0 }],
  fireworker: [{ a: 125660, b: 37, c: 1.06, d: 2628 }, { a: 156455, b: 68, c: 1.068703, d: 0 }],
  optician: [{ a: 125660, b: 37, c: 1.06, d: 2772 }, { a: 168457, b: 75, c: 1.069256, d: 0 }],
  vineyard: [{ a: 125660, b: 37, c: 1.06, d: 2232 }, { a: 107967, b: 44, c: 1.067231, d: 1 }],
  palace: { a: 11520, b: 1, c: 1.4, d: 0 }, palaceColony: { a: 11520, b: 1, c: 1.4, d: 0 },
  shrineOfOlympus: { a: 48, b: 1, c: 1.25, d: 0 },
  safehouse: { a: 96000, b: 7, c: 1.05, d: 12960 }, wall: { a: 57600, b: 11, c: 1.1, d: 3240, e: [2430] },
  barracks: { a: 25200, b: 11, c: 1.1, d: 1728, e: [732] }, shipyard: { a: 64800, b: 7, c: 1.05, d: 7128 },
  embassy: { a: 96000, b: 7, c: 1.05, d: 10080 }, workshop: { a: 96000, b: 7, c: 1.05, d: 11880 },
  branchOffice: { a: 108000, b: 11, c: 1.1, d: 9360 }, dump: { a: 32000, b: 13, c: 1.17, d: 2160 },
  temple: { a: 2160, b: 1, c: 1.1, d: 0 },
};
export function buildSeconds(b, L) {
  let p = TP[b]; if (!p) return 3600;
  const i = L - 1;
  if (Array.isArray(p)) p = i < 32 ? p[0] : p[1];
  let t = Math.round(p.a / p.b * Math.pow(p.c, i + 1) - p.d) - (p.e && p.e[i] != null ? p.e[i] : 0);
  return Math.max(1, Math.min(t, 1728000));
}

// ---- Costs with reductions ----
export function costFactor(city, r, research) {
  const red = (research.pulley ? 2 : 0) + (research.geometry ? 4 : 0) + (research.spiritLevel ? 8 : 0);
  const lvl = Math.min(city.b[REDUCER[r]] || 0, 50);
  return Math.max(0, 1 - (red + lvl) / 100);
}
export function upgradeCost(city, b, L, research) {
  const row = COSTS[b] && COSTS[b][L - 1];
  if (!row) return null;
  const c = {};
  RES.forEach((r, i) => { c[r] = Math.floor(row[i] * costFactor(city, r, research)); });
  return c;
}

// ---- Example state (anonymised; real empire state lives in the data store, never in this repo) ----
export function defaultState() {
  const mk = (o) => Object.assign({ cultural: 0, scientists: 0, god: 'pan', freeSlots: 0, wineStock: 0 }, o);
  return {
    meta: { updated: '2026-01-01', server: 'example', note: 'Anonymised example empire for tests and demos' },
    donationItem: 0,
    gold: 1000000, ambrosia: 0, traderUses: 0, ships: 40,
    premium: { account: 0, boosts: { wood: true, wine: true, marble: true, glass: true, sulfur: true } },
    research: { pulley: true, geometry: true, spiritLevel: true, holiday: true, wellConstruction: true, utopia: false,
      economicFuture: 0, helpingHands: true, letterChute: false, paper: true, ink: true, mechanicalPen: true, scientificFuture: 0 },
    government: 'ikacracy',
    shrine: { level: 2, city: 'Delta', favour: 0, blessedCities: 2, blessedAuto: true, blessed: ['Alpha', 'Beta'] },
    stock: { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 },
    cities: [
      mk({ name: 'Alpha', coords: '10:10', lux: 'wine', capital: true, pop: 500, woodLvl: 30, luxLvl: 30, god: 'dionysus', freeSlots: 4, slotPlan: ['optician', 'fireworker'],
        b: { townHall: 19, warehouse: [10, 9, 11], architect: 14, academy: 15, carpentering: 12, winegrower: 15, vineyard: 22, palace: 4, forester: 8, tavern: 18, port: [10, 11], museum: 1 } }),
      mk({ name: 'Beta', coords: '11:10', lux: 'sulfur', pop: 400, woodLvl: 28, luxLvl: 26, freeSlots: 6, slotPlan: ['forester', 'vineyard'],
        b: { townHall: 16, warehouse: [12, 13, 15], architect: 6, academy: 12, carpentering: 8, palaceColony: 4, tavern: 14, port: [11], museum: 1, alchemist: 9 } }),
      mk({ name: 'Gamma', coords: '12:10', lux: 'glass', pop: 380, woodLvl: 27, luxLvl: 25, freeSlots: 5, slotPlan: ['museum', 'glassblowing'],
        b: { townHall: 15, warehouse: [15, 17], architect: 9, academy: 17, carpentering: 9, palaceColony: 4, forester: 6, tavern: 13, port: [10, 6] } }),
      mk({ name: 'Delta', coords: '10:12', lux: 'marble', pop: 360, woodLvl: 29, luxLvl: 28, freeSlots: 11, slotPlan: ['museum', 'stonemason', 'forester', 'carpentering', 'architect'],
        b: { townHall: 16, warehouse: [15, 14], academy: 12, palaceColony: 4, tavern: 12, port: [6], shrineOfOlympus: 2 } }),
      mk({ name: 'Epsilon', coords: '10:12', lux: 'marble', pop: 470, woodLvl: 29, luxLvl: 28, freeSlots: 4, slotPlan: ['optician', 'fireworker'],
        b: { townHall: 20, warehouse: [11, 5, 11], architect: 12, academy: 13, carpentering: 8, vineyard: 16, palaceColony: 4, forester: 6, tavern: 18, port: [10, 7], museum: 2, stonemason: 13 } }),
    ],
  };
}

export const GOALS = {
  economy: { label: 'Pure economic growth', w: { wood: 1, wine: 1, marble: 1, glass: 1, sulfur: 1 }, convertible: true, reserveGold: 0 },
  expansion: { label: 'Expansion (6th town: Palace 5 + Governors 5)', w: { wood: 1, wine: 1.1, marble: 1, glass: 1.2, sulfur: 1.2 }, convertible: true, reserveGold: 0, expansion: true },
  military: { label: 'Economy + army build-up', w: { wood: 1, wine: 1, marble: 1, glass: 0.9, sulfur: 1.3 }, convertible: true, reserveGold: 3000000 },
};

// ---- Per-city mechanics ----
export const lvl0 = 0;
const lvl = (city, b) => { const v = city.b[b]; return Array.isArray(v) ? Math.max(0, ...v) : (v || 0); };
export const blevel = lvl;

export function govBuildFactor(st) { return st.government === 'aristocracy' ? 0.8 : st.government === 'oligarchy' ? 1.2 : 1; }
export function corruption(city, st) {
  const n = st.cities.length;
  const g = city.capital ? lvl(city, 'palace') : lvl(city, 'palaceColony');
  let c = city.capital && g >= n - 1 ? 0 : Math.max(0, 1 - (g + 1) / n);
  const gov = st.government;
  if (gov === 'aristocracy' && !city.capital && g < n) c += 0.03; // removable with residence one level above requirement
  if (gov === 'oligarchy') c += 0.03;
  if (gov === 'nomocracy') c -= 0.05;
  if (gov === 'anarchy') c += 0.25;
  return Math.min(1, Math.max(0, c));
}
export function maxPop(city, st) {
  const R = st.research;
  let m = housing(lvl(city, 'townHall'));
  if (R.holiday) m += 50;
  if (city.capital && R.wellConstruction) m += 50;
  if (city.capital && R.utopia) m += 200;
  m += 20 * (R.economicFuture || 0);
  return m;
}
export function baseSat(city, st) {
  const R = st.research;
  let s = 196;
  if (R.holiday) s += 25;
  if (city.capital && R.wellConstruction) s += 50;
  if (city.capital && R.utopia) s += 200;
  s += 10 * (R.economicFuture || 0);
  s += TAVERN_SAT[lvl(city, 'tavern')] || 0;
  s += MUSEUM_SAT[lvl(city, 'museum')] || 0;
  s += 50 * Math.min(city.cultural || 0, lvl(city, 'museum'));
  if (st.government === 'democracy') s += 75;
  if (st.government === 'dictatorship') s -= 75;
  return s;
}
export function capacity(city) {
  const v = city.b.warehouse; const arr = Array.isArray(v) ? v : (v ? [v] : []);
  return 2500 + arr.reduce((t, l) => t + (WAREHOUSE_CAP[l - 1] || 0), 0);
}
export function wineUse(city, s) { return WINE_USE[s] * (1 - Math.min(lvl(city, 'vineyard'), 100) / 100); }

export function shrineBlessing(st) {
  const L = st.shrine.level || 0; if (!L) return 0;
  const max = (3 + 2 * L) / 100;
  return max * (0.4 + 0.6 * Math.min(1, (st.shrine.favour || 0) / 1000));
}
export function blessedCount(st) {
  return st.shrine.blessedAuto === false ? (st.shrine.blessedCities || 0) : Math.min(st.shrine.level || 0, st.cities.length);
}
export function blessedSet(st) {
  const order = Array.isArray(st.shrine.blessed) ? [...st.shrine.blessed] : [];
  st.cities.forEach(c => { if (!order.includes(c.name) && c.god && c.god !== 'none') order.push(c.name); });
  if (Array.isArray(st.shrine.blessed)) return new Set(order.slice(0, blessedCount(st)));
  const n = st.shrine.blessedCities || 0;
  return new Set(st.cities.filter(c => c.god && c.god !== 'none').slice(0, n).map(c => c.name));
}
export function mult(city, st, r, blessed) {
  let m = 1;
  if (r === 'wood') m += 0.02 * lvl(city, 'forester');
  else m += 0.02 * lvl(city, LUX_BONUS[r]);
  if (st.premium.boosts && st.premium.boosts[r]) m += 0.2;
  if ((blessed || blessedSet(st)).has(city.name) && GOD_RES[city.god] === r) m += shrineBlessing(st);
  return m;
}
export function workerCaps(city, st) {
  const hh = st.research.helpingHands ? 0.5 : 0;
  const w = SAWMILL_WORKERS[Math.min(60, city.woodLvl) - 1] || 0, l = LUX_WORKERS[Math.min(60, city.luxLvl) - 1] || 0;
  return { wood: w, lux: l, woodHH: Math.floor(w * hh), luxHH: Math.floor(l * hh) };
}
export function rpPerScientist(st) {
  const R = st.research;
  return 1 + (R.paper ? 0.02 : 0) + (R.ink ? 0.04 : 0) + (R.mechanicalPen ? 0.08 : 0) + 0.02 * (R.scientificFuture || 0);
}

// Allocate `citizens` of one city. weights: value per unit of each resource; luxShare: forced share target (optional)
// Returns {wood, lux, woodHH, luxHH, tax, prod:{...}, value}
export function allocate(city, st, citizens, w, opts = {}) {
  const caps = workerCaps(city, st);
  const blessed = opts.blessed || blessedSet(st);
  const mw = mult(city, st, 'wood', blessed), ml = mult(city, st, city.lux, blessed);
  const goldW = opts.goldWeight != null ? opts.goldWeight : 0.05; // 3 gold/h per taxed citizen, gold mostly idle
  let left = Math.max(0, Math.floor(citizens - (city.scientists || 0)));
  const a = { wood: 0, lux: 0, woodHH: 0, luxHH: 0, tax: 0 };
  // forced lux minimum (e.g. wine requirement)
  if (opts.minLux) { const n = Math.min(left, caps.lux, Math.ceil(opts.minLux / ml)); a.lux += n; left -= n; }
  const opt = [
    { k: 'lux', v: ml * (w[city.lux] ?? 1), cap: caps.lux },
    { k: 'wood', v: mw * (w.wood ?? 1), cap: caps.wood },
    { k: 'luxHH', v: 0.25 * ml * (w[city.lux] ?? 1), cap: caps.luxHH },
    { k: 'woodHH', v: 0.25 * mw * (w.wood ?? 1), cap: caps.woodHH },
    { k: 'tax', v: 3 * goldW, cap: Infinity },
  ].sort((x, y) => y.v - x.v);
  if (opts.luxFrac != null) { // balanced mode: split skilled workers by target fraction
    const skilled = Math.min(left, caps.lux - a.lux + caps.wood);
    let nl = Math.min(caps.lux - a.lux, Math.round(skilled * opts.luxFrac));
    let nw = Math.min(caps.wood, skilled - nl); nl = Math.min(caps.lux - a.lux, skilled - nw);
    a.lux += nl; a.wood += nw; left -= nl + nw;
  }
  for (const o of opt) { const have = a[o.k]; const n = Math.max(0, Math.min(left, o.cap - have)); a[o.k] += n; left -= n; if (left <= 0) break; }
  const prod = { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 };
  prod.wood = (a.wood + 0.25 * a.woodHH) * mw;
  prod[city.lux] += (a.lux + 0.25 * a.luxHH) * ml;
  const gold = 3 * a.tax - (city.scientists || 0) * (6 - (st.research.letterChute ? 3 : 0));
  const rp = (city.scientists || 0) * rpPerScientist(st) * (1 - corruption(city, st));
  let value = 0; RES.forEach(r => value += prod[r] * (w[r] ?? 1)); value += gold * goldW;
  return { ...a, prod, gold, rp, value, mw, ml };
}

// Equilibrium analysis for a city: best wine serving level and resulting steady-state value
export function equilibrium(city, st, w, opts = {}) {
  const mp = maxPop(city, st), corr = corruption(city, st), bs = baseSat(city, st);
  const tav = lvl(city, 'tavern');
  let best = null;
  for (let s = 0; s <= tav; s++) {
    const sat = bs + WINE_SAT[s];
    const pop = Math.min(mp, Math.floor((1 - corr) * sat));
    const al = allocate(city, st, pop, w, opts);
    const wu = wineUse(city, s);
    const v = al.value - wu * (w.wine ?? 1);
    if (!best || v > best.value + 1e-9) best = { s, sat, pop, value: v, wine: wu, alloc: al, maxPop: mp, corr };
  }
  return best;
}

// ---- Candidate actions ----
const ECON_UPGRADES = ['townHall', 'tavern', 'museum', 'palaceColony', 'palace', 'forester', 'winegrower', 'stonemason', 'glassblowing', 'alchemist',
  'carpentering', 'architect', 'vineyard', 'optician', 'fireworker'];
const MAXLVL = { townHall: 66, tavern: 70, museum: 36, forester: 61, winegrower: 61, stonemason: 61, glassblowing: 61, alchemist: 61,
  carpentering: 50, architect: 50, vineyard: 50, optician: 50, fireworker: 50, shrineOfOlympus: 41, academy: 50, warehouse: 85 };
const SPEND_SHARE = { wood: 0.48, wine: 0.04, marble: 0.38, glass: 0.06, sulfur: 0.04 };

function cloneCity(c) { return JSON.parse(JSON.stringify(c)); }
function setLevel(city, b, L) {
  const v = city.b[b];
  if (Array.isArray(v)) { const i = v.indexOf(Math.max(...v)); v[i] = L; } else city.b[b] = L;
}
function relevantBuilding(city, b) {
  if (['winegrower', 'stonemason', 'glassblowing', 'alchemist'].includes(b)) return LUX_BONUS[city.lux] === b;
  if (b === 'optician' || b === 'fireworker') return false; // tiny spend share; offered only if already built
  return true;
}

export function candidates(st, w, opts = {}) {
  const out = [];
  const blessed = blessedSet(st);
  const empireValue = st.cities.reduce((s, c) => s + equilibrium(c, st, w, { blessed }).value, 0);
  const n = st.cities.length;
  for (const city of st.cities) {
    const eq0 = equilibrium(city, st, w, { blessed });
    const tryAction = (steps, label) => {
      const c2 = cloneCity(city); let cost = { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 }, secs = 0; const tos = [];
      const st2 = { ...st, cities: st.cities.map(x => x.name === city.name ? c2 : x) };
      for (const [b, isNew] of steps) {
        const L = (isNew ? 0 : lvl(c2, b)) + 1;
        if (L > (MAXLVL[b] || 50)) return;
        const k = upgradeCost(c2, b, L, st.research); if (!k) return;
        RES.forEach(r => cost[r] += k[r]); secs += buildSeconds(b, L) * govBuildFactor(st); tos.push(L);
        if (isNew) c2.b[b] = 1; else setLevel(c2, b, L);
      }
      const eq1 = equilibrium(c2, st2, w, { blessed });
      let dv = eq1.value - eq0.value;
      // reducer savings
      for (const [b] of steps) {
        const r = Object.keys(REDUCER).find(k => REDUCER[k] === b);
        if (r && lvl(city, b) < 50) {
          const spend = empireValue / n * SPEND_SHARE[r] * (opts.buildIntensity ?? 0.85);
          dv += 0.01 * spend / Math.max(0.36, costFactor(city, r, st.research));
        }
        if (b === 'shrineOfOlympus') {
          const L = lvl(city, b);
          const gain = (0.02) * (0.4 + 0.6 * Math.min(1, (st.shrine.favour || 0) / 1000));
          let base = 0; for (const c of st.cities) if (blessed.has(c.name)) { const e = equilibrium(c, st, w, { blessed }); const r2 = GOD_RES[c.god]; base += r2 === 'gold' ? 0 : (e.alloc.prod[r2] / mult(c, st, r2, blessed)) * (w[r2] ?? 1); }
          dv += gain * base * (L < 1 ? 0 : 1);
        }
      }
      const costEq = RES.reduce((s, r) => s + cost[r] * (w[r] ?? 1), 0);
      const popRelated = steps.some(([b]) => ['townHall', 'tavern', 'museum'].includes(b));
      const hours = secs / 3600;
      const payback = dv > 0.01 ? costEq / dv + hours + (popRelated ? 25 : 0) : Infinity;
      out.push({ city: city.name, steps: steps.map(([b, isNew], i) => ({ b, to: tos[i], isNew: !!isNew })), label, cost, costEq, dv, hours, payback, eq1 });
    };
    for (const b of ECON_UPGRADES) {
      if (lvl(city, b) > 0) tryAction([[b]], NAMES[b]);
      else if ((city.freeSlots || 0) > 0 && (city.slotPlan || []).includes(b) && !(city._planned || []).includes(b)) tryAction([[b, true]], 'New ' + NAMES[b]);
    }
    tryAction([['townHall'], ['tavern']], 'Town Hall + Tavern');
    if (lvl(city, 'museum') > 0) tryAction([['townHall'], ['museum']], 'Town Hall + Museum');
    tryAction([['tavern'], ['tavern']], 'Tavern ×2');
    if (lvl(city, 'shrineOfOlympus') > 0) tryAction([['shrineOfOlympus']], NAMES.shrineOfOlympus);
  }
  return out.filter(a => isFinite(a.payback)).sort((a, b) => a.payback - b.payback);
}

// Research queue used by the simulator (RP costs from the Ikariam wiki research list)
export const DEFAULT_RESEARCH = [
  { name: 'A Lucky Coincidence (Tyche, marble god)', rp: 2236 },
  { name: 'Riches From the Depths (Plutus)', rp: 3672 },
  { name: "The Goddess's Splendour (Theia, glass god)", rp: 7200 },
  { name: 'Forged in Lava (Hephaestus, sulphur god)', rp: 10764 },
  { name: 'Bureaucracy (+1 building ground in every town)', rp: 106560, apply: st => st.cities.forEach(c => { c.freeSlots = (c.freeSlots || 0) + 1; }) },
];
// ---- Hourly simulation ----
// opts: weights, days, expansion:{startDay, lux, woodLvl, luxLvl, name}, marketBuy:{marble:perDay, price}, minTradeGap, maxBatch
export function simulate(stIn, goalKey = 'economy', days = 30, opts = {}) {
  const goal = GOALS[goalKey] || GOALS.economy;
  const w = { ...goal.w, ...(opts.weights || {}) };
  const st = JSON.parse(JSON.stringify(stIn));
  const stock = { ...st.stock };
  let gold = st.gold, rpTotal = 0, trades = 0, lastTrade = -999;
  let tradesLeft = (st.traderUses || 0) + Math.floor((st.ambrosia || 0) / 5);
  const busy = {}, current = {}; st.cities.forEach(c => { busy[c.name] = 0; current[c.name] = null; });
  const events = [], daily = [], tradeLog = [], milestones = [];
  const H = days * 24;
  const exp = opts.expansion || (goal.expansion ? { startDay: 0 } : null);
  let expQueue = null, expDone = false;
  let cands = candidates(st, w, opts), candAge = 0;
  st.cities.forEach(c => { c.userScientists = c.scientists || 0; });
  let rpSpent = 0;
  const rq = (opts.researchQueue || DEFAULT_RESEARCH).filter(x => !(st.research.done || []).includes(x.name)).map(x => ({ ...x }));

  const startBuild = (c, b, to, isNew, label, payback) => {
    const k = upgradeCost(c, b, to, st.research);
    RES.forEach(r => stock[r] -= k[r]);
    busy[c.name] = currentH + Math.max(1, Math.ceil(buildSeconds(b, to) * govBuildFactor(st) / 3600));
    current[c.name] = { b, to, isNew, label };
    events.push({ h: currentH, city: c.name, b, to, cost: k, label, payback, isNew });
  };
  const tryTrade = (c, k, wineBuffer) => {
    if (!goal.convertible || tradesLeft <= 0 || currentH - lastTrade < (opts.minTradeGap ?? 12)) return false;
    const reserve = { wood: 0, marble: 0, wine: wineBuffer + 5000, glass: opts.keepGlass ?? 20000, sulfur: opts.keepSulfur ?? 20000 };
    if (expQueue && !expDone) { reserve.glass = 0; reserve.sulfur = 0; }
    const deficit = RES.filter(r => stock[r] < k[r]);
    if (!deficit.length) return false;
    const surplus = {}; let sTot = 0;
    RES.forEach(r => { if (deficit.includes(r)) return; const x = Math.max(0, stock[r] - reserve[r] - k[r]); if (x > 0 && (r !== 'wood' && r !== 'marble' || x > 80000)) { surplus[r] = x; sTot += x; } });
    const missingTot = deficit.reduce((t, r) => t + (k[r] - stock[r]), 0);
    if (sTot < Math.max(missingTot, opts.minBatch ?? 40000)) return false;
    const batch = Math.min(sTot, opts.maxBatch ?? Math.min(350000, capacity(c)));
    const to = {}, from = {}; let rem = batch;
    deficit.forEach(r => { to[r] = k[r] - stock[r]; rem -= to[r]; });
    const sinks = ['wood', 'marble'].filter(r => !surplus[r]);
    const shares = { wood: 0.45, marble: 0.55 }; const ssum = sinks.reduce((t, r) => t + shares[r], 0) || 1;
    sinks.forEach(r => { to[r] = (to[r] || 0) + Math.max(0, rem) * shares[r] / ssum; });
    let need = batch;
    for (const r of Object.keys(surplus).sort((x, y) => surplus[y] - surplus[x])) { const t = Math.min(surplus[r], need); if (t > 0) { from[r] = t; need -= t; } }
    RES.forEach(r => { stock[r] += (to[r] || 0) - (from[r] || 0); });
    trades++; tradesLeft--; lastTrade = currentH;
    const rd = o => Object.fromEntries(Object.entries(o).filter(([, x]) => x > 0.5).map(([r, x]) => [r, Math.round(x)]));
    tradeLog.push({ h: currentH, city: c.name, from: rd(from), to: rd(to) });
    return RES.every(r => stock[r] >= k[r]);
  };
  let currentH = 0;
  for (let h = 0; h < H; h++) {
    currentH = h;
    const blessed = blessedSet(st);
    // market purchases (gold -> resource), once per day
    if (opts.marketBuy && h % 24 === 0) for (const [r, q] of Object.entries(opts.marketBuy)) { if (r === 'price') continue; const price = opts.marketBuy.price || 15; const n = Math.min(q, Math.max(0, (gold - (goal.reserveGold || 0)) / price)); stock[r] += n; gold -= n * price; }
    // finish builds
    for (const c of st.cities) {
      const cur = current[c.name];
      if (cur && busy[c.name] <= h) {
        if (cur.isNew) { if (cur.b === 'warehouse') { const v = c.b.warehouse; c.b.warehouse = Array.isArray(v) ? [...v, 1] : [1]; } else c.b[cur.b] = 1; c.freeSlots = Math.max(0, (c.freeSlots || 0) - 1); }
        else if (cur.b === 'warehouse') { const v = c.b.warehouse; const arr = Array.isArray(v) ? v : [v]; const i = arr.indexOf(Math.min(...arr)); arr[i] = cur.to; c.b.warehouse = arr; }
        else setLevel(c, cur.b, cur.to);
        if (cur.b === 'shrineOfOlympus') st.shrine.level = cur.to;
        current[c.name] = null; candAge = 99;
      }
    }
    // expansion milestone
    if (exp && !expQueue && !expDone && h >= (exp.startDay || 0) * 24) {
      const target = st.cities.length;
      expQueue = st.cities.map(c => ({ city: c.name, b: c.capital ? 'palace' : 'palaceColony', target }));
      milestones.push({ h, text: `Expansion prep starts: Palace and all Governor's Residences to level ${target}` });
    }
    if (expQueue && !expDone && expQueue.every(q => blevel(st.cities.find(c => c.name === q.city), q.b) >= q.target)) {
      const ag = st.cities.find(c => c.capital);
      const nc = { name: exp.name || ('Colony ' + (st.cities.length + 1)), coords: exp.coords || '?', lux: exp.lux || 'marble', pop: 40, woodLvl: exp.woodLvl || 25, luxLvl: exp.luxLvl || 25,
        cultural: 0, scientists: 0, god: 'pan', freeSlots: 16, isNewColony: true,
        slotPlan: ['tavern', 'museum', 'palaceColony', 'warehouse', 'forester', 'carpentering', 'architect', LUX_BONUS[exp.lux || 'marble'], 'vineyard'],
        b: { townHall: 1 } };
      ag.pop -= 40; stock.wood -= 1250; gold -= 50000;
      st.cities.push(nc); busy[nc.name] = h + (exp.travelHours || 2); current[nc.name] = null;
      candAge = 99;
      milestones.push({ h, text: `Town #${st.cities.length} founded: ${nc.name} (${nc.lux} island)` });
      if (exp.every && st.cities.length < (exp.maxTowns || 8)) { expQueue = null; exp.startDay = h / 24 + exp.every; exp.name = 'Colony ' + (st.cities.length + 1); }
      else expDone = true;
    }
    // wine policy
    let wineNeed = 0; const serve = {};
    for (const c of st.cities) {
      const mp = maxPop(c, st), bs = baseSat(c, st), corr = corruption(c, st), tav = blevel(c, 'tavern');
      let sv = tav;
      if (c.pop >= mp - 1) { sv = 0; while (sv < tav && (1 - corr) * (bs + WINE_SAT[sv]) < mp + 5) sv++; }
      serve[c.name] = sv; wineNeed += wineUse(c, sv);
    }
    const wineBuffer = wineNeed * 36;
    // research: scientists from overflow (pop beyond worker caps) and from surplus luxury cities
    for (const c of st.cities) {
      const caps = workerCaps(c, st), acad = ACADEMY_SCI[blevel(c, 'academy')] || 0;
      let sci = c.userScientists || 0;
      const overflow = Math.max(0, Math.floor(c.pop) - caps.wood - caps.lux);
      sci += overflow;
      if (opts.autoScience !== false && ['glass', 'sulfur', 'wine'].includes(c.lux) && stock[c.lux] > (opts.luxSurplus ?? 150000) + (c.lux === 'wine' ? wineBuffer : 0)) sci = acad;
      c.scientists = Math.min(acad, sci);
    }
    while (rq.length && rpTotal >= rq[0].rp + rpSpent) {
      const it = rq.shift(); rpSpent += it.rp; it.apply && it.apply(st);
      milestones.push({ h, text: `Research done: ${it.name}` }); candAge = 99;
    }
    // production
    for (const c of st.cities) {
      const o = { blessed, goldWeight: 0.02 };
      let wAl = w;
      if (c.lux === 'wine') { wAl = { ...w, wine: Math.min(w.wine, 0.8) }; o.minLux = stock.wine < wineBuffer ? wineNeed * 1.15 + (wineBuffer - stock.wine) / 24 : wineNeed * 0.95; }
      else if (c.lux === 'marble') o.luxFrac = 1;
      else { const tgt = (expQueue && !expDone) ? (opts.expLuxTarget ?? 120000) : (opts.luxTarget ?? 30000); o.luxFrac = stock[c.lux] < tgt ? 0.5 : 0; }
      const al = allocate(c, st, Math.floor(c.pop), wAl, o);
      RES.forEach(r => stock[r] += al.prod[r] * (1 - corruption(c, st) * 0));
      gold += al.gold; rpTotal += al.rp; c._al = al;
    }
    // wine consumption + growth
    for (const c of st.cities) {
      let sv = serve[c.name]; let need = wineUse(c, sv);
      while (sv > 0 && stock.wine < need) { sv--; need = wineUse(c, sv); }
      stock.wine -= need; c._serve = sv;
      const sat = (1 - corruption(c, st)) * (baseSat(c, st) + WINE_SAT[sv]);
      const mp = maxPop(c, st);
      const p1 = sat + (c.pop - sat) * Math.exp(-1 / 50);
      c.pop = c.pop < mp ? Math.min(mp, p1) : (sat < c.pop ? p1 : c.pop);
      c._sat = sat; c._mp = mp;
    }
    // scheduling
    if (candAge++ >= 6) { cands = candidates(st, w, opts); candAge = 0; }
    for (const c of st.cities) {
      if (current[c.name] || busy[c.name] > h) continue;
      // expansion builds take priority in their city
      const q = expQueue && !expDone ? expQueue.find(x => x.city === c.name && blevel(c, x.b) < x.target) : null;
      let list;
      list = cands.filter(a => a.city === c.name).slice(0, 5);
      if (expQueue && !expDone) {
        const remaining = expQueue.reduce((t, x) => { const cc = st.cities.find(y => y.name === x.city); if (blevel(cc, x.b) >= x.target) return t; const kk = upgradeCost(cc, x.b, x.target, st.research); return t + RES.reduce((u, r) => u + kk[r], 0); }, 0);
        list = list.filter(a => a.costEq <= (opts.expAllowance ?? 0.04) * remaining);
        if (q) list.unshift({ steps: [{ b: q.b, isNew: false }], label: 'Expansion prep', payback: 0, priority: true });
      }
      if (!list.length) continue;
      const firstReg = list.find(x => !x.priority); const bestPay = firstReg ? firstReg.payback : Infinity;
      for (const a of list) {
        if (!a.priority && a.payback > bestPay * 1.6) break;
        let { b, isNew } = a.steps[0];
        if (isNew && (c.freeSlots || 0) <= 0) continue;
        let to = (isNew ? 0 : blevel(c, b)) + 1;
        let k = upgradeCost(c, b, to, st.research); if (!k) continue;
        // storage limit: upgrade/build a warehouse first
        const cap = capacity(c);
        if (RES.some(r => k[r] > cap * 0.98)) {
          const v = c.b.warehouse; const arr = Array.isArray(v) ? v : (v ? [v] : []);
          if (!arr.length) { if ((c.freeSlots || 0) <= 0) continue; b = 'warehouse'; isNew = true; to = 1; }
          else { b = 'warehouse'; isNew = false; to = Math.min(...arr) + 1; }
          k = upgradeCost(c, 'warehouse', to, st.research);
          a.label = 'Warehouse (storage needed)';
        }
        let ok = RES.every(r => stock[r] >= k[r]);
        if (!ok) ok = tryTrade(c, k, wineBuffer);
        if (!ok) continue;
        startBuild(c, b, to, isNew, a.label, a.payback);
        break;
      }
    }
    if (h % 24 === 23 || h === 0) {
      const prod = { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 };
      st.cities.forEach(c => RES.forEach(r => prod[r] += c._al.prod[r]));
      daily.push({ day: Math.floor((h + 1) / 24), names: st.cities.map(c => c.name), pop: st.cities.map(c => Math.round(c.pop)), maxPop: st.cities.map(c => c._mp), serve: st.cities.map(c => c._serve),
        prod, stock: { ...stock }, gold: Math.round(gold), rp: Math.round(rpTotal), trades,
        alloc: st.cities.map(c => ({ wood: c._al.wood, lux: c._al.lux, woodHH: c._al.woodHH, luxHH: c._al.luxHH, tax: c._al.tax, sci: c.scientists || 0 })),
        cityProd: st.cities.map(c => ({ ...c._al.prod })), cityWine: st.cities.map(c => wineUse(c, c._serve)), sat: st.cities.map(c => Math.round(c._sat)) });
    }
  }
  return { events, daily, tradeLog, milestones, final: st, stock, gold, trades, w, rpTotal };
}

// ---- Logistics: daily transport flows between towns over a window of the simulation ----
export function islandDistance(a, b) {
  const p = s => (s || '').split(':').map(Number);
  const [x1, y1] = p(a), [x2, y2] = p(b);
  if ([x1, y1, x2, y2].some(isNaN)) return null;
  return Math.hypot(x1 - x2, y1 - y2);
}
export function travelMinutes(a, b) { const d = islandDistance(a, b); if (d == null) return null; return d === 0 ? 10 : Math.round(20 * d); }
export function routes(sim, st, fromDay = 0, toDay = 3) {
  const days = Math.max(1, toDay - fromDay);
  const names = st.cities.map(c => c.name);
  const net = {}; names.forEach(n => { net[n] = { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 }; });
  const snaps = sim.daily.filter(d => d.day > fromDay && d.day <= toDay);
  for (const d of snaps) d.names.forEach((n, i) => { if (!net[n]) return; RES.forEach(r => net[n][r] += d.cityProd[i][r] * 24 / snaps.length); net[n].wine -= d.cityWine[i] * 24 / snaps.length; });
  for (const e of sim.events) { if (e.h < fromDay * 24 || e.h >= toDay * 24 || !net[e.city]) continue; RES.forEach(r => net[e.city][r] -= e.cost[r] / days); }
  const flows = [];
  for (const r of RES) {
    const sur = names.map(n => ({ n, x: net[n][r] })).filter(o => o.x > 500).sort((a, b) => b.x - a.x);
    const def = names.map(n => ({ n, x: -net[n][r] })).filter(o => o.x > 500).sort((a, b) => b.x - a.x);
    for (const dd of def) for (const ss of sur) {
      if (dd.x <= 0) break; if (ss.x <= 0) continue;
      const q = Math.min(dd.x, ss.x); dd.x -= q; ss.x -= q;
      const ca = st.cities.find(c => c.name === ss.n), cb = st.cities.find(c => c.name === dd.n);
      flows.push({ res: r, from: ss.n, to: dd.n, perDay: Math.round(q / 100) * 100, ships: Math.ceil(q / 500), minutes: travelMinutes(ca.coords, cb.coords) });
    }
  }
  return flows.filter(f => f.perDay >= 500).sort((a, b) => b.perDay - a.perDay);
}

