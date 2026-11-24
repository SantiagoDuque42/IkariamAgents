// Spymaster — espionage reports from your Hideouts, as a bookmarklet. Read-only.
// Click it in your Ikariam tab: it opens the Hideout of each of your towns, reads the spy reports kept there,
// optionally opens each target's town and island (warehouse level, wall, island good, inactive status),
// and downloads `spymaster.reports_<server>_<YYYYMMDD-HHmm>.json` (schema spymaster.reports.v1).
// The Drive importer (sheets/AtlasImporter.gs) turns that file into rows of the "Farmeos" sheet.
//
// Report markup (Hideout → Reports) follows IkaEasy's parser (js/page/tpl/safehouse.js, github.com/RandGor/IkaEasy):
// each report is a `tr.report` preceded by an info row with `.targetCity a` (href has xcoord, ycoord, selectCity),
// `.targetOwner` (onclick has tbl_mail<reportId>) and `.date`; warehouse reports hold `table.resourcesTable`
// rows with `.unitname img[src*=icon_<res>.png]` and `.count`. Garrison-report markup is unverified.
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

  const ID = 'ika-spy';
  const say = (t, b, btns, html) => overlay(ID, t, b, btns, html);
  const RES_ALIAS = { wood: 'wood', wine: 'wine', marble: 'marble', glass: 'glass', crystal: 'glass', sulfur: 'sulfur', sulphur: 'sulfur' };

  const parseDate = t => {
    const m = String(t || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})\D+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)).toISOString();
  };
  // Structure of an HTML page without its text: tag#id.class selectors, for fixing the parser.
  const htmlShape = html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seen = new Set();
    doc.querySelectorAll('[id],[class]').forEach(el => seen.add(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('')));
    return [...seen].slice(0, 250);
  };

  const parseReports = (html, spiedBy) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    doc.querySelectorAll('tr.report').forEach(tr => {
      const info = tr.previousElementSibling; if (!info) return;
      const a = info.querySelector('.targetCity a'); if (!a) return;
      const href = a.getAttribute('href') || '';
      const q = k => (href.match(new RegExp('[?&]' + k + '=([0-9]+)')) || [])[1] || null;
      const owner = info.querySelector('.targetOwner');
      const id = ((owner?.getAttribute('onclick') || '').match(/tbl_mail([0-9]+)/) || [])[1]
        || ((info.outerHTML + tr.outerHTML).match(/tbl_mail([0-9]+)/) || [])[1] || null;
      const dateText = info.querySelector('.date')?.textContent.trim() || null;
      const rep = {
        id, date: parseDate(dateText), dateText, mission: 'other',
        target: { cityId: q('selectCity') || q('cityId'), city: a.textContent.replace(/\[.*?\]/g, '').trim(), x: q('xcoord') ? +q('xcoord') : null, y: q('ycoord') ? +q('ycoord') : null, player: owner?.textContent.trim() || null },
        spiedBy,
      };
      const rt = tr.querySelector('table.resourcesTable');
      if (rt) {
        rep.mission = 'warehouse';
        rep.resources = { wood: 0, wine: 0, marble: 0, glass: 0, sulfur: 0 };
        rt.querySelectorAll('tr').forEach((row, i) => {
          if (i === 0) return;
          const src = row.querySelector('.unitname img')?.getAttribute('src') || '';
          const k = RES_ALIAS[(src.match(/icon_([a-z]+)\.png/) || [])[1]];
          if (k) rep.resources[k] = num(row.querySelector('.count')?.textContent);
        });
      } else {
        const units = {};
        tr.querySelectorAll('table.reportTable tr').forEach((row, i) => {
          if (i === 0) return;
          const name = (row.querySelector('.unitname')?.textContent || row.querySelector('img')?.getAttribute('title') || '').trim();
          const n = num(row.querySelector('.count')?.textContent);
          if (name && n) units[name] = (units[name] || 0) + n;
        });
        if (Object.keys(units).length) { rep.mission = 'garrison'; rep.units = units; }
        else rep.text = tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 300);
      }
      out.push(rep);
    });
    return out;
  };

  const askOptions = () => new Promise(resolve => {
    let me = ''; try { me = localStorage.getItem('atlas-player') || ''; } catch { /* storage blocked */ }
    const html = `<div style="display:grid;gap:6px;font-size:13px">
      <label>Your player name (goes in "Espiado por"): <input id="s-me" style="width:160px"></label>
      <label><input id="s-enrich" type="checkbox" checked> Also open each target's town and island (warehouse level, wall, island good, inactive) — about 2–3 s per target</label></div>`;
    const d = say('Spymaster', 'Reads the spy reports kept in your Hideouts.', [{
      label: 'Read reports', onClick: (_, el) => {
        const name = el.querySelector('#s-me').value.trim();
        try { if (name) localStorage.setItem('atlas-player', name); } catch { /* ignore */ }
        resolve({ me: name || null, enrich: el.querySelector('#s-enrich').checked });
      },
    }], html);
    d.querySelector('#s-me').value = me;
  });

  try {
    if (!/ikariam/.test(location.host)) throw new Error('Open your Ikariam game tab first, then click the bookmark.');
    const opts = await askOptions();
    const related = relatedCities();
    if (!related) throw new Error('Could not find your town list on this page. Reload the game and try again.');
    const own = Object.values(related).filter(c => c && c.relationship === 'ownCity');
    const startId = String(related.selectedCityId || own[0].id);
    const { get } = gameClient();
    const diag = {};
    const reports = new Map();
    let hideouts = 0;

    for (const c of own) {
      say('Spymaster', `Checking the Hideout in ${c.name}…`);
      const j = await get({ view: 'city', cityId: c.id, backgroundView: 'city', currentCityId: c.id });
      const bg = find(j, o => Array.isArray(o.position) && 'islandXCoord' in o);
      const pos = bg ? bg.position.findIndex(p => /^safehouse/.test(String(p.building || ''))) : -1;
      await pace();
      if (pos < 0) continue;
      hideouts++;
      let html = null;
      for (const extra of [{ activeTab: 'tabReports' }, {}]) {
        const r = await get({ view: 'safehouse', cityId: c.id, position: pos, backgroundView: 'city', currentCityId: c.id, ...extra });
        const cv = Array.isArray(r) ? r.find(x => Array.isArray(x) && x[0] === 'changeView' && Array.isArray(x[1]) && x[1][0] === 'safehouse') : null;
        html = cv && typeof cv[1][1] === 'string' ? cv[1][1] : null;
        await pace();
        if (html && /class="[^"]*\breport\b/.test(html)) break;
      }
      if (!html) { (diag.safehouse ??= {})[c.id] = 'no safehouse view in response'; continue; }
      const reps = parseReports(html, opts.me);
      if (!reps.length) (diag.reportsHtmlShape ??= {})[c.id] = htmlShape(html);
      reps.forEach(r => reports.set(r.id || `${r.target.cityId}-${r.date}-${r.mission}`, r));
    }

    const targets = {};
    if (opts.enrich) {
      const ids = [...new Set([...reports.values()].map(r => r.target.cityId).filter(Boolean))];
      const islandCache = {};
      let n = 0;
      for (const tid of ids) {
        say('Spymaster', `Opening target town ${++n} of ${ids.length}…`);
        const j = await get({ view: 'city', cityId: tid });
        const bg = find(j, o => Array.isArray(o.position) && 'islandXCoord' in o);
        const t = {};
        if (bg) {
          const wh = []; let wall = null;
          bg.position.forEach(p => {
            const k = String(p.building || '').replace(/\s*constructionSite/, '').trim(); const L = parseInt(p.level) || 0;
            if (k === 'warehouse' && L) wh.push(L);
            if (k === 'wall') wall = L;
          });
          Object.assign(t, { islandId: bg.islandId != null ? String(bg.islandId) : null, warehouseLevels: wh, warehouseTotal: wh.reduce((a, b) => a + b, 0), wall,
            alliance: bg.ownerAllyTag ?? bg.allyTag ?? null });
          if (!wh.length && wall == null) (diag.targetCityKeys ??= {})[tid] = Object.keys(bg);
        } else if (!diag.targetCity) diag.targetCity = shape(j);
        await pace(1200, 2400);
        if (t.islandId) {
          if (!(t.islandId in islandCache)) {
            islandCache[t.islandId] = parseIsland(await get({ view: 'island', islandId: t.islandId, backgroundView: 'island', currentIslandId: t.islandId }));
            await pace(1200, 2400);
          }
          const isl = islandCache[t.islandId];
          if (isl) {
            t.tradegood = isl.tradegood;
            const tw = isl.towns.find(x => x.id === String(tid));
            if (tw) { t.state = tw.state; t.alliance = t.alliance ?? tw.alliance; t.townLevel = tw.level; }
          }
        }
        t.inactive = /inactiv|^i$/i.test(String(t.state || ''));
        if (t.warehouseLevels?.length) t.safe = t.inactive ? 15 + 80 * t.warehouseTotal : 100 + 480 * t.warehouseTotal;
        targets[tid] = t;
      }
    }
    await get({ view: 'city', cityId: startId, backgroundView: 'city', currentCityId: startId });

    const list = [...reports.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const env = envelope('spymaster.reports.v1', 'spymaster@' + VERSION, { reports: list, targets },
      { player: opts.me, scope: { hideouts, enriched: opts.enrich } });
    if (Object.keys(diag).length) env.diag = diag;
    const fname = `spymaster.reports_${env.server}_${stamp()}.json`;
    download(env, fname);
    say('Spymaster: reports ready',
      `${list.length} reports from ${hideouts} Hideouts, ${Object.keys(targets).length} targets enriched. Saved as ${fname}.` + (env.diag ? '\nSome pages had an unexpected structure; it is in the file (no text) so the parser can be fixed.' : ''),
      [{ label: 'Download again', onClick: () => download(env, fname) }]);
  } catch (e) {
    say('Spymaster failed', e.message + ' — nothing in your game was changed.');
  }
})();
