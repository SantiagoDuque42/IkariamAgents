// Mayor — snapshot of your own empire, as a bookmarklet. Read-only.
// Click it in your Ikariam tab: it opens each of your towns and their islands the way the game UI does,
// then downloads `mayor.snapshot_<server>_<YYYYMMDD-HHmm>.json` (schema mayor.snapshot.v1).
// "Copy for planner" copies the older format the Empire Planner's importer understands.
(async () => {
  const VERSION = '0.3.1';
  // Shared helpers for the in-game bookmarklets (Mayor, Cartographer).
// Written as an ES module so tests can import it; tools/build.mjs inlines it into each bookmarklet
// (stripping `export`) wherever a bookmarklet source contains the line `/*@shared*/`.
// Everything here is read-only: it issues the same GET requests the game UI makes when you open a view.

const ORD = { 1: 'wine', 2: 'marble', 3: 'glass', 4: 'sulfur' };
const ARMY = ['', 'phalanx', 'steamgiant', 'spearman', 'swordsman', 'slinger', 'archer', 'marksman', 'ram', '', 'catapult', 'mortar', 'gyrocopter', 'bombardier', 'cook', 'medic', 'spartan'];
const NAVY = ['', 'ship_flamethrower', 'ship_steamboat', 'ship_ram', 'ship_ballista', 'ship_catapult', 'ship_mortar', 'ship_rocketship', 'ship_submarine', '', 'ship_paddlespeedship', 'ship_ballooncarrier', 'ship_tender'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Human-paced delay between requests: uniform in [min, max] ms. */
const pace = (min = 700, max = 1400) => sleep(min + Math.random() * (max - min));

/** Depth-first search for the first object satisfying `test`. */
function find(o, test, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 8) return null;
  if (test(o)) return o;
  for (const k of Object.keys(o)) { const r = find(o[k], test, depth + 1); if (r) return r; }
  return null;
}

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; };
const numOrNull = v => (v == null || v === '' ? null : num(v));

/**
 * Structural summary of an unknown response: key names, types and array lengths only, never values.
 * Exception: a short alphanumeric string at index 0 of an array is kept, because Ikariam's ajax
 * responses are lists of [command, data] pairs ("updateGlobalData", "changeView", …).
 */
function shape(o, depth = 0) {
  if (Array.isArray(o)) {
    if (depth > 4) return `array(${o.length})`;
    return o.slice(0, 4).map((x, i) => (i === 0 && typeof x === 'string' && /^[A-Za-z_]{1,40}$/.test(x)) ? x : shape(x, depth + 1)).concat(o.length > 4 ? [`…${o.length}`] : []);
  }
  if (o && typeof o === 'object') {
    if (depth > 4) return 'object';
    const r = {}; for (const k of Object.keys(o).slice(0, 80)) r[k] = shape(o[k], depth + 1); return r;
  }
  return o === null ? 'null' : typeof o;
}

/**
 * Extract island facts from an island-view response.
 * Expected shape (to be confirmed on a real response): an object with `tradegood` plus
 * `resourceLevel` / `tradegoodLevel`, optionally `wonder*`, `xCoord`/`yCoord` and a `cities` list
 * whose free spots have a type like "buildplace". Returns null when no such object exists.
 */
function parseIsland(json) {
  const isl = find(json, o => !Array.isArray(o) && 'tradegood' in o && ('resourceLevel' in o || 'tradegoodLevel' in o || ('cities' in o && 'xCoord' in o)));
  if (!isl) return null;
  const pick = (...ks) => { for (const k of ks) if (isl[k] != null && isl[k] !== '') return num(isl[k]); return null; };
  const list = Array.isArray(isl.cities) ? isl.cities : (isl.cities && typeof isl.cities === 'object' ? Object.values(isl.cities) : []);
  const isFree = c => /buildplace|empty|free/i.test(String(c?.type ?? ''));
  const towns = list.filter(c => c && !isFree(c)).map(c => ({
    id: c.id != null ? String(c.id) : null,
    name: c.name ?? null,
    player: c.ownerName ?? c.owner ?? null,
    playerId: c.ownerId != null ? String(c.ownerId) : null,
    alliance: c.ownerAllyTag ?? c.allyTag ?? null,
    level: numOrNull(c.level),
    state: c.state || null,
  }));
  return {
    id: isl.id != null ? String(isl.id) : null,
    name: isl.name ?? null,
    x: numOrNull(isl.xCoord), y: numOrNull(isl.yCoord),
    tradegood: ORD[isl.tradegood] || null,
    woodLvl: pick('resourceLevel', 'woodLevel', 'sawmillLevel'),
    luxLvl: pick('tradegoodLevel', 'luxuryLevel', 'mineLevel'),
    wonder: isl.wonderName || null,
    wonderLvl: pick('wonderLevel'),
    spots: list.length || null,
    freeSpots: list.length ? list.filter(isFree).length : null,
    towns,
    _keys: Object.keys(isl),
  };
}

/** The game answers some ajax views with ["custom", ["reload", {link}]]: it wants a full page load of `link`. */
function reloadLink(json) {
  const r = find(json, o => Array.isArray(o) && o[0] === 'reload' && o[1] && typeof o[1].link === 'string');
  return r ? r[1].link : null;
}

/** A full HTML page embeds the same [[command, data], …] list the ajax view returns; parse it if present. */
function parseEmbedded(html) {
  const i = html.indexOf('[["updateGlobalData"');
  if (i < 0) return null;
  // walk to the matching closing bracket
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < html.length && k < i + 3e6; k++) {
    const ch = html[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '[') depth++; else if (ch === ']' && --depth === 0) {
      try { return parseIsland(JSON.parse(html.slice(i, k + 1))); } catch { return null; }
    }
  }
  return null;
}

/** Last resort on a full page: read the island fields by name, whatever script wraps them (quotes may be escaped). */
function parseIslandHtml(html) {
  const pick = key => { const m = html.match(new RegExp('\\\\?"' + key + '\\\\?"\\s*:\\s*\\\\?"?([^"\\\\,}]{1,60})')); return m ? m[1].trim() : null; };
  const res = pick('resourceLevel'), trade = pick('tradegoodLevel');
  if (res == null && trade == null) return null;
  return {
    id: pick('islandId'), name: null, x: numOrNull(pick('xCoord')), y: numOrNull(pick('yCoord')),
    tradegood: ORD[pick('tradegood')] || null,
    woodLvl: numOrNull(res), luxLvl: numOrNull(trade),
    wonder: pick('wonderName'), wonderLvl: numOrNull(pick('wonderLevel')),
    spots: null, freeSpots: null, towns: [], _keys: ['(page text)'],
  };
}

/** Names of level-ish keys in a page, for diagnostics (names only, never values). */
const levelKeys = html => [...new Set([...html.matchAll(/\\?"(\w{0,30}(?:[Ll]evel|tradegood|wonder)\w{0,20})\\?"\s*:/g)].map(m => m[1]))].slice(0, 60);

/**
 * Read one island the way the game UI does. The ajax island view first; the game usually answers
 * "reload" (24 Nov 2026), and the reload page shows the island of the *current* town, not the one
 * asked for (25 Nov 2026). So: full page load of view=island&islandId=<id>, and accept an island
 * only when its id matches. Returns { island, via } or { island: null, diag }.
 */
async function readIsland(client, id) {
  const want = isl => isl && isl.id != null && String(isl.id) === String(id);
  let last = null, seen = null;
  for (const params of [
    { view: 'island', islandId: id, backgroundView: 'island', currentIslandId: id },
  ]) {
    last = await client.get(params);
    await pace();
    const isl = parseIsland(last);
    if (want(isl)) return { island: isl, via: 'ajax' };
    if (isl) seen = isl.id;
  }
  const html = await client.getText(`/index.php?view=island&islandId=${encodeURIComponent(id)}`);
  await pace();
  const a = parseEmbedded(html);
  if (want(a)) return { island: a, via: 'page-json' };
  const b = a ? null : parseIslandHtml(html); // text fallback only when the page has no readable island data
  if (b && (b.id == null || String(b.id) === String(id))) return { island: { ...b, id: String(id) }, via: 'page-text' };
  return { island: null, diag: { wrongIsland: seen ?? a?.id ?? b?.id ?? null, reload: !!reloadLink(last), pageLength: html.length, keys: levelKeys(html) } };
}

/** Game client bound to the current tab: carries the actionRequest token like the game UI does. */
function gameClient() {
  const html = document.documentElement.innerHTML;
  let ar = (window.ikariam && (window.ikariam.model?.actionRequest || window.ikariam.getModel?.()?.actionRequest))
    || document.querySelector('input[name=actionRequest]')?.value
    || (html.match(/actionRequest["']?\s*[:=]\s*["']([0-9a-f]{20,})/i) || [])[1];
  const get = async (params, { ajax = true } = {}) => {
    const q = new URLSearchParams({ ...params, ...(ajax ? { ajax: 1 } : {}) }); if (ar) q.set('actionRequest', ar);
    const r = await fetch('/index.php?' + q, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    const t = await r.text();
    let j; try { j = JSON.parse(t); } catch { return { _nonJson: true, status: r.status, length: t.length }; }
    const g = find(j, o => typeof o.actionRequest === 'string'); if (g) ar = g.actionRequest;
    return j;
  };
  // Full page load of a same-origin game URL (what the browser does when the game asks for a reload).
  const getText = async path => {
    const r = await fetch(path, { credentials: 'same-origin' });
    const t = await r.text();
    const m = t.match(/actionRequest["']?\s*[:=]\s*["']([0-9a-f]{20,})/i); if (m) ar = m[1];
    return t;
  };
  return { get, getText };
}

function relatedCities() {
  const html = document.documentElement.innerHTML;
  let related = window.dataSetForView?.relatedCityData || window.ikariam?.model?.relatedCityData;
  if (!related) { const m = html.match(/relatedCityData:\s*JSON\.parse\('(.+?)'\)/); if (m) related = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')); }
  return related || null;
}

const serverId = () => location.host.split('.')[0]; // e.g. "s74-es"

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function envelope(schema, producer, payload, extra = {}) {
  return { schema, producedAt: new Date().toISOString(), producer, server: serverId(), player: null, scope: {}, ...extra, payload };
}

/** Save a JSON file through the browser's normal download (lands in the download folder, e.g. the Drive inbox). */
function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}

/** Small floating panel. buttons: [{label, onClick}] ; html: trusted static markup only. */
function overlay(id, title, body, buttons = [], html = '') {
  document.getElementById(id)?.remove();
  const d = document.createElement('div');
  d.id = id;
  d.style.cssText = 'position:fixed;z-index:99999;top:40px;left:50%;transform:translateX(-50%);width:min(640px,92vw);background:#fff;color:#222;border:2px solid #9a6a24;border-radius:10px;padding:14px;font:14px/1.4 sans-serif;box-shadow:0 6px 30px rgba(0,0,0,.4)';
  d.innerHTML = '<b></b><p style="margin:6px 0;white-space:pre-wrap"></p>' + html + '<div class="ika-btns" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>';
  d.querySelector('b').textContent = title; d.querySelector('p').textContent = body;
  const bar = d.querySelector('.ika-btns');
  for (const b of [...buttons, { label: 'Close', onClick: () => d.remove() }]) {
    const el = document.createElement('button'); el.textContent = b.label; el.style.cssText = 'padding:5px 12px;cursor:pointer';
    el.onclick = () => b.onClick(el, d); bar.appendChild(el);
  }
  document.body.appendChild(d);
  return d;
}

async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  if (btn) btn.textContent = 'Copied';
}

  const ID = 'ika-mayor';
  const say = (t, b, btns) => overlay(ID, t, b, btns);
  try {
    if (!/ikariam/.test(location.host)) throw new Error('Open your Ikariam game tab first, then click the bookmark.');
    const related = relatedCities();
    if (!related) throw new Error('Could not find your town list on this page. Reload the game and try again.');
    const own = Object.values(related).filter(c => c && c.relationship === 'ownCity');
    const startId = String(related.selectedCityId || (related.selectedCity || '').replace('city_', '') || own[0].id);
    const { get, getText } = gameClient();
    const diag = {};
    const payload = { cities: [], islands: {} };
    say('Mayor', `Reading ${own.length} towns…`);

    for (const c of own) {
      const j = await get({ view: 'cityMilitary', cityId: c.id, backgroundView: 'city', currentCityId: c.id });
      let bg = find(j, o => Array.isArray(o.position) && 'islandXCoord' in o);
      let hd = find(j, o => o.currentResources && o.maxResources);
      if (!bg || !hd) {
        await pace(400, 800);
        const j2 = await get({ view: 'city', cityId: c.id, backgroundView: 'city', currentCityId: c.id });
        bg = bg || find(j2, o => Array.isArray(o.position) && 'islandXCoord' in o);
        hd = hd || find(j2, o => o.currentResources && o.maxResources);
        if (!bg || !hd) { (diag.city ??= {})[c.id] = shape(j2); }
      }
      if (!bg || !hd) throw new Error('Unexpected game response for ' + c.name);
      const b = {}; let freeSlots = 0, upgrading = null;
      bg.position.forEach(p => {
        let k = String(p.building || '');
        if (/buildingGround/.test(k)) { if (/land/.test(k)) freeSlots++; return; }
        if (/constructionSite/.test(k)) { k = k.replace(/\s*constructionSite/, ''); upgrading = k.trim(); }
        k = k.trim(); const L = parseInt(p.level) || 0; if (!k || !L) return;
        if (['warehouse', 'port', 'shipyard'].includes(k)) (b[k] = b[k] || []).push(L); else b[k] = L;
      });
      const r = hd.currentResources, units = {};
      const view = find(j, o => Array.isArray(o) && o[0] === 'cityMilitary' && typeof o[1] === 'string');
      if (view) {
        const doc = new DOMParser().parseFromString(view[1], 'text/html');
        const cells = sel => [...doc.querySelectorAll(sel + ' .militaryList .count td')].map(td => num(td.textContent));
        cells('#tabUnits').forEach((n, i) => { if (ARMY[i] && n) units[ARMY[i]] = n; });
        cells('#tabShips').forEach((n, i) => { if (NAVY[i] && n) units[NAVY[i]] = n; });
      }
      payload.cities.push({
        id: String(bg.id), name: bg.name, coords: `${bg.islandXCoord}:${bg.islandYCoord}`, islandId: String(bg.islandId),
        capital: !!bg.isCapital, lux: ORD[hd.producedTradegood] || null, b, freeSlots, upgrading, units,
        population: num(r.population), freeCitizens: num(r.citizens),
        stock: { wood: num(r.resource), wine: num(r[1]), marble: num(r[2]), glass: num(r[3]), sulfur: num(r[4]) },
        capacity: num(hd.maxResources?.resource), wineSpendings: num(hd.wineSpendings),
        prodPerHour: { wood: Math.round(num(hd.resourceProduction) * 3600), lux: Math.round(num(hd.tradegoodProduction) * 3600) },
      });
      payload.gold = num(hd.gold); payload.ships = num(hd.maxTransporters); payload.freeShips = num(hd.freeTransporters);
      if (hd.ambrosia != null) payload.ambrosia = num(hd.ambrosia);
      if (hd.maxActionPoints != null) payload.actionPoints = num(hd.maxActionPoints);
      say('Mayor', `Read ${payload.cities.length} of ${own.length} towns…`);
      await pace();
    }

    // Islands: see readIsland (ajax view, then a full page load of the requested island, id-checked).
    const client = { get, getText };
    for (const id of [...new Set(payload.cities.map(c => c.islandId))]) {
      const r = await readIsland(client, id);
      if (r.island) {
        const { _keys, towns, ...facts } = r.island;
        payload.islands[id] = { ...facts, towns: towns.length || null, via: r.via };
        if (facts.woodLvl == null || facts.luxLvl == null) (diag.islandKeys ??= {})[id] = _keys;
      } else (diag.island ??= {})[id] = r.diag;
    }
    await get({ view: 'city', cityId: startId, backgroundView: 'city', currentCityId: startId });

    const env = envelope('mayor.snapshot.v1', 'mayor@' + VERSION, payload, { scope: { towns: own.length } });
    if (Object.keys(diag).length) env.diag = diag;
    const fname = `mayor.snapshot_${env.server}_${stamp()}.json`;
    window.__atlasLast = env; // lets a Claude-in-Chrome session read the result without a download
    if (!window.__atlasNoDownload) download(env, fname);
    const legacy = { type: 'ikariam-snapshot', version: 1, takenAt: env.producedAt, server: location.host, ...payload };
    const nIsl = Object.keys(payload.islands).length;
    say('Mayor: snapshot ready',
      `${payload.cities.length} towns, ${nIsl} islands. Saved as ${fname}.` + (env.diag ? '\nSome game responses had an unexpected shape; the file includes their structure (no values) so the parser can be fixed.' : ''),
      [{ label: 'Download again', onClick: () => download(env, fname) }, { label: 'Copy for planner', onClick: btn => copyText(JSON.stringify(legacy), btn) }]);
  } catch (e) {
    say('Mayor failed', e.message + ' — nothing in your game was changed.');
  }
})();
