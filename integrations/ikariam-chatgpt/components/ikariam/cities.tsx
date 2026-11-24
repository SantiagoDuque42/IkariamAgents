'use client';

import { Building2, Castle, ChartNoAxesColumnIncreasing, ChevronDown, Database, Flag, Grape, MapPin, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { City, CityReference, LedgerRecord, OwnIsland, Resource } from '../../lib/icariam/dashboard-types';
import { cityName, coordLabel, Empty, fieldDate, getOwnIsland, n, RESOURCE, RESOURCES, ResourceMark, ResourceOptions, time, wineBudget } from './ui';

export function StockByCity({ cities, reference, horizon, onCity }: {
  cities: LedgerRecord<City>[]; reference: Record<string, CityReference>; horizon: number;
  onCity: (id: string) => void;
}) {
  const [resource, setResource] = useState<Resource>('wine');
  const [ascending, setAscending] = useState(true);
  const rows = cities.map((city) => ({ city, value: city.data.stocks?.[resource], budget: wineBudget(city.data, reference[city.record_id]) }))
    .sort((a, b) => Number(a.value == null) - Number(b.value == null)
      || ((a.value ?? 0) - (b.value ?? 0)) * (ascending ? 1 : -1)
      || cityName(a.city).localeCompare(cityName(b.city), 'es'));
  const top = Math.max(1, ...rows.map(({ value }) => value ?? 0));
  const known = rows.filter(({ value }) => value != null);
  const total = known.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return <section className="panel stock-chart">
    <div className="card-head"><div><h3>Reservas por ciudad</h3><p>Último inventario registrado para cada material.</p></div>
      <button className="sort-button" aria-label={ascending ? 'Ordenar de mayor a menor' : 'Ordenar de menor a mayor'}
        onClick={() => setAscending(!ascending)}><ChartNoAxesColumnIncreasing size={17} /><span>{ascending ? 'Menor primero' : 'Mayor primero'}</span></button>
    </div>
    <ResourceOptions value={resource} onChange={(value) => setResource(value || 'wine')} />
    {rows.length ? <>
      <ul className="bar-list" aria-label={'Reservas de ' + RESOURCE[resource].label}>
        {rows.map(({ city, value, budget }) => {
          const low = resource === 'wine' && value != null && budget != null && value < budget * horizon;
          return <li key={city.record_id}>
            <button className="bar-row" onClick={() => onCity(city.record_id)} title={cityName(city) + ' · ' + time(fieldDate(city.data, 'stocks.' + resource))}>
              <span className="bar-name">{cityName(city)}</span>
              <span className="bar-track"><span className={low ? 'bar-fill bar-warning' : 'bar-fill'}
                style={{ width: value == null ? '0%' : (value / top * 100) + '%', background: low ? undefined : RESOURCE[resource].color }} /></span>
              <strong className="bar-value">{n(value)}</strong>
            </button>
          </li>;
        })}
      </ul>
      <div className="chart-footer"><span>{known.length}/{rows.length} con lectura</span>
        {resource === 'wine' && <span><i className="chart-key" />Por debajo de {horizon} h al servicio máximo estimado</span>}
        <strong>{n(total)} total</strong></div>
    </> : <Empty>Añade ciudades a tu cuenta de Ikariam para comparar reservas.</Empty>}
  </section>;
}

const CAP_FIELDS = [
  ['housing', 'Vivienda base'], ['storage', 'Almacén por material'], ['protected', 'Protegido por material'],
  ['actions', 'Puntos de acción base'], ['culturalGoods', 'Bienes culturales'], ['museumFixed', 'Satisfacción fija del museo'],
  ['museumMaximum', 'Satisfacción máx. del museo'], ['scientists', 'Científicos'], ['scientistGoldCost', 'Oro/h base de científicos'],
  ['priests', 'Sacerdotes'], ['spies', 'Espías'], ['landGarrison', 'Guarnición terrestre'],
] as const;

export function CitiesView({ cities, references, own, cityId, setCity, onPlan, onMap, onRecord, hasIntendance, hasSanctuary }: {
  cities: LedgerRecord<City>[]; references: Record<string, CityReference>; own: OwnIsland[]; cityId: string;
  setCity: (id: string) => void; onPlan: (id: string, building?: string) => void;
  onMap: (x: number, y: number) => void; onRecord: (id: string) => void; hasIntendance: boolean; hasSanctuary: boolean;
}) {
  const [resource, setResource] = useState<Resource>('wine');
  const [buildingQuery, setBuildingQuery] = useState('');
  const city = cities.find((item) => item.record_id === cityId) ?? cities[0];
  const ref = city ? references[city.record_id] : undefined;
  const buildings = useMemo(() => Object.entries(city?.data.buildings ?? {}).map(([key, level]) => ({
    key, level, definition: ref?.buildings[key], label: ref?.buildings[key]?.label ?? key.replaceAll('_', ' '),
  })).filter((building) => (building.label + ' ' + (building.definition?.category ?? '')).toLocaleLowerCase('es').includes(buildingQuery.trim().toLocaleLowerCase('es'))),
  [buildingQuery, city, ref]);
  if (!city) return <Empty>Registra una ciudad en Ikariam para abrir su inventario.</Empty>;
  const { coordinates, island_resource: islandResource, population, satisfaction, corruption_pct: corruption } = city.data;
  const island = coordinates ? getOwnIsland(own, coordinates.x, coordinates.y) : undefined;
  const baseline = ref?.baseline.stocks[resource];
  const current = city.data.stocks?.[resource];
  const maxStock = Math.max(baseline ?? 0, current ?? 0, 1);
  const difference = baseline != null && current != null ? current - baseline : null;
  const model = wineBudget(city.data, ref);
  const confirmed = hasIntendance && city.record_id === '104849';
  const villageCount = Object.keys(city.data.buildings ?? {}).length;
  return <>
    <div className="section-head"><div><h2>Ciudades</h2><p>Inventario, edificios y observaciones de cada ciudad.</p></div>
      <span className="chip"><Building2 size={16} />{cities.length} ciudades</span></div>
    <div className="cities-layout">
      <aside className="panel city-menu" aria-label="Tus ciudades">
        <h3>Selecciona ciudad</h3>
        {cities.map((item) => <button key={item.record_id} aria-pressed={city.record_id === item.record_id} onClick={() => {
          setCity(item.record_id);
          setBuildingQuery('');
        }}><span className="city-menu-icon">{item.data.island_resource ? <ResourceMark resource={item.data.island_resource} /> : <Flag size={18} />}</span>
          <span><strong>{cityName(item)}</strong><small>{item.data.capital ? 'Capital' : item.data.coordinates ? coordLabel(item.data.coordinates.x, item.data.coordinates.y) : 'Colonia'}</small></span>
        </button>)}
      </aside>
      <div className="city-content">
        <section className="panel city-profile">
          <div className="card-head"><div><p className="overline">{city.data.capital ? 'Capital' : 'Colonia'}{coordinates ? ' · ' + coordLabel(coordinates.x, coordinates.y) : ''}</p>
            <h3>{cityName(city)}</h3><p>{island?.name ?? ref?.island ?? 'Isla sin nombre registrado'}{islandResource ? ' · ' + RESOURCE[islandResource].label : ''}</p></div>
            {coordinates && <button className="button secondary" onClick={() => onMap(coordinates.x, coordinates.y)}><MapPin size={17} />Ver isla</button>}
          </div>
          <div className="city-summary">
            <div><UsersRound size={16} /><span>Población registrada</span><strong>{n(population)}</strong></div>
            <div><Grape size={16} /><span>Vino al máximo estimado</span><strong>{n(model)}{model == null ? '' : '/h'}</strong></div>
            <div><Castle size={16} /><span>Edificios observados</span><strong>{n(villageCount)}</strong></div>
            <div><Database size={16} /><span>Satisfacción / corrupción</span><strong>{n(satisfaction)} / {corruption == null ? '—' : n(corruption) + ' %'}</strong></div>
          </div>
          {city.data.notes && <p className="quiet">{city.data.notes}</p>}
          {island?.reportId && <button className="link-button" onClick={() => onRecord(island.reportId!)}>Ver captura registrada de {island.name}</button>}
          {hasSanctuary && city.record_id === '104851' && <button className="link-button" onClick={() => onRecord('santuario-104851-20261121-195601')}>Ver captura del Santuario</button>}
        </section>
        <section className="panel city-resources">
          <div className="card-head"><div><h3>Reservas e inventario</h3><p>Compara la captura inicial con el último corte de cada recurso.</p></div></div>
          <div className="resource-balances">
            {RESOURCES.map((key) => <button className="resource-balance" type="button" key={key} aria-pressed={resource === key} onClick={() => setResource(key)}>
              <span><ResourceMark resource={key} />{RESOURCE[key].label}</span><strong>{n(city.data.stocks?.[key])}</strong>
              <small>{time(fieldDate(city.data, 'stocks.' + key))}</small>
            </button>)}
          </div>
          <h4>{RESOURCE[resource].label} entre cortes</h4>
          <div className="comparisons">
            {[{ label: 'Captura inicial', value: baseline, stamp: ref?.baseline.observedAt },
              { label: 'Última lectura', value: current, stamp: fieldDate(city.data, 'stocks.' + resource) }].map((row, index) =>
              <div key={row.label}><span><strong>{row.label}</strong><small>{time(row.stamp)}</small></span>
                <span className="bar-track"><span className="bar-fill" style={{ width: ((row.value ?? 0) / maxStock * 100) + '%', opacity: index ? 1 : 0.4,
                  background: RESOURCE[resource].color }} /></span><strong>{n(row.value)}</strong></div>)}
          </div>
          <p className="quiet">{difference == null ? 'Faltan lecturas comparables.' : 'Cambio observado ' + (difference > 0 ? '+' : '') + n(difference)}.
            {city.data.net_per_hour?.[resource] != null ? ' Flujo observado ' + n(city.data.net_per_hour[resource]) + '/h · ' + time(fieldDate(city.data, 'net_per_hour.' + resource)) + '.' : ''}</p>
        </section>
        {confirmed && <section className="panel">
          <div className="card-head"><div><h3>Intendencia de Borrachuzos</h3><p>Captura del 21 de noviembre a las 20:04.</p></div>
            <button className="button secondary" onClick={() => onRecord('intendencia-104849-20261121-200437')}>Ver informe</button></div>
          <dl className="workbench-metrics">
            <div><dt>Crecimiento observado</dt><dd>−1,93/h</dd></div><div><dt>Oro local</dt><dd>+5.273/h</dd></div>
            <div><dt>Investigación</dt><dd>+227/h</dd></div><div><dt>Vivienda</dt><dd>2.601/2.630</dd></div>
          </dl>
          <p className="quiet">La captura muestra 438 vino/h en el viñedo. El consumo efectivo de la taberna queda por confirmar.</p>
        </section>}
        {ref && <details className="panel disclosure">
          <summary><span>Capacidad y bonificaciones de referencia</span><ChevronDown size={19} /></summary>
          <p className="quiet">Calculadas a partir de los niveles del inventario del {time(ref.baseline.observedAt)}.</p>
          <dl className="workbench-metrics">{CAP_FIELDS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{n(ref.capacity[key])}</dd></div>)}</dl>
          <div className="table-wrap"><table><thead><tr><th>Material</th><th>Reducción de coste</th><th>Bonificación de producción</th></tr></thead>
            <tbody>{RESOURCES.map((key) => <tr key={key}><td>{RESOURCE[key].label}</td><td>{n(ref.reductions[key])} %</td><td>{n(ref.productionBonus[key])} %</td></tr>)}</tbody>
          </table></div>
        </details>}
        <section className="panel">
          <div className="card-head"><div><h3>Edificios</h3><p>Niveles registrados. Detalle y costes orientativos según el inventario.</p></div>
            <input className="filter-input" aria-label="Filtrar edificios" placeholder="Filtrar edificios" value={buildingQuery} onChange={(event) => setBuildingQuery(event.target.value)} />
          </div>
          {buildings.length ? <div className="building-list">{buildings.map(({ key, level, definition, label }) => <details className="building-row" key={key}>
            <summary><span><strong>{label}</strong><small>{definition?.category ?? 'Edificio'}</small></span><span className="level">Nv. {level}</span><ChevronDown size={17} /></summary>
            <div className="building-body">
              {definition?.level === level && <>
                <p>{definition.effect}</p><p>{definition.operating}</p><p><strong>Siguiente mejora</strong> {definition.nextEffect}</p>
                <div className="mini-resources">{RESOURCES.filter((resource) => Boolean(definition.nextCost[resource])).map((resource) =>
                  <span key={resource}><ResourceMark resource={resource} />{n(definition.nextCost[resource])} {RESOURCE[resource].label.toLowerCase()}</span>)}
                </div>
                {RESOURCES.some((resource) => Boolean(definition.investment[resource])) && <>
                  <p className="quiet">Inversión acumulada estimada hasta el nivel {level}</p>
                  <div className="mini-resources">{RESOURCES.filter((resource) => Boolean(definition.investment[resource])).map((resource) =>
                    <span key={resource}><ResourceMark resource={resource} />{n(definition.investment[resource])} {RESOURCE[resource].label.toLowerCase()}</span>)}
                  </div>
                </>}
                {confirmed && key === 'intendencia' && level === 25 && <p className="source-note">Coste observado de la mejora 25 a 26: 74.177 madera y 104.506 mármol. La planificación usa esta captura.</p>}
              </>}
              <button className="button secondary" onClick={() => onPlan(city.record_id, key)}>Planificar mejora</button>
            </div>
          </details>)}</div> : <Empty>{buildingQuery ? 'No hay edificios que coincidan.' : 'Esta ciudad aún no tiene edificios registrados.'}</Empty>}
        </section>
      </div>
    </div>
  </>;
}
