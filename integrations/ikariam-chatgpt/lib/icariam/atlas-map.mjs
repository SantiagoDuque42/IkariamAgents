const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const distanceSquared = (island, x, y) => (island.x - x) ** 2 + (island.y - y) ** 2;
const hasInteger = value => Number.isInteger(value) && value >= 0;

export function createAtlasMap(snapshot) {
  const islands = snapshot.islands.map(row => ({
    x: row.x,
    y: row.y,
    coordinates: `${row.x}:${row.y}`,
    resource: row.resource ?? null,
    resource_building: row.resourceBuilding ?? null,
    resource_level: row.resourceLevel ?? null,
    sawmill_level: row.sawmillLevel ?? null,
    wonder: row.wonder ?? null,
    capacity: row.capacity ?? null,
    occupied_slots: row.occupied ?? null,
    free_slots: hasInteger(row.capacity) && hasInteger(row.occupied) ? row.capacity - row.occupied : null,
    city_list_observed_at: row.citiesObservedAt ?? null,
    cities: Array.isArray(row.cities) ? row.cities : null,
    sac_city_count: row.sacCityCount ?? null,
    sac_cities: row.sacCities ?? null,
    source_url: row.detailUrl ?? null,
  }));
  const metadata = {
    community: 'España',
    world: 'Atlas',
    server: 's74-es',
    source: 'IkaDatos',
    source_url: snapshot.sourceUrl,
    sources: snapshot.sources,
    observed_at: snapshot.observedAt,
    coverage: {
      islands: islands.length,
      with_resource: islands.filter(island => island.resource !== null).length,
      with_resource_level: islands.filter(island => island.resource_level !== null).length,
      with_sawmill_level: islands.filter(island => island.sawmill_level !== null).length,
      with_wonder: islands.filter(island => island.wonder !== null).length,
      with_occupancy: islands.filter(island => island.occupied_slots !== null).length,
      with_city_list: islands.filter(island => island.cities !== null).length,
      occupied_slots_listed: islands.reduce((sum, island) => sum + (island.occupied_slots ?? 0), 0),
      free_slots_listed: islands.reduce((sum, island) => sum + (island.free_slots ?? 0), 0),
      total_slots_listed: islands.reduce((sum, island) => sum + (island.capacity ?? 0), 0),
      city_records_listed: islands.reduce((sum, island) => sum + (island.cities?.length ?? 0), 0),
      full_alliance_layers: snapshot.fullAllianceLayers ?? [],
      sac_cities_listed: islands.reduce((sum, island) => sum + (island.sac_city_count ?? 0), 0),
      sac_islands: islands.filter(island => island.sac_city_count > 0).length,
    },
  };

  function search(query, accountCities = [], accountPlayerName = '') {
    const {x, y, radius = 0, offset = 0, limit = 25, min_free_slots: minFreeSlots} = query;
    const hasCenter = x !== undefined;
    const includeCities = query.include_cities ?? (hasCenter && radius === 0);
    const resource = normalize(query.resource);
    const wonder = normalize(query.wonder);
    const alliance = normalize(query.alliance);
    const ownCitiesByIsland = new Map();
    for (const city of accountCities) {
      if (!city.coordinates || !city.name) continue;
      const coord = `${city.coordinates.x}:${city.coordinates.y}`;
      const names = ownCitiesByIsland.get(coord) ?? [];
      names.push(city.name);
      ownCitiesByIsland.set(coord, names);
    }
    const matches = islands.filter(island => {
      if (hasCenter && distanceSquared(island, x, y) > radius ** 2) return false;
      if (resource && normalize(island.resource) !== resource) return false;
      if (query.min_resource_level !== undefined && (island.resource_level ?? 0) < query.min_resource_level) return false;
      if (query.min_sawmill_level !== undefined && (island.sawmill_level ?? 0) < query.min_sawmill_level) return false;
      if (wonder && !normalize(island.wonder).includes(wonder)) return false;
      if (minFreeSlots !== undefined && (island.free_slots === null || island.free_slots < minFreeSlots)) return false;
      if (!alliance) return true;
      if (alliance === 'sac' && island.sac_city_count > 0) return true;
      return island.cities?.some(city => normalize(city.alliance) === alliance);
    }).sort((left, right) => (hasCenter ? distanceSquared(left, x, y) - distanceSquared(right, x, y) : 0)
      || left.x - right.x || left.y - right.y);
    return {
      ...metadata,
      matched: matches.length,
      next_offset: offset + limit < matches.length ? offset + limit : null,
      islands: matches.slice(offset, offset + limit).map(island => {
        const {cities, sac_cities, ...fields} = island;
        const ownCities = ownCitiesByIsland.get(island.coordinates);
        const visibleNames = ownCities ? new Set(cities?.filter(city => normalize(city.player) === normalize(accountPlayerName))
          .map(city => normalize(city.name))) : null;
        return {
          ...fields,
          ...(hasCenter ? {distance: Number(Math.sqrt(distanceSquared(island, x, y)).toFixed(2))} : {}),
          city_count_in_detail: cities?.length ?? null,
          ...(includeCities ? {cities, sac_cities} : {}),
          ...(ownCities ? {
            own_cities_in_plugin: ownCities,
            own_cities_absent_from_list: cities && accountPlayerName
              ? ownCities.filter(name => !visibleNames.has(normalize(name))) : null,
          } : {}),
        };
      }),
      notes: [
        'Fecha de consulta de esta copia. El proveedor puede mostrar ocupación y plazas anteriores al estado del juego.',
        'Una lista de ciudades nula indica que no se ha obtenido esa ficha. Una lista vacía indica que la ficha consultada no mostraba ciudades.',
        'La capa SAC es una lectura aparte. Sus ciudades pueden figurar también en la ficha de la isla.',
        ...(alliance && !metadata.coverage.full_alliance_layers.some(tag => normalize(tag) === alliance)
          ? ['El filtro de alianza cubre exclusivamente las fichas detalladas disponibles para esa alianza.'] : []),
      ],
    };
  }

  return {metadata, search};
}
