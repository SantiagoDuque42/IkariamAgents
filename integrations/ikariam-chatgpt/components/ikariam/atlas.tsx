'use client';

import { Crosshair, LocateFixed, MapPin, Minus, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Coordinate, MapIsland, MapPoint, MapResource, OwnIsland, Resource } from '../../lib/icariam/dashboard-types';
import { coordLabel, Empty, External, Field, getOwnIsland, islandKey, n, RESOURCE, ResourceMark, ResourceOptions, Select, time } from './ui';

type Bounds = { minX: number; minY: number; size: number };
export type AtlasMarker = { count: number; title: string };
const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
export const atlasBounds = (center: Coordinate, size: number): Bounds => ({
  size, minX: clamp(Math.round(center.x - size / 2), 1, 101 - size),
  minY: clamp(Math.round(center.y - size / 2), 1, 101 - size),
});
const pointKey = (point: MapPoint) => point[0] + ':' + point[1];
const isWithin = (point: MapPoint, bounds: Bounds) => point[0] >= bounds.minX && point[1] >= bounds.minY
  && point[0] < bounds.minX + bounds.size && point[1] < bounds.minY + bounds.size;

export function AtlasCanvas({ points, islands, bounds, selected, onSelect, onPan, markers, label, sac = false, mini = false }: {
  points: MapPoint[]; islands: Coordinate[]; bounds: Bounds; selected?: Coordinate | null;
  onSelect: (point: MapPoint) => void; onPan?: (dx: number, dy: number) => void; sac?: boolean; mini?: boolean;
  markers?: ReadonlyMap<string, AtlasMarker>; label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ s: 1, left: 0, top: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<MapPoint | undefined>();
  const [tip, setTip] = useState({ left: 0, top: 0 });
  const pointIndex = useMemo(() => new Map(points.map((point) => [pointKey(point), point])), [points]);
  const ownKeys = useMemo(() => new Set(islands.map(islandKey)), [islands]);

  useEffect(() => {
    setHover(undefined);
    drag.current = null;
  }, [bounds, points]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const elementRef = element;
    const context = element.getContext('2d');
    if (!context) return;
    const ctx = context;
    function draw() {
      const width = elementRef.clientWidth;
      const height = elementRef.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      elementRef.width = width * dpr;
      elementRef.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const padding = mini ? 24 : 34;
      const available = Math.max(10, Math.min(width, height) - padding * 2);
      const s = available / bounds.size;
      const left = (width - available) / 2;
      const top = (height - available) / 2;
      view.current = { s, left, top };
      ctx.clearRect(0, 0, width, height);
      const step = bounds.size >= 50 ? 10 : bounds.size >= 20 ? 5 : 2;
      ctx.font = (mini ? '10px' : '11px') + ' ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#71879838';
      ctx.fillStyle = '#a8bdc9';
      ctx.beginPath();
      for (let i = 0; i < bounds.size; i++) {
        if ((bounds.minX + i) % step === 0) {
          const a = left + (i + 0.5) * s;
          ctx.moveTo(a, top); ctx.lineTo(a, top + available);
          ctx.fillText(String(bounds.minX + i), a, top - 11);
        }
        if ((bounds.minY + i) % step === 0) {
          const a = top + (i + 0.5) * s;
          ctx.moveTo(left, a); ctx.lineTo(left + available, a);
          ctx.fillText(String(bounds.minY + i), left - 12, a);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = '#8aa6b64d';
      ctx.strokeRect(left, top, available, available);
      for (const point of points) {
        if (!isWithin(point, bounds)) continue;
        const [x, y, resource] = point;
        const key = pointKey(point);
        const px = left + (x - bounds.minX + 0.5) * s;
        const py = top + (y - bounds.minY + 0.5) * s;
        const own = ownKeys.has(key);
        const isSelected = (selected?.x === x && selected?.y === y) || (hover?.[0] === x && hover?.[1] === y);
        const marker = markers?.get(key);
        if (marker) {
          const badge = Math.min(s * .38, 14);
          ctx.beginPath();
          ctx.arc(px, py, badge, 0, Math.PI * 2);
          ctx.fillStyle = '#91ede1';
          ctx.fill();
          ctx.lineWidth = isSelected || own ? 2.5 : 1;
          ctx.strokeStyle = isSelected ? '#ffffff' : own ? '#efd08f' : '#66cabe';
          ctx.stroke();
          ctx.lineWidth = 1;
          if (isSelected && own) {
            ctx.beginPath();
            ctx.arc(px, py, badge + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#efd08f';
            ctx.stroke();
          }
          if (badge >= 7) {
            ctx.save();
            ctx.font = 'bold ' + Math.min(15, badge + 2) + 'px ui-sans-serif, system-ui, sans-serif';
            ctx.fillStyle = '#0c3443';
            ctx.fillText(String(marker.count), px, py + .5);
            ctx.restore();
          }
          continue;
        }
        const radius = Math.min(s * 0.36, mini ? 3.8 : 6.5);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.9, radius), 0, Math.PI * 2);
        ctx.fillStyle = RESOURCE[resource].mapColor;
        ctx.globalAlpha = own || isSelected ? 1 : markers ? .36 : (sac && !point[8] ? .29 : .85);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (own || isSelected || (sac && point[8] > 0)) {
          ctx.beginPath();
          ctx.arc(px, py, radius + (own ? 3 : 2), 0, Math.PI * 2);
          ctx.lineWidth = own || isSelected ? 1.5 : 1;
          ctx.strokeStyle = isSelected ? '#ffffff' : own ? '#efd08f' : '#69e1d4';
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    }
    const resize = new ResizeObserver(draw);
    resize.observe(element);
    draw();
    return () => resize.disconnect();
  }, [bounds, hover, markers, mini, ownKeys, points, sac, selected]);

  function locate(event: React.PointerEvent<HTMLCanvasElement>) {
    const { left, top, s } = view.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const x = Math.floor((px - left) / s) + bounds.minX;
    const y = Math.floor((py - top) / s) + bounds.minY;
    if (x < bounds.minX || x >= bounds.minX + bounds.size || y < bounds.minY || y >= bounds.minY + bounds.size) return undefined;
    const key = x + ':' + y;
    return { point: pointIndex.get(key), px, py, width: rect.width, height: rect.height };
  }

  const hoverMarker = hover ? markers?.get(pointKey(hover)) : undefined;
  return <div className={'atlas-canvas' + (mini ? ' atlas-mini-canvas' : '')}>
    <canvas ref={canvas} role="img" aria-label={label ?? 'Mapa de Atlas. Usa la búsqueda por coordenadas o la lista para seleccionar una isla.'}
      onPointerDown={(event) => {
        if (onPan && bounds.size < 100 && event.button === 0) {
          drag.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        const location = locate(event);
        if (!location) { setHover(undefined); return; }
        setHover(location.point);
        setTip({
          left: Math.max(4, Math.min(location.px + 12, location.width - 172)),
          top: Math.max(4, Math.min(location.py + 14, location.height - 74)),
        });
      }}
      onPointerLeave={() => setHover(undefined)}
      onPointerCancel={() => { drag.current = null; setHover(undefined); }}
      onPointerUp={(event) => {
        if (event.button !== 0) return;
        const start = drag.current;
        drag.current = null;
        if (start && onPan) {
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.abs(dx) + Math.abs(dy) > 7) {
            onPan(-Math.round(dx / view.current.s), -Math.round(dy / view.current.s));
            return;
          }
        }
        const point = locate(event)?.point;
        if (point) onSelect(point);
      }} />
    {hover && <div className="map-tooltip" style={tip}>
      <strong>{coordLabel(hover[0], hover[1])} {RESOURCE[hover[2]].label}</strong>
      <span>{hoverMarker?.title ?? (hover[7] - hover[6]) + ' plazas en IkaDatos'}</span>
    </div>}
  </div>;
}

export function MiniAtlas({ points, own, center, onSelect }: {
  points: MapPoint[]; own: OwnIsland[]; center: Coordinate; onSelect: (point: MapPoint) => void;
}) {
  const bounds = useMemo(() => atlasBounds(center, 18), [center.x, center.y]);
  return <AtlasCanvas points={points} islands={own} bounds={bounds} onSelect={onSelect} mini />;
}

export function AtlasView({ own, center, initial, onPlan, onRecord, onSelect }: {
  own: OwnIsland[]; center: Coordinate; initial: Coordinate | null;
  onPlan: (point: MapPoint) => void; onRecord: (id: string) => void; onSelect: (point: MapPoint) => void;
}) {
  const [all, setAll] = useState<MapPoint[] | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [resource, setResource] = useState<MapResource | ''>('');
  const [wonder, setWonder] = useState('');
  const [minimum, setMinimum] = useState(0);
  const [onlySac, setOnlySac] = useState(false);
  const [scope, setScope] = useState(100);
  const [position, setPosition] = useState<Coordinate>(initial ?? center);
  const [picked, setPicked] = useState<Coordinate | null>(initial ?? center);
  const [coordText, setCoordText] = useState((initial ?? center).x + ':' + (initial ?? center).y);
  const [searchMessage, setSearchMessage] = useState('');
  const [listPage, setListPage] = useState(0);
  const [detail, setDetail] = useState<MapIsland | null>(null);
  const [detailError, setDetailError] = useState('');
  const bounds = useMemo(() => atlasBounds(position, scope), [position, scope]);
  const filtered = useMemo(() => (all ?? []).filter((row) =>
    (!resource || row[2] === resource) && (!wonder || row[5] === wonder) &&
    row[7] - row[6] >= minimum && (!onlySac || row[8] > 0)), [all, resource, wonder, minimum, onlySac]);
  const track = useMemo(() => (all ?? []).find((row) => picked?.x === row[0] && picked?.y === row[1]), [all, picked]);
  const shortlist = useMemo(() => [...filtered].sort((a, b) =>
    Math.hypot(a[0] - center.x, a[1] - center.y) - Math.hypot(b[0] - center.x, b[1] - center.y)
    || a[0] - b[0] || a[1] - b[1]), [filtered, center.x, center.y]);
  const visible = useMemo(() => track && !filtered.includes(track) ? [...filtered, track] : filtered, [filtered, track]);
  const wonders = useMemo(() => [...new Set((all ?? []).map((row) => row[5]).filter(Boolean))].sort(), [all]);
  const ownSelected = picked ? getOwnIsland(own, picked.x, picked.y) : undefined;

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/dashboard/atlas', { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error('No se pudo cargar el mapa de Atlas.');
      return response.json() as Promise<{ points: MapPoint[] }>;
    }).then((body) => setAll(body.points))
      .catch((issue: Error) => { if (issue.name !== 'AbortError') setError(issue.message); });
    return () => abort.abort();
  }, [loadAttempt]);

  useEffect(() => {
    if (!picked || !track) return;
    const abort = new AbortController();
    const query = new URLSearchParams({ x: String(picked.x), y: String(picked.y) });
    fetch('/api/dashboard/atlas?' + query, { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error('No se pudo cargar la ficha.');
      return response.json() as Promise<MapIsland>;
    }).then(setDetail).catch((issue: Error) => {
      if (issue.name !== 'AbortError') setDetailError(issue.message);
    });
    return () => abort.abort();
  }, [picked, track]);

  function pick(row: MapPoint, recenter = false) {
    const coordinate = { x: row[0], y: row[1] };
    if (picked?.x !== coordinate.x || picked.y !== coordinate.y) {
      setDetail(null);
      setDetailError('');
      setPicked(coordinate);
    }
    setCoordText(coordinate.x + ':' + coordinate.y);
    setSearchMessage('');
    if (recenter) setPosition(coordinate);
    onSelect(row);
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = coordText.trim().match(/^\[?\s*(\d{1,3})\s*[:, ]\s*(\d{1,3})\s*\]?$/);
    if (!match) { setSearchMessage('Escribe dos coordenadas, por ejemplo 44:89.'); return; }
    const target = all?.find((row) => row[0] === Number(match[1]) && row[1] === Number(match[2]));
    if (!target) { setSearchMessage('Esa casilla no figura como isla en IkaDatos.'); return; }
    pick(target, true);
    setScope(24);
  }

  if (error) return <Empty><p role="alert">{error}</p><button className="button secondary" onClick={() => { setError(''); setLoadAttempt((x) => x + 1); }}>Reintentar</button></Empty>;
  if (!all) return <Empty><p role="status">Cargando las islas de Atlas…</p></Empty>;
  const matchedDetail = detail && track && pointKey(detail.point) === pointKey(track) ? detail : null;

  return <>
    <div className="section-head"><div><h2>Mapa de Atlas</h2><p>Explora las islas alrededor de tus ciudades y compara recursos, maravillas y plazas.</p></div>
      <span className="chip"><MapPin size={16} />{n(filtered.length)} islas</span></div>
    <div className="atlas-tools panel">
      <ResourceOptions value={resource} onChange={(value: Resource | '') => { setResource(value as MapResource | ''); setListPage(0); }} map all />
      <div className="atlas-filter-fields">
        <Field label="Maravilla"><Select value={wonder} onChange={(value) => { setWonder(value); setListPage(0); }}>
          <option value="">Todas</option>{wonders.map((value) => <option key={value} value={value ?? ''}>{value}</option>)}
        </Select></Field>
        <Field label="Plazas libres"><Select value={minimum} onChange={(value) => { setMinimum(Number(value)); setListPage(0); }}>
          <option value="0">Cualquiera</option><option value="1">Al menos 1</option><option value="3">Al menos 3</option><option value="5">Al menos 5</option>
        </Select></Field>
        <label className="check"><input type="checkbox" checked={onlySac} onChange={(event) => { setOnlySac(event.target.checked); setListPage(0); }} /> Islas con SAC</label>
        <form className="map-search" onSubmit={search}>
          <Field label="Coordenadas"><input value={coordText} onChange={(event) => setCoordText(event.target.value)} placeholder="44:89" /></Field>
          <button type="submit" className="button icon-button secondary" aria-label="Buscar isla"><Search size={19} /></button>
        </form>
      </div>
      {searchMessage && <p className="field-message" role="status">{searchMessage}</p>}
    </div>
    <div className="atlas-layout">
      <section className="map-shell" aria-label="Mapa interactivo de islas">
        <div className="map-toolbar">
          <div className="map-mode" role="group" aria-label="Escala del mapa">
            <button type="button" aria-pressed={scope === 100} onClick={() => setScope(100)}>Mundo</button>
            <button type="button" aria-pressed={scope < 100} onClick={() => { setPosition(picked ?? center); setScope(24); }}>Entorno</button>
          </div>
          <div className="map-controls">
            <button type="button" title="Centrar en la capital" aria-label="Centrar en la capital" onClick={() => { setPosition(center); setScope(24); }}><LocateFixed size={18} /></button>
            <button type="button" aria-label="Alejar mapa" onClick={() => setScope((size) => Math.min(100, size * 2))} disabled={scope >= 100}><Minus size={17} /></button>
            <button type="button" aria-label="Acercar mapa" onClick={() => { setPosition(picked ?? position); setScope((size) => Math.max(8, Math.round(size / 2))); }} disabled={scope <= 8}><Plus size={17} /></button>
          </div>
        </div>
        <AtlasCanvas points={visible} islands={own} bounds={bounds} selected={picked} sac={onlySac} onSelect={pick}
          onPan={(dx, dy) => setPosition((value) => ({ x: clamp(value.x + dx, 1, 100), y: clamp(value.y + dy, 1, 100) }))} />
        <div className="map-caption"><span><span className="map-gold" />Islas propias</span><span>{scope} × {scope} casillas</span></div>
      </section>
      <aside className="panel island-details">
        {track ? <>
          <div className="card-head"><div><p className="overline">{coordLabel(track[0], track[1])}</p><h3>{ownSelected?.name ?? 'Ficha de isla'}</h3></div>
            <div className="resource-emblem"><ResourceMark resource={track[2]} size={24} /></div></div>
          <p className="island-wonder">{RESOURCE[track[2]].label} · {ownSelected?.wonder ?? track[5] ?? 'Maravilla sin registrar'}{ownSelected?.wonderLevel != null ? ' · Nv. ' + ownSelected.wonderLevel : ''}</p>
          <dl className="detail-metrics">
            <div><dt>Aserradero</dt><dd>{n(ownSelected?.sawmill ?? track[3])}</dd></div>
            <div><dt>Yacimiento</dt><dd>{n(ownSelected?.deposit ?? track[4])}</dd></div>
            <div><dt>Plazas en IkaDatos</dt><dd>{n(track[7] - track[6])}<small> / {track[7]}</small></dd></div>
            <div><dt>Ciudades de SAC</dt><dd>{n(track[8])}</dd></div>
          </dl>
          {ownSelected && <div className="source-note">
            <strong>{ownSelected.reportId ? 'Captura del juego' : 'Ciudades propias'}</strong><p>{ownSelected.cityNames.join(', ')}{ownSelected.observedAt ? '. ' + time(ownSelected.observedAt) + '.' : '.'}</p>
            <p>IkaDatos muestra aserradero {n(track[3])} y yacimiento {n(track[4])}. Su listado omite ciudades propias. Comprueba las plazas en el juego.</p>
            {ownSelected.reportId && <button className="link-button" onClick={() => onRecord(ownSelected.reportId!)}>Ver observación</button>}
          </div>}
          <button className="button primary island-plan" onClick={() => onPlan(track)}><Crosshair size={18} />Simular expansión</button>
          {detailError && <p className="quiet" role="status">{detailError}</p>}
          {matchedDetail && <>
            <div className="city-folio"><h4>Ciudades en IkaDatos</h4>
              {matchedDetail.cities === null ? <p className="quiet">Ficha nominal sin revisar.</p> : matchedDetail.cities.length === 0
                ? <p className="quiet">La ficha consultada no muestra ciudades.</p>
                : <ul>{matchedDetail.cities.map((city, index) => <li key={index}><span>{city.name}<small>{city.player}{city.alliance ? ' · ' + city.alliance : ''}{city.status ? ' · ' + city.status : ''}</small></span>
                  <strong>{city.level ?? '—'}</strong></li>)}</ul>}
              {matchedDetail.cityDate && <p className="quiet">{time(matchedDetail.cityDate)}</p>}
              {matchedDetail.sac.length > 0 && <><h4>Capa SAC</h4><ul>{matchedDetail.sac.map((city, index) =>
                <li key={index}><span>{city.name}<small>{city.player}</small></span><strong>{city.level ?? '—'}</strong></li>)}</ul></>}
            </div>
            <External href={matchedDetail.sourceUrl}>Abrir ficha en IkaDatos</External>
          </>}
        </> : <Empty>Selecciona una isla en el mapa o en la lista.</Empty>}
      </aside>
    </div>
    <section className="panel island-list">
      <div className="card-head"><div><h3>Islas por distancia</h3><p>En línea recta desde {coordLabel(center.x, center.y)}. Plazas según IkaDatos.</p></div>
        <span className="chip">{n(shortlist.length)} resultados</span></div>
      {shortlist.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Isla</th><th>Recurso</th><th>Maravilla</th><th>Plazas libres</th><th>Distancia</th></tr></thead>
          <tbody>{shortlist.slice(listPage * 12, listPage * 12 + 12).map((row) => <tr key={pointKey(row)}>
            <td><button className="link-button" onClick={() => { pick(row, true); document.querySelector('.atlas-layout')?.scrollIntoView({ block: 'start' }); }}>
              {getOwnIsland(own, row[0], row[1])?.name ?? coordLabel(row[0], row[1])}</button></td>
            <td><span className="inline-resource"><ResourceMark resource={row[2]} />{RESOURCE[row[2]].label} {n(row[4])}</span></td>
            <td>{row[5] ?? '—'}</td><td>{row[7] - row[6]}</td><td>{n(Math.hypot(row[0] - center.x, row[1] - center.y))}</td>
          </tr>)}</tbody></table></div>
        <div className="pagination"><button className="button secondary" onClick={() => setListPage((page) => page - 1)} disabled={!listPage}>Anterior</button>
          <span>{listPage + 1} de {Math.ceil(shortlist.length / 12)}</span>
          <button className="button secondary" onClick={() => setListPage((page) => page + 1)} disabled={(listPage + 1) * 12 >= shortlist.length}>Siguiente</button></div>
      </> : <Empty>No hay islas que coincidan con los filtros.</Empty>}
    </section>
  </>;
}
