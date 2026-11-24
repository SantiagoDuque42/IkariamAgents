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
  /*@shared*/
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
      <label><input type="radio" name="d-m" value="islands"> Islands (one per line or comma-separated, e.g. 44:87):</label>
      <textarea id="d-c" style="width:100%;height:60px;font:12px monospace" placeholder="44:87, 44:90, 43:90"></textarea>
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
      if (!list.length) throw new Error('List at least one island coordinate, e.g. 44:87.');
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
