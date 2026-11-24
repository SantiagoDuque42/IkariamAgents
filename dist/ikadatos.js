// Cartographer (ikadatos source) — run this bookmarklet on any ikadatos.com page. Read-only.
// ikadatos refuses requests from servers, but pages you open in your own browser work, and so do
// same-origin requests made from them. Modes:
//   • "This page": extract what is on screen (an island, the inactives list, a player, any table).
//   • "Islands": open the ikadatos island page for each coordinate you list (paced) and extract it.
// Output: `cartographer.map_ikadatos-<world>_<YYYYMMDD-HHmm>_<tag>.json` (schema cartographer.map.v1,
// scope.source = "ikadatos"). It also records which data URLs the page loaded (paths and parameter
// names only), so a faster adapter can use them later.
// Free ikadatos data is refreshed every few days: every record carries `asOf`.
(async () => {
  const VERSION = '0.1.0';
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
    id: pick('islandId') ?? pick('id'), name: null, x: numOrNull(pick('xCoord')), y: numOrNull(pick('yCoord')),
    tradegood: ORD[pick('tradegood')] || null,
    woodLvl: numOrNull(res), luxLvl: numOrNull(trade),
    wonder: pick('wonderName'), wonderLvl: numOrNull(pick('wonderLevel')),
    spots: null, freeSpots: null, towns: [], _keys: ['(page text)'],
  };
}

/** Names of level-ish keys in a page, for diagnostics (names only, never values). */
const levelKeys = html => [...new Set([...html.matchAll(/\\?"(\w{0,30}(?:[Ll]evel|tradegood|wonder)\w{0,20})\\?"\s*:/g)].map(m => m[1]))].slice(0, 60);

/**
 * Read one island the way the game UI does: the ajax island view first; when the game answers
 * "reload", load the page it names (same origin only) and read the island from it.
 * Returns { island, via } or { island: null, diag }.
 */
async function readIsland(client, id) {
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

  const ID = 'ika-datos';
  const say = (t, b, btns, html) => overlay(ID, t, b, btns, html);
  const LUX = { vino: 'wine', marmol: 'marble', 'mármol': 'marble', cristal: 'glass', azufre: 'sulfur' };
  const STATUS = /\s*(Vacaciones|Inactivo|Baneado|Vacation|Inactive|Banned)\s*$/i;
  const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const world = new URLSearchParams(location.search).get('servidor') || (localStorage.getItem('atlas-world') || '');

  const tables = doc => [...doc.querySelectorAll('table')].map(t => {
    const rows = [...t.querySelectorAll('tr')];
    const head = rows.length && rows[0].querySelector('th') ? [...rows[0].querySelectorAll('th,td')].map(c => clean(c.textContent)) : [];
    const body = rows.slice(head.length ? 1 : 0).map(r => [...r.querySelectorAll('td,th')].map(c => clean(c.textContent))).filter(r => r.length);
    return { headers: head, rows: body.slice(0, 500) };
  }).filter(t => t.rows.length);

  const parseIslandPage = (doc, asOf) => {
    const text = clean(doc.body?.textContent);
    const m = text.match(/Isla\s*\[(\d+)\s*:\s*(\d+)\]/i); if (!m) return null;
    const lv = text.match(/(Vino|M[áa]rmol|Cristal|Azufre)\s+(\d+)\s+Madera\s+(\d+)/i);
    const occ = text.match(/Sitios ocupados\s*(\d+)\s*\/\s*(\d+)/i);
    const wl = text.slice(m.index + m[0].length).match(/^\s*(.+?)\s+(Vino|M[áa]rmol|Cristal|Azufre)\b/i);
    const towns = [];
    for (const t of tables(doc)) {
      for (const r of t.rows) {
        if (r.length < 5 || !/^\d+$/.test(r[r.length - 1])) continue;
        const [, who, ally, city, level] = r.slice(-5);
        const st = who.match(STATUS);
        towns.push({ id: null, name: city, player: clean(who.replace(STATUS, '')), playerId: null, alliance: /^[—-]?$/.test(ally) ? null : ally, level: +level, state: st ? st[1].toLowerCase() : null });
      }
    }
    return {
      id: `${m[1]}:${m[2]}`, name: null, x: +m[1], y: +m[2], detail: 'island', source: 'ikadatos', asOf,
      tradegood: wl ? LUX[wl[2].toLowerCase()] ?? null : (lv ? LUX[lv[1].toLowerCase()] ?? null : null),
      luxLvl: lv ? +lv[2] : null, woodLvl: lv ? +lv[3] : null,
      wonder: wl ? clean(wl[1]) : null, wonderLvl: null,
      spots: occ ? +occ[2] : null, freeSpots: occ ? +occ[2] - +occ[1] : null,
      towns,
    };
  };

  const parsePlayerPage = (doc, asOf) => {
    const h = doc.querySelector('h2, h1'); const text = clean(doc.body?.textContent);
    const p = text.match(/(Sin alianza|Alianza\s+\S+)?\s*Puntos actualizados\s+([^\n]+?\d{4})\s*(Vacaciones|Inactivo|Baneado)?/i);
    if (!h || !p) return null;
    return { id: null, name: clean(h.textContent), alliance: p[1] && !/^Sin/i.test(p[1]) ? clean(p[1].replace(/^Alianza\s+/i, '')) : null,
      score: null, rank: null, state: p[3] ? p[3].toLowerCase() : 'active', source: 'ikadatos', asOf: p[2] || asOf };
  };

  const discovery = () => ({
    resources: [...new Set(performance.getEntriesByType('resource')
      .filter(e => /ikadatos/.test(e.name) && !/\.(png|jpe?g|gif|svg|webp|css|woff2?|ttf)(\?|$)/i.test(e.name))
      .map(e => { const u = new URL(e.name); return u.pathname + (u.search ? '?' + [...u.searchParams.keys()].join('&') : ''); }))].slice(0, 80),
    globals: Object.keys(window).filter(k => { try { const v = window[k]; return v && typeof v === 'object' && !(v instanceof Node) && ((Array.isArray(v) && v.length > 50) || (!Array.isArray(v) && Object.keys(v).length > 50)); } catch { return false; } })
      .slice(0, 40).map(k => ({ name: k, type: Array.isArray(window[k]) ? 'array' : 'object', size: Array.isArray(window[k]) ? window[k].length : Object.keys(window[k]).length })),
  });

  const askMode = () => new Promise(resolve => {
    const html = `<div style="display:grid;gap:6px;font-size:13px">
      <label>World (servidor): <input id="d-w" style="width:120px"></label>
      <label><input type="radio" name="d-m" value="page" checked> This page</label>
      <label><input type="radio" name="d-m" value="islands"> Islands (one per line or comma-separated, e.g. 50:50):</label>
      <textarea id="d-c" style="width:100%;height:60px;font:12px monospace" placeholder="50:50, 51:50, 52:49"></textarea>
      <label>At most <input id="d-n" type="number" value="25" style="width:52px"> islands, about 2 s apart</label></div>`;
    const d = say('Cartographer · ikadatos', 'Extract data from ikadatos for the Strategist.', [{
      label: 'Extract', onClick: (_, el) => {
        const w = el.querySelector('#d-w').value.trim(); try { localStorage.setItem('atlas-world', w); } catch { /* ignore */ }
        const coords = [...el.querySelector('#d-c').value.matchAll(/(\d+)\s*:\s*(\d+)/g)].map(m => [+m[1], +m[2]]);
        resolve({ world: w, mode: el.querySelector('input[name=d-m]:checked').value, coords, max: Math.max(1, Math.min(60, +el.querySelector('#d-n').value || 25)) });
      },
    }], html);
    d.querySelector('#d-w').value = world;
  });

  try {
    if (!/ikadatos\./.test(location.host)) throw new Error('Open an ikadatos.com page first, then click the bookmark.');
    const opt = await askMode();
    if (!opt.world) throw new Error('Type the world name (the "servidor" in ikadatos links, e.g. atlas).');
    const asOf = new Date().toISOString();
    const islands = [], players = [], diag = {};
    let raw = [];
    if (opt.mode === 'page') {
      const i = parseIslandPage(document, asOf); if (i) islands.push(i);
      const p = !i && parsePlayerPage(document, asOf); if (p) players.push(p);
      raw = tables(document);
      diag.discovery = discovery();
    } else {
      const list = opt.coords.slice(0, opt.max);
      if (!list.length) throw new Error('List at least one island coordinate, e.g. 50:50.');
      let n = 0;
      for (const [x, y] of list) {
        say('Cartographer · ikadatos', `Island ${++n} of ${list.length} (${x}:${y})…`);
        const r = await fetch(`/buscador.php?servidor=${encodeURIComponent(opt.world)}&tipo=coordenadas&nombre=${x}%3A${y}`, { credentials: 'same-origin' });
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        const i = parseIslandPage(doc, asOf);
        if (i) islands.push(i); else (diag.notParsed ??= []).push(`${x}:${y} (HTTP ${r.status})`);
        await pace(1500, 2800);
      }
    }
    const tag = opt.mode === 'page' ? 'page' : `islands-${islands.length}`;
    const env = envelope('cartographer.map.v1', 'cartographer-ikadatos@' + VERSION, { islands, players, ...(raw.length ? { tables: raw } : {}) },
      { server: 'ikadatos-' + opt.world, scope: { source: 'ikadatos', world: opt.world, mode: opt.mode, page: location.pathname, requested: opt.coords.length } });
    if (Object.keys(diag).length) env.diag = diag;
    window.__atlasLast = env;
    const fname = `cartographer.map_ikadatos-${opt.world}_${stamp()}_${tag}.json`;
    if (!window.__atlasNoDownload) download(env, fname);
    say('Cartographer · ikadatos: ready', `${islands.length} islands, ${players.length} players, ${raw.length} tables. Saved as ${fname}.`,
      [{ label: 'Download again', onClick: () => download(env, fname) }]);
  } catch (e) {
    say('Cartographer · ikadatos failed', e.message);
  }
})();
