// Cartographer (in-game source) — map extract for an area and filter, as a bookmarklet. Read-only.
// Click it in your Ikariam tab, choose an area (x/y ranges), luxury goods and how many islands to open,
// then it downloads `cartographer.map_<server>_<YYYYMMDD-HHmm>_<tag>.json` (schema cartographer.map.v1).
//
// Step 1 reads the world-map data for the area (one request). Step 2 opens up to N islands, nearest
// first, at a human pace, to read levels, free spots and towns. Response shapes are unverified until the
// first real run; anything unrecognised is saved as structure-only diagnostics in the file.
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
  return { get };
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

  const ID = 'ika-carto';
  const say = (t, b, btns, html) => overlay(ID, t, b, btns, html);
  const GOODS = ['wine', 'marble', 'glass', 'sulfur'];

  const askScope = () => new Promise(resolve => {
    const related = relatedCities() || {};
    const sel = Object.values(related).find(c => c && String(c.id) === String(related.selectedCityId)) || {};
    const m = String(sel.coords || '').match(/(\d+)\s*:\s*(\d+)/);
    const cx = m ? +m[1] : 50, cy = m ? +m[2] : 50;
    const inp = (id, v, w = 52) => `<input id="${id}" type="number" value="${v}" style="width:${w}px">`;
    const html = `<div style="display:grid;gap:6px;font-size:13px">
      <label>x from ${inp('c-x0', cx - 5)} to ${inp('c-x1', cx + 5)} &nbsp; y from ${inp('c-y0', cy - 5)} to ${inp('c-y1', cy + 5)}</label>
      <label>Luxury goods: ${GOODS.map(g => `<label style="margin-right:8px"><input type="checkbox" class="c-g" value="${g}" checked> ${g}</label>`).join('')}</label>
      <label>Open at most ${inp('c-n', 20)} islands (nearest first; 0 = world-map data only)</label></div>`;
    say('Cartographer', 'Choose the area to map. Opening islands takes about 2–3 s each.', [{
      label: 'Map it', onClick: (_, d) => {
        const v = id => +d.querySelector('#' + id).value;
        const goods = [...d.querySelectorAll('.c-g')].filter(x => x.checked).map(x => x.value);
        resolve({ bbox: [Math.min(v('c-x0'), v('c-x1')), Math.max(v('c-x0'), v('c-x1')), Math.min(v('c-y0'), v('c-y1')), Math.max(v('c-y0'), v('c-y1'))],
          tradegood: goods.length === 4 ? [] : goods, maxIslands: Math.max(0, Math.min(60, v('c-n'))), center: [cx, cy] });
      },
    }], html);
  });

  // World-map area data. Expected (unverified): { data: { "<x>": { "<y>": [islandId, name, ...] } } }.
  const parseArea = j => {
    const data = j && typeof j === 'object' ? (j.data ?? j) : null;
    if (!data || typeof data !== 'object') return null;
    const out = [];
    for (const [x, col] of Object.entries(data)) {
      if (!/^\d+$/.test(x) || !col || typeof col !== 'object') continue;
      for (const [y, row] of Object.entries(col)) {
        if (!/^\d+$/.test(y) || !Array.isArray(row) || row[0] == null) continue;
        out.push({ id: String(row[0]), name: typeof row[1] === 'string' ? row[1] : null, x: +x, y: +y, areaRaw: row });
      }
    }
    return out.length ? out : null;
  };

  try {
    if (!/ikariam/.test(location.host)) throw new Error('Open your Ikariam game tab first, then click the bookmark.');
    const scope = await askScope();
    const [x0, x1, y0, y1] = scope.bbox;
    const { get } = gameClient();
    const diag = {};
    say('Cartographer', `Reading world map ${x0}–${x1} × ${y0}–${y1}…`);
    const area = await get({ action: 'WorldMap', function: 'getJSONArea', x_min: x0, x_max: x1, y_min: y0, y_max: y1 }, { ajax: false });
    let islands = parseArea(area);
    if (!islands) { diag.area = shape(area); islands = []; }
    islands.sort((a, b) => Math.hypot(a.x - scope.center[0], a.y - scope.center[1]) - Math.hypot(b.x - scope.center[0], b.y - scope.center[1]));

    let opened = 0;
    for (const isl of islands.slice(0, scope.maxIslands)) {
      say('Cartographer', `Opening island ${++opened} of ${Math.min(scope.maxIslands, islands.length)} (${isl.x}:${isl.y})…`);
      const j = await get({ view: 'island', islandId: isl.id, backgroundView: 'island', currentIslandId: isl.id });
      const p = parseIsland(j);
      if (p) { const { _keys, ...facts } = p; Object.assign(isl, facts, { id: isl.id, x: isl.x, y: isl.y, name: isl.name ?? facts.name, detail: 'island' }); if (p.woodLvl == null) (diag.islandKeys ??= {})[isl.id] = _keys; }
      else if (!diag.island) diag.island = shape(j); // one example is enough
      await pace(1800, 3200);
    }
    islands.forEach(i => { i.detail ??= 'map'; });
    const kept = scope.tradegood.length ? islands.filter(i => i.detail === 'island' && scope.tradegood.includes(i.tradegood)) : islands;
    const related = relatedCities();
    if (related?.selectedCityId) await get({ view: 'city', cityId: related.selectedCityId, backgroundView: 'city', currentCityId: related.selectedCityId });

    const env = envelope('cartographer.map.v1', 'cartographer-game@' + VERSION, { islands: kept, players: [] },
      { scope: { source: 'game', bbox: scope.bbox, tradegood: scope.tradegood, maxIslands: scope.maxIslands, islandsInArea: islands.length, opened } });
    if (Object.keys(diag).length) env.diag = diag;
    const tag = `${scope.tradegood.join('-') || 'all'}_${x0}-${x1}x${y0}-${y1}`;
    const fname = `cartographer.map_${env.server}_${stamp()}_${tag}.json`;
    window.__atlasLast = env; // lets a Claude-in-Chrome session read the result without a download
    if (!window.__atlasNoDownload) download(env, fname);
    say('Cartographer: map ready',
      `${islands.length} islands in the area, ${opened} opened, ${kept.length} kept after the filter. Saved as ${fname}.` + (env.diag ? '\nSome responses had an unexpected shape; their structure (no values) is in the file so the parser can be fixed.' : ''),
      [{ label: 'Download again', onClick: () => download(env, fname) }]);
  } catch (e) {
    say('Cartographer failed', e.message + ' — nothing in your game was changed.');
  }
})();
