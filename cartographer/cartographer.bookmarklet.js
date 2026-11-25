// Cartographer (in-game source) — map extract for an area and filter, as a bookmarklet. Read-only.
// Click it in your Ikariam tab, choose an area (x/y ranges), luxury goods and how many islands to open,
// then it downloads `cartographer.map_<server>_<YYYYMMDD-HHmm>_<tag>.json` (schema cartographer.map.v1).
//
// Step 1 reads the world-map data for the area (one request). Step 2 opens up to N islands, nearest
// first, at a human pace, to read levels, free spots and towns. Response shapes are unverified until the
// first real run; anything unrecognised is saved as structure-only diagnostics in the file.
(async () => {
  const VERSION = '0.2.1';
  /*@shared*/
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
    const { get, getText } = gameClient();
    const client = { get, getText };
    const diag = {};
    say('Cartographer', `Reading world map ${x0}–${x1} × ${y0}–${y1}…`);
    const area = await get({ action: 'WorldMap', function: 'getJSONArea', x_min: x0, x_max: x1, y_min: y0, y_max: y1 }, { ajax: false });
    let islands = parseArea(area);
    if (!islands) { diag.area = shape(area); islands = []; }
    islands.sort((a, b) => Math.hypot(a.x - scope.center[0], a.y - scope.center[1]) - Math.hypot(b.x - scope.center[0], b.y - scope.center[1]));

    let opened = 0;
    for (const isl of islands.slice(0, scope.maxIslands)) {
      say('Cartographer', `Opening island ${++opened} of ${Math.min(scope.maxIslands, islands.length)} (${isl.x}:${isl.y})…`);
      const r = await readIsland(client, isl.id);
      const p = r.island;
      if (p) { const { _keys, ...facts } = p; Object.assign(isl, facts, { id: isl.id, x: isl.x, y: isl.y, name: isl.name ?? facts.name, detail: 'island' }); if (p.woodLvl == null) (diag.islandKeys ??= {})[isl.id] = _keys; }
      else if (!diag.island) diag.island = r.diag; // one example is enough
      await pace(1000, 2000);
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
