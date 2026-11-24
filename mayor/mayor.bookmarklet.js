// Mayor — snapshot of your own empire, as a bookmarklet. Read-only.
// Click it in your Ikariam tab: it opens each of your towns and their islands the way the game UI does,
// then downloads `mayor.snapshot_<server>_<YYYYMMDD-HHmm>.json` (schema mayor.snapshot.v1).
// "Copy for planner" copies the older format the Empire Planner's importer understands.
(async () => {
  const VERSION = '0.2.0';
  /*@shared*/
  const ID = 'ika-mayor';
  const say = (t, b, btns) => overlay(ID, t, b, btns);
  try {
    if (!/ikariam/.test(location.host)) throw new Error('Open your Ikariam game tab first, then click the bookmark.');
    const related = relatedCities();
    if (!related) throw new Error('Could not find your town list on this page. Reload the game and try again.');
    const own = Object.values(related).filter(c => c && c.relationship === 'ownCity');
    const startId = String(related.selectedCityId || (related.selectedCity || '').replace('city_', '') || own[0].id);
    const { get } = gameClient();
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

    // Islands: v0.1 asked view=island without a background view and got no island data (24 Nov 2026).
    // Try the island background view first, then the bare view; keep the response shape if both fail.
    for (const id of [...new Set(payload.cities.map(c => c.islandId))]) {
      let isl = null, last = null;
      for (const params of [
        { view: 'island', islandId: id, backgroundView: 'island', currentIslandId: id },
        { view: 'island', islandId: id },
      ]) {
        last = await get(params);
        isl = parseIsland(last);
        await pace();
        if (isl) break;
      }
      if (isl) {
        const { _keys, towns, ...facts } = isl;
        payload.islands[id] = { ...facts, towns: towns.length };
        if (isl.woodLvl == null || isl.luxLvl == null) (diag.islandKeys ??= {})[id] = _keys;
      } else (diag.island ??= {})[id] = shape(last);
    }
    await get({ view: 'city', cityId: startId, backgroundView: 'city', currentCityId: startId });

    const env = envelope('mayor.snapshot.v1', 'mayor@' + VERSION, payload, { scope: { towns: own.length } });
    if (Object.keys(diag).length) env.diag = diag;
    const fname = `mayor.snapshot_${env.server}_${stamp()}.json`;
    download(env, fname);
    const legacy = { type: 'ikariam-snapshot', version: 1, takenAt: env.producedAt, server: location.host, ...payload };
    const nIsl = Object.keys(payload.islands).length;
    say('Mayor: snapshot ready',
      `${payload.cities.length} towns, ${nIsl} islands. Saved as ${fname}.` + (env.diag ? '\nSome game responses had an unexpected shape; the file includes their structure (no values) so the parser can be fixed.' : ''),
      [{ label: 'Download again', onClick: () => download(env, fname) }, { label: 'Copy for planner', onClick: btn => copyText(JSON.stringify(legacy), btn) }]);
  } catch (e) {
    say('Mayor failed', e.message + ' — nothing in your game was changed.');
  }
})();
