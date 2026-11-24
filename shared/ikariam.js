// Shared helpers for the in-game bookmarklets (Mayor, Cartographer).
// Written as an ES module so tests can import it; tools/build.mjs inlines it into each bookmarklet
// (stripping `export`) wherever a bookmarklet source contains the line `/*@shared*/`.
// Everything here is read-only: it issues the same GET requests the game UI makes when you open a view.

export const ORD = { 1: 'wine', 2: 'marble', 3: 'glass', 4: 'sulfur' };
export const ARMY = ['', 'phalanx', 'steamgiant', 'spearman', 'swordsman', 'slinger', 'archer', 'marksman', 'ram', '', 'catapult', 'mortar', 'gyrocopter', 'bombardier', 'cook', 'medic', 'spartan'];
export const NAVY = ['', 'ship_flamethrower', 'ship_steamboat', 'ship_ram', 'ship_ballista', 'ship_catapult', 'ship_mortar', 'ship_rocketship', 'ship_submarine', '', 'ship_paddlespeedship', 'ship_ballooncarrier', 'ship_tender'];

export const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Human-paced delay between requests: uniform in [min, max] ms. */
export const pace = (min = 700, max = 1400) => sleep(min + Math.random() * (max - min));

/** Depth-first search for the first object satisfying `test`. */
export function find(o, test, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 8) return null;
  if (test(o)) return o;
  for (const k of Object.keys(o)) { const r = find(o[k], test, depth + 1); if (r) return r; }
  return null;
}

export const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; };
export const numOrNull = v => (v == null || v === '' ? null : num(v));

/**
 * Structural summary of an unknown response: key names, types and array lengths only, never values.
 * Exception: a short alphanumeric string at index 0 of an array is kept, because Ikariam's ajax
 * responses are lists of [command, data] pairs ("updateGlobalData", "changeView", …).
 */
export function shape(o, depth = 0) {
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
export function parseIsland(json) {
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
export function reloadLink(json) {
  const r = find(json, o => Array.isArray(o) && o[0] === 'reload' && o[1] && typeof o[1].link === 'string');
  return r ? r[1].link : null;
}

/** A full HTML page embeds the same [[command, data], …] list the ajax view returns; parse it if present. */
export function parseEmbedded(html) {
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
export function parseIslandHtml(html) {
  const pick = key => { const m = html.match(new RegExp('\\\\?"' + key + '\\\\?"\\s*:\\s*\\\\?"?([^"\\\\,}]{1,60})')); return m ? m[1].trim() : null; };
  const res = pick('resourceLevel'), trade = pick('tradegoodLevel');
  if (res == null && trade == null) return null;
  return {
    id: pick('islandId') ?? pick('id'), name: null, x: numOrNull(pick('xCoord')), y: numOrNull(pick('yCoord')),
    tradegood: ORD[pick('tradegood')] || null,
    woodLvl: numOrNull(res), luxLvl: numOrNull(trade),
    wonder: pick('wonderName'), wonderLvl: numOrNull(pick('wonderLevel')),
    spots: null, freeSpots: null, towns: [], _keys: ['(page text)'],
  };
}

/** Names of level-ish keys in a page, for diagnostics (names only, never values). */
export const levelKeys = html => [...new Set([...html.matchAll(/\\?"(\w{0,30}(?:[Ll]evel|tradegood|wonder)\w{0,20})\\?"\s*:/g)].map(m => m[1]))].slice(0, 60);

/**
 * Read one island the way the game UI does: the ajax island view first; when the game answers
 * "reload", load the page it names (same origin only) and read the island from it.
 * Returns { island, via } or { island: null, diag }.
 */
export async function readIsland(client, id) {
  let last = null;
  for (const params of [
    { view: 'island', islandId: id, backgroundView: 'island', currentIslandId: id },
    { view: 'island', islandId: id },
  ]) {
    last = await client.get(params);
    await pace();
    const isl = parseIsland(last);
    if (isl) return { island: isl, via: 'ajax' };
    const link = reloadLink(last);
    if (link) {
      const url = new URL(link, location.origin);
      if (url.origin !== location.origin) break;
      const html = await client.getText(url.pathname + url.search);
      await pace();
      const a = parseEmbedded(html); if (a) return { island: a, via: 'page-json' };
      const b = parseIslandHtml(html); if (b) return { island: b, via: 'page-text' };
      return { island: null, diag: { reload: true, pageLength: html.length, keys: levelKeys(html) } };
    }
  }
  return { island: null, diag: shape(last) };
}

/** Game client bound to the current tab: carries the actionRequest token like the game UI does. */
export function gameClient() {
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

export function relatedCities() {
  const html = document.documentElement.innerHTML;
  let related = window.dataSetForView?.relatedCityData || window.ikariam?.model?.relatedCityData;
  if (!related) { const m = html.match(/relatedCityData:\s*JSON\.parse\('(.+?)'\)/); if (m) related = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')); }
  return related || null;
}

export const serverId = () => location.host.split('.')[0]; // e.g. "s74-es"

export function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function envelope(schema, producer, payload, extra = {}) {
  return { schema, producedAt: new Date().toISOString(), producer, server: serverId(), player: null, scope: {}, ...extra, payload };
}

/** Save a JSON file through the browser's normal download (lands in the download folder, e.g. the Drive inbox). */
export function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}

/** Small floating panel. buttons: [{label, onClick}] ; html: trusted static markup only. */
export function overlay(id, title, body, buttons = [], html = '') {
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

export async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  if (btn) btn.textContent = 'Copied';
}
