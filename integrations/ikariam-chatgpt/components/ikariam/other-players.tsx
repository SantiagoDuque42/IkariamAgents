'use client';

import { ChevronDown, LocateFixed, MapPin, Minus, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AtlasPlayer, AtlasPlayers, Coordinate, MapPoint, PlayerCity, PlayerIsland,
} from '../../lib/icariam/dashboard-types';
import { AtlasCanvas, atlasBounds, type AtlasMarker } from './atlas';
import { coordLabel, Empty, External, islandKey, n, RESOURCE, ResourceMark, time } from './ui';

const reviewHorizon = {
  Corto: '24–48 horas', Medio: '3–14 días', Censo: 'Censo',
};
const day = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' });
const distanceNumber = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const labelFor = ({ x, y }: Coordinate) => coordLabel(x, y);
const asDay = (date: string) => day.format(new Date(date));
const cityCount = (count: number) => n(count) + (count === 1 ? ' ciudad' : ' ciudades');
const islandCount = (count: number) => n(count) + (count === 1 ? ' isla' : ' islas');
const searchKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

function frameFor(player: AtlasPlayer) {
  const xs = player.cities.map((city) => city.x);
  const ys = player.cities.map((city) => city.y);
  const west = Math.min(...xs), east = Math.max(...xs), north = Math.min(...ys), south = Math.max(...ys);
  return {
    center: { x: (west + east + 1) / 2, y: (north + south + 1) / 2 },
    size: Math.max(10, east - west + 5, south - north + 5),
  };
}

function PlayerRoster({ players, selected, choose }: {
  players: AtlasPlayer[]; selected: string; choose: (player: AtlasPlayer) => void;
}) {
  const [query, setQuery] = useState('');
  const search = searchKey(query.trim());
  const filtered = search ? players.filter((player) => searchKey(player.name + ' ' + (player.alliance ?? 'sin alianza')).includes(search)) : players;
  return <aside className="panel player-roster" aria-label="Listado de otros jugadores">
    <div className="player-roster-toolbar">
      <h3>Jugadores <span aria-live="polite">{filtered.length}{search ? '/' + players.length : ''}</span></h3>
      <label className="player-search"><Search size={16} aria-hidden="true" />
        <input type="search" aria-label="Buscar por nombre o alianza" placeholder="Nombre o alianza"
          value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
    </div>
    {filtered.length ? <ul className="player-name-list">
      {filtered.map((player) => <li key={player.name}>
        <button type="button" aria-pressed={selected === player.name} onClick={() => choose(player)}>
          <span><strong>{player.name}</strong><small>{player.alliance ?? 'Sin alianza'}</small></span>
          <span className="player-town-count" title={cityCount(player.cities.length)} aria-label={cityCount(player.cities.length)}>
            <MapPin size={13} aria-hidden="true" />{player.cities.length}
          </span>
        </button>
      </li>)}
    </ul> : <div className="player-no-matches"><Empty>No hay coincidencias.</Empty></div>}
  </aside>;
}

function PlayerProfile({ player, groups, island, focus, islandIndex }: {
  player: AtlasPlayer;
  groups: Map<string, PlayerCity[]>;
  island: Coordinate;
  focus: (coord: Coordinate) => void;
  islandIndex: Map<string, PlayerIsland>;
}) {
  return <aside className="panel player-profile" aria-label={'Ficha de ' + player.name}>
    <div className="player-identity">
      <h3>{player.name}</h3>
      <div className="player-identity-meta">
        <span>{player.alliance ?? 'Sin alianza'}</span>
        <span className="player-status" data-status={player.status}
          title={player.status === 'Sin marca' ? 'La ficha de isla carece de indicador de estado' : undefined}>{player.status}</span>
      </div>
    </div>
    <dl className="player-score-grid">
      <div><dt>Puntos totales</dt><dd>{n(player.points)}</dd></div>
      <div><dt>Generales</dt><dd>{n(player.generals)}</dd></div>
      <div><dt>Ciudades en el mapa</dt><dd>{n(player.cities.length)}</dd></div>
      <div><dt>Islas en el mapa</dt><dd>{n(groups.size)}</dd></div>
    </dl>
    <section className="player-profile-section">
      <h4>Ciudades</h4>
      <div className="player-city-groups">
        {[...groups].map(([key, cities]) => {
          const coord = cities[0];
          const fact = islandIndex.get(key);
          return <div className="player-city-group" key={key} data-focused={key === islandKey(island)}>
            <button type="button" aria-pressed={key === islandKey(island)} onClick={() => focus(coord)}>
              <MapPin size={15} aria-hidden="true" /><strong>{labelFor(coord)}</strong>
              {fact && <span>{RESOURCE[fact.resource].label}</span>}
              <span className="player-group-count">{n(cities.length)}</span>
            </button>
            <ul>
              {cities.map((city) => <li key={city.position}><span>{city.name}
                {city.status !== 'Sin marca' && <small>{city.status}</small>}</span><span>Nv. {n(city.level)}</span></li>)}
            </ul>
          </div>;
        })}
      </div>
    </section>
    <section className="player-profile-section">
      <h4>Clasificación y proximidad</h4>
      <dl className="player-stat-list">
        <div><dt>Puesto en Atlas</dt><dd>{n(player.rank)}</dd></div>
        <div><dt>Ofensivos</dt><dd>{n(player.offense)}</dd></div>
        <div><dt>Defensivos</dt><dd>{n(player.defense)}</dd></div>
        <div><dt>Saqueo</dt><dd>{n(player.loot)}</dd></div>
        <div><dt>Mayor nivel de ciudad</dt><dd>{n(player.maxLevel)}</dd></div>
        <div><dt>Isla más próxima</dt><dd>{labelFor(player.closest)}</dd></div>
        <div><dt>Distancia a una base</dt><dd>{distanceNumber.format(player.distance)} casillas</dd></div>
      </dl>
      <p className="quiet">Corte del {asDay(player.rankedOn)}</p>
      <External href={player.rankUrl}>Clasificación en IkaDatos</External>
    </section>
    <section className="player-profile-section">
      <h4>Revisión del censo</h4>
      <div className="source-note">
        <strong>{reviewHorizon[player.review]}</strong><p>{player.note}</p>
      </div>
    </section>
  </aside>;
}

function IslandSummary({ island, cities }: { island: PlayerIsland | undefined; cities: PlayerCity[] }) {
  if (!island) return null;
  return <details className="player-map-island">
    <summary><MapPin size={15} aria-hidden="true" /><strong>{labelFor(island)}{island.name ? ' · ' + island.name : ''}</strong>
      <span>{cityCount(cities.length)} del jugador</span><ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="player-map-island-detail">
      <span><ResourceMark resource={island.resource} size={15} />{RESOURCE[island.resource].label}{island.wonder ? ' · ' + island.wonder : ''}</span>
      <span>Aserradero {n(island.sawmill)} · Yacimiento {n(island.deposit)}</span>
      <span>{n(island.occupied)}/{n(island.capacity)} plazas ocupadas en IkaDatos · {n(island.free)} libres</span>
      <span>Base próxima {labelFor(island.base)} · {distanceNumber.format(island.distance)} casillas</span>
      {island.ownCities > 0 && <span>{cityCount(island.ownCities)} propias · Captura {time(island.gameObservedAt)} · {island.gameLevels}</span>}
      <External href={island.sourceUrl}>Ficha de isla en IkaDatos</External>
    </div>
  </details>;
}

function PlayersAtlas({ snapshot, worldPoints, selectedName, selectName }: {
  snapshot: AtlasPlayers; worldPoints: MapPoint[]; selectedName: string; selectName: (name: string) => void;
}) {
  const player = snapshot.players.find((row) => row.name === selectedName) ?? snapshot.players[0];
  const [position, setPosition] = useState(() => frameFor(player).center);
  const [scope, setScope] = useState(() => frameFor(player).size);
  const [island, setIsland] = useState<Coordinate>(player.closest);
  const bounds = useMemo(() => atlasBounds(position, scope), [position, scope]);
  const islandIndex = useMemo(() => new Map(snapshot.islands.map((row) => [islandKey(row), row])), [snapshot.islands]);
  const own = useMemo(() => snapshot.islands.filter((row) => row.ownCities > 0), [snapshot.islands]);
  const points = useMemo(() => {
    const map = new Map(worldPoints.map((point) => [islandKey({ x: point[0], y: point[1] }), point]));
    for (const row of snapshot.islands) {
      map.set(islandKey(row), [row.x, row.y, row.resource, row.sawmill, row.deposit, row.wonder, row.occupied, row.capacity, row.sacCities, 1]);
    }
    return [...map.values()];
  }, [snapshot.islands, worldPoints]);
  const groups = useMemo(() => {
    const byIsland = new Map<string, PlayerCity[]>();
    for (const city of player.cities) {
      const key = islandKey(city);
      const list = byIsland.get(key) ?? [];
      list.push(city);
      byIsland.set(key, list);
    }
    return byIsland;
  }, [player]);
  const markers = useMemo(() => {
    const map = new Map<string, AtlasMarker>();
    for (const [key, cities] of groups) {
      map.set(key, { count: cities.length, title: cityCount(cities.length) + ' de ' + player.name });
    }
    return map;
  }, [groups, player.name]);
  const selectedKey = islandKey(island);

  function fit(row: AtlasPlayer) {
    const frame = frameFor(row);
    setPosition(frame.center);
    setScope(frame.size);
  }
  function choose(row: AtlasPlayer) {
    selectName(row.name);
    setIsland(row.closest);
    fit(row);
  }
  function focus(coord: Coordinate) {
    setIsland(coord);
    const { minX, minY, size } = bounds;
    if (coord.x < minX || coord.y < minY || coord.x >= minX + size || coord.y >= minY + size) setPosition(coord);
  }

  return <>
    <div className="section-head player-section-head">
      <div><h2>Otros jugadores</h2>
        <p>{snapshot.world} · {islandCount(snapshot.islands.length)} · Censo del {time(snapshot.observedAt, true)}</p>
      </div>
      <div className="player-source-links">
        <External href={snapshot.mapUrl}>Mapa de IkaDatos</External>
        <External href={snapshot.workbookUrl}>Abrir Excel</External>
      </div>
    </div>
    <div className="players-layout">
      <PlayerRoster players={snapshot.players} selected={player.name} choose={choose} />
      <section className="map-shell players-map" aria-labelledby="player-map-title">
        <div className="map-toolbar player-map-toolbar">
          <div><h3 id="player-map-title">Ciudades de {player.name}</h3>
            <p>{cityCount(player.cities.length)} en {islandCount(groups.size)}</p></div>
          <div className="map-controls" role="group" aria-label="Controles del mapa">
            <button type="button" title="Centrar en las ciudades" aria-label="Centrar en las ciudades" onClick={() => fit(player)}><LocateFixed size={18} /></button>
            <button type="button" aria-label="Alejar mapa de jugadores" onClick={() => setScope((size) => Math.min(24, size + 2))} disabled={scope >= 24}><Minus size={17} /></button>
            <button type="button" aria-label="Acercar mapa de jugadores" onClick={() => setScope((size) => Math.max(5, size - 2))} disabled={scope <= 5}><Plus size={17} /></button>
          </div>
        </div>
        <AtlasCanvas points={points} islands={own} bounds={bounds} selected={island} markers={markers}
          label={'Mapa de ' + cityCount(player.cities.length) + ' de ' + player.name + '. Puedes seleccionar una isla en la ficha.'}
          onSelect={(point) => setIsland({ x: point[0], y: point[1] })}
          onPan={(dx, dy) => setPosition((coord) => ({
            x: Math.max(1, Math.min(100, coord.x + dx)), y: Math.max(1, Math.min(100, coord.y + dy)),
          }))} />
        <div className="player-map-bottom">
          <div className="map-caption">
            <span><i className="player-map-dot" />Ciudades del jugador</span>
            <span><i className="map-gold" />Tus islas</span>
            <span className="player-map-scale">{scope} × {scope} casillas</span>
          </div>
          <IslandSummary key={selectedKey} island={islandIndex.get(selectedKey)} cities={groups.get(selectedKey) ?? []} />
        </div>
      </section>
      <PlayerProfile key={player.name} player={player} groups={groups} island={island} focus={focus} islandIndex={islandIndex} />
    </div>
  </>;
}

export function OtherPlayers({ worldPoints, selectedName, selectName }: {
  worldPoints: MapPoint[]; selectedName: string; selectName: (name: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<AtlasPlayers | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    fetch('/api/dashboard/players', { signal: request.signal }).then(async (response) => {
      if (!response.ok) throw new Error(response.status === 401
        ? 'Inicia sesión para consultar a otros jugadores.'
        : 'No hemos podido cargar el censo de jugadores.');
      return response.json() as Promise<AtlasPlayers>;
    }).then(setSnapshot).catch((issue: unknown) => {
      if (request.signal.aborted) return;
      setError(issue instanceof Error ? issue.message : 'No hemos podido cargar el censo de jugadores.');
    });
    return () => request.abort();
  }, [attempt]);
  if (!snapshot?.players.length) return <>
    <div className="section-head"><h2>Otros jugadores</h2></div>
    <Empty>{error ? <>
      <p role="alert">{error}</p>
      <button type="button" className="button secondary" onClick={() => { setError(''); setAttempt((n) => n + 1); }}>Reintentar</button>
    </> : <p role="status">{snapshot ? 'El censo aún no tiene jugadores.' : 'Cargando jugadores de Atlas…'}</p>}</Empty>
  </>;
  return <PlayersAtlas snapshot={snapshot} worldPoints={worldPoints} selectedName={selectedName} selectName={selectName} />;
}
