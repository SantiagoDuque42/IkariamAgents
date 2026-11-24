'use client';

import { useMemo, useRef, useState } from 'react';
import { Bookmark, Building2, CalendarRange, CheckCircle2, Compass, Grape, Ship, TriangleAlert } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculate } from '../../lib/icariam/engine.mjs';
import { wineScenario } from '../../lib/icariam/scenario.mjs';
import type { City, DashboardState, JournalEntry, LedgerRecord, MapPoint, MapResource, PlanStatus, Resource, Stock } from '../../lib/icariam/dashboard-types';
import { cityName, coordLabel, Empty, Field, fieldDate, hours, MAP_RESOURCES, n, numeric, RecordContent, RESOURCE, RESOURCES, ResourceMark, Select, time, wineBudget } from './ui';

export const PLAN_MODULES = {
  wine: { label: 'Abastecimiento', icon: Grape, description: 'Vino y autonomía' },
  build: { label: 'Construcción', icon: Building2, description: 'Materiales y plazos' },
  transport: { label: 'Transportes', icon: Ship, description: 'Barcos y entregas' },
  expand: { label: 'Expansión', icon: Compass, description: 'Colonias y requisitos' },
};
export type Module = keyof typeof PLAN_MODULES;
export type Draft = { title: string; content: string; status: PlanStatus; source?: string };
export type SaveDraft = (draft: Draft, id?: string, revision?: number) => Promise<LedgerRecord<JournalEntry>>;
const statuses: Record<PlanStatus, string> = {
  proposed: 'Propuesto', pending: 'Pendiente', in_progress: 'En marcha', done: 'Completado', cancelled: 'Cancelado',
};

export function Horizon({ value, onChange }: { value: number; onChange: (hours: number) => void }) {
  return <div className="segmented" role="group" aria-label="Horizonte de planificación">
    {[6, 12, 24, 72].map((option) => <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>{option} h</button>)}
  </div>;
}

function Save({ draft, onSave }: { draft: Draft | null; onSave: SaveDraft }) {
  const [saving, setSaving] = useState(false);
  const [savedContent, setSavedContent] = useState('');
  const [error, setError] = useState('');
  const attempt = useRef<{ id: string; content: string } | null>(null);
  const saved = draft != null && savedContent === draft.content;
  async function save() {
    if (!draft || saving || saved) return;
    setSaving(true);
    setError('');
    try {
      if (attempt.current?.content !== draft.content) attempt.current = { id: 'plan-' + crypto.randomUUID(), content: draft.content };
      await onSave(draft, attempt.current.id);
      setSavedContent(draft.content);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'No se ha podido guardar.'); }
    finally { setSaving(false); }
  }
  return <div className="save-row">
    <button className="button primary" onClick={save} disabled={!draft || saving || saved}>
      {saved ? <CheckCircle2 size={18} /> : <Bookmark size={18} />}
      {saved ? 'Plan guardado' : saving ? 'Guardando…' : 'Guardar plan'}
    </button>
    {error ? <span className="field-message" role="alert">{error}</span>
      : <small role="status">{saved ? 'Está disponible en Planes guardados.' : 'Guarda el escenario para retomarlo.'}</small>}
  </div>;
}

function EntryCard({ record, onSave }: { record: LedgerRecord<JournalEntry>; onSave: SaveDraft }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = record.data.status ?? 'proposed';
  async function change(value: string) {
    if (busy || !(value in statuses)) return;
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: record.data.title ?? 'Plan', content: record.data.content ?? '',
        source: record.data.source, status: value as PlanStatus,
      }, record.record_id, record.revision);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'No se guardó el estado.'); }
    finally { setBusy(false); }
  }
  return <article className="saved-plan">
    <div><p className="overline">{time(record.data.observed_at ?? record.updated_at)}</p><h4>{record.data.title}</h4></div>
    <div><label className="sr-only" htmlFor={'state-' + record.record_id}>Estado del plan</label>
      <div className="select-wrap plan-status"><select id={'state-' + record.record_id} value={status} disabled={busy} onChange={(e) => change(e.target.value)}>
        {Object.entries(statuses).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select></div></div>
    {error && <p className="field-message" role="alert">{error}</p>}
    <details><summary>Ver plan</summary><RecordContent content={record.data.content} /></details>
  </article>;
}

function CitySelect({ cities, cityId, setCity }: {
  cities: LedgerRecord<City>[]; cityId: string; setCity: (id: string) => void;
}) {
  return <Field label="Ciudad"><Select value={cityId} onChange={setCity}>
    {cities.map((city) => <option key={city.record_id} value={city.record_id}>{cityName(city)}</option>)}
  </Select></Field>;
}

function WinePlan({ city, budget, horizon, onSave }: { city: LedgerRecord<City>; budget?: number; horizon: number; onSave: SaveDraft }) {
  const observedStock = city.data.stocks?.wine;
  const observedDate = fieldDate(city.data, 'stocks.wine');
  const measured = city.data.net_per_hour?.wine;
  const measuredDate = fieldDate(city.data, 'net_per_hour.wine');
  const paired = measured != null && observedStock != null && observedDate && measuredDate === observedDate;
  const [stockText, setStock] = useState(observedStock == null ? '' : String(observedStock));
  const [mode, setMode] = useState<'model' | 'measured' | 'manual'>(paired ? 'measured' : budget != null ? 'model' : 'manual');
  const [service, setService] = useState(100);
  const [productionText, setProduction] = useState('');
  const [flowText, setFlow] = useState('');
  const [deliveryText, setDelivery] = useState('');
  const [etaText, setEta] = useState('');
  const stock = numeric(stockText);
  const production = numeric(productionText) ?? 0;
  const delivery = numeric(deliveryText) ?? 0;
  const eta = numeric(etaText);
  const consumption = budget == null ? null : budget * service / 100;
  const net = mode === 'model' ? consumption == null ? null : production - consumption
    : mode === 'measured' ? paired ? measured : null : numeric(flowText);
  const capacity = city.data.capacity?.wine;
  const invalid = (stock != null && (stock < 0 || stock > (capacity ?? 1e15))) || production < 0 || delivery < 0 || (eta != null && eta < 0);
  const model = !invalid && stock != null && net != null && (delivery === 0 || eta != null)
    ? wineScenario({ stock, net, horizon, delivery, eta: eta ?? 0, capacity }) : null;
  const initialSource = stock === observedStock && observedDate ? 'Lectura de ' + time(observedDate) : 'Reserva de inicio introducida';
  const group = mode === 'model' ? 'Presupuesto de taberna al ' + service + ' % y producción simulada de ' + n(production) + '/h'
    : mode === 'measured' ? 'Flujo neto registrado en el mismo corte del inventario' : 'Flujo neto introducido para el escenario';
  const warning = model?.exhaustedBeforeDelivery
    ? 'La reserva se agota antes de que llegue el envío. Revisa el servicio o calcula un refuerzo anterior.'
    : model?.firstGap != null ? 'La reserva alcanza cero durante este horizonte.' : '';
  const draft: Draft | null = model ? {
    title: 'Abastecimiento de ' + cityName(city) + ' · ' + horizon + ' h',
    status: 'proposed', source: 'Cuartel de mando · Abastecimiento',
    content: '## Escenario de vino\n- ' + initialSource + '. Reserva inicial ' + n(stock) + '.\n- ' + group + '. Flujo neto ' + n(net) + ' vino/h.\n'
      + (delivery ? '- Envío simulado de ' + n(delivery) + ' a las ' + hours(eta) + ' desde el inicio.\n' : '')
      + '- Reserva estimada a ' + horizon + ' h: ' + n(model.ending) + '. '
      + (model.firstGap != null ? 'Primer agotamiento a las ' + hours(model.firstGap) + '. ' : '')
      + (warning ? '\n- ' + warning : '') + '\n- Verificar stock, producción, servicio y cargas pendientes antes de confirmar el plan.',
  } : null;
  return <div className="planner-grid">
    <section className="panel form-panel">
      <h3>Supuestos de vino</h3>
      <p className="quiet">{initialSource}. Introduce el servicio y los envíos que quieras simular.</p>
      <div className="input-grid">
        <Field label="Reserva inicial"><input type="number" inputMode="decimal" min="0" value={stockText} onChange={(e) => setStock(e.target.value)} placeholder="Unidades" /></Field>
        <Field label="Base del cálculo"><Select value={mode} onChange={(value) => setMode(value as typeof mode)}>
          {budget != null && <option value="model">Presupuesto de taberna</option>}
          {paired && <option value="measured">Flujo neto registrado</option>}
          <option value="manual">Flujo neto manual</option>
        </Select></Field>
      </div>
      {mode === 'model' && <>
        <label className="slider-field"><span>Servicio simulado <strong>{service} %</strong></span>
          <input type="range" min="0" max="100" step="5" value={service} onChange={(e) => setService(Number(e.target.value))} /></label>
        <Field label="Producción estimada por hora" hint={'Consumo estimado con este servicio: ' + n(consumption) + '/h. Campo vacío equivale a producción cero.'}>
          <input type="number" min="0" value={productionText} onChange={(e) => setProduction(e.target.value)} placeholder="0" />
        </Field>
      </>}
      {mode === 'manual' && <Field label="Flujo neto por hora" hint="Producción menos consumo de taberna. Puede ser negativo.">
        <input type="number" value={flowText} onChange={(e) => setFlow(e.target.value)} placeholder="Ej. −175" /></Field>}
      <div className="input-grid">
        <Field label="Envío hipotético"><input type="number" min="0" value={deliveryText} onChange={(e) => setDelivery(e.target.value)} placeholder="Unidades" /></Field>
        <Field label="Llegada desde el inicio"><input type="number" min="0" step="any" value={etaText} onChange={(e) => setEta(e.target.value)} placeholder="Horas" /></Field>
      </div>
      {invalid && <p className="field-message" role="alert">Revisa la capacidad y las cantidades introducidas.</p>}
      {delivery > 0 && eta == null && <p className="field-message">Indica cuándo llegaría el envío.</p>}
    </section>
    <section className="panel forecast-panel">
      <div className="card-head"><div><h3>Reserva proyectada</h3><p>Desde el inicio del escenario · {horizon} h.</p></div><span className="chip">Estimación</span></div>
      {model ? <>
        <dl className="workbench-metrics">
          <div><dt>Reserva final</dt><dd>{n(model.ending)}</dd></div>
          <div><dt>Flujo neto/h</dt><dd>{n(net)}</dd></div>
          <div><dt>Primer agotamiento</dt><dd>{model.firstGap == null ? 'Sin agotamiento' : hours(model.firstGap)}</dd></div>
        </dl>
        <div className="line-chart" aria-label="Gráfico de reserva estimada de vino">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={model.points} margin={{ top: 12, right: 12, bottom: 0, left: -12 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e2e8eb" />
              <XAxis type="number" dataKey="hour" domain={[0, horizon]} tickFormatter={(value) => value + ' h'} stroke="#657781" tickLine={false} />
              <YAxis tickFormatter={(value) => n(value)} width={70} stroke="#657781" tickLine={false} />
              <Tooltip labelFormatter={(value) => 'Hora ' + n(Number(value))} formatter={(value) => [n(Number(value)), 'Reserva estimada']} />
              <Line type="linear" dataKey="stock" stroke="#834d8c" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {warning && <p className="notice warning"><TriangleAlert size={18} />{warning}</p>}
        {delivery > 0 && !model.arrives && <p className="quiet">El envío queda fuera del horizonte elegido.</p>}
        {model.arrives && model.realDelivery < delivery && <p className="quiet">La capacidad registrada limita la llegada a {n(model.realDelivery)} unidades.</p>}
        <p className="quiet">Tasas constantes. Los cargamentos reales se verifican en Movimientos.</p>
      </> : <Empty>Completa la reserva y la tasa, o elige un presupuesto disponible.</Empty>}
      <Save draft={draft} onSave={onSave} />
    </section>
  </div>;
}

function BuildPlan({ city, data, initialBuilding, onSave }: { city: LedgerRecord<City>; data: DashboardState; initialBuilding?: string; onSave: SaveDraft }) {
  const candidates = Object.entries(city.data.buildings ?? {});
  const ref = data.references[city.record_id];
  const [building, setBuilding] = useState(initialBuilding && candidates.some(([key]) => key === initialBuilding)
    ? initialBuilding : candidates.find(([key]) => key === (city.record_id === '104855' ? 'muralla' : 'intendencia'))?.[0] ?? candidates[0]?.[0] ?? '');
  const level = city.data.buildings?.[building];
  const matched = ref?.buildings[building]?.level === level ? ref?.buildings[building] : undefined;
  const confirmed = city.record_id === '104849' && building === 'intendencia' && level === 25
    && data.entries.some((entry) => entry.record_id === 'intendencia-104849-20261121-200437');
  const calculatedCost: Stock | undefined = confirmed ? { wood: 74177, marble: 104506, wine: 0, crystal: 0, sulfur: 0 } : matched?.nextCost;
  const [changes, setChanges] = useState<Partial<Record<Resource, string>>>({});
  const [flow, setFlow] = useState<Partial<Record<Resource, string>>>({});
  const [duration, setDuration] = useState<string>();
  const durationGuess = confirmed ? 25 : matched?.nextHours;
  const durationInput = duration ?? (durationGuess == null ? '' : String(durationGuess));
  const buildHours = numeric(durationInput);
  const costs = RESOURCES.map((key) => {
    const cost = numeric(changes[key] ?? (calculatedCost?.[key] == null ? '' : String(calculatedCost[key])));
    const stock = city.data.stocks?.[key];
    const date = fieldDate(city.data, 'stocks.' + key);
    const observed = date && date === fieldDate(city.data, 'net_per_hour.' + key) ? city.data.net_per_hour?.[key] : undefined;
    const rate = numeric(flow[key] ?? (observed == null ? '' : String(observed)));
    return { key, cost, stock, rate };
  });
  const valid = costs.every((row) => row.cost == null || row.cost >= 0) && (buildHours == null || buildHours >= 0);
  const rows = costs.flatMap(({ key, cost, stock, rate }) => cost != null && cost > 0 && stock != null
    ? [{ resource: key, cost, stock, net_per_hour: rate ?? undefined }] : []);
  const missingStock = costs.some((row) => (row.cost ?? 0) > 0 && row.stock == null);
  const result = valid && rows.length ? calculate({ operation: 'shortfall', resources: rows }) : null;
  const ready = result && 'hours_until_all_ready' in result && !missingStock ? result.hours_until_all_ready : null;
  const buildingTitle = matched?.label ?? building.replaceAll('_', ' ');
  const total = ready != null && buildHours != null ? ready + buildHours : null;
  const customPrices = Object.keys(changes).length > 0;
  const costLabel = customPrices ? 'Costes editados' : confirmed ? 'Coste de captura' : 'Presupuesto de referencia';
  const draft: Draft | null = valid && costs.some((row) => (row.cost ?? 0) > 0) ? {
    title: 'Mejorar ' + buildingTitle + ' en ' + cityName(city),
    status: 'proposed', source: 'Cuartel de mando · Construcción',
    content: '## ' + costLabel + '\n- Nivel ' + (level ?? '—') + ' a ' + (level == null ? '—' : level + 1) + '.\n'
      + costs.filter((row) => (row.cost ?? 0) > 0).map((row) =>
        '- ' + RESOURCE[row.key].label + ' · coste ' + n(row.cost) + ' · existencias ' + n(row.stock)
          + ' · faltan ' + (row.stock == null ? 'por medir' : n(Math.max(0, row.cost! - row.stock))) + '.').join('\n')
      + '\n- Tiempo estimado para reunir materiales: ' + (ready == null ? 'por confirmar' : hours(ready)) + '.\n- Tiempo de obra: ' + hours(buildHours)
      + '.\n- Confirma reservas, coste y disponibilidad de cola en el juego.',
  } : null;
  return <section className="panel form-panel">
    <div className="card-head"><div><h3>Presupuesto de mejora</h3><p>{matched?.nextEffect ?? 'Introduce los costes y tiempos de la mejora.'}</p></div><span className="chip">{costLabel}</span></div>
    <div className="input-grid">
      <Field label="Edificio"><Select value={building} onChange={(value) => { setBuilding(value); setChanges({}); setFlow({}); setDuration(undefined); }}>
        {!candidates.length && <option value="">Sin inventario</option>}
        {candidates.map(([key, value]) => <option key={key} value={key}>{ref?.buildings[key]?.label ?? key.replaceAll('_', ' ')} · Nv. {value}</option>)}
      </Select></Field>
      <Field label="Duración prevista de la obra"><input type="number" min="0" step="any" value={durationInput}
        placeholder="Horas" onChange={(e) => setDuration(e.target.value)} /></Field>
    </div>
    <div className="table-wrap planning-table">
      <table><thead><tr><th>Material</th><th>Coste</th><th>Reserva observada</th><th>Flujo neto/h</th><th>Faltante</th></tr></thead>
        <tbody>{costs.map(({ key, cost, stock, rate }) => <tr key={key}>
          <th scope="row"><span className="inline-resource"><ResourceMark resource={key} />{RESOURCE[key].label}</span></th>
          <td><input type="number" min="0" value={changes[key] ?? (cost == null ? '' : String(cost))} placeholder="—"
            aria-label={'Coste en ' + RESOURCE[key].label} onChange={(event) => setChanges({ ...changes, [key]: event.target.value })} /></td>
          <td>{n(stock)}</td>
          <td><input type="number" value={flow[key] ?? (rate == null ? '' : String(rate))} placeholder="Opcional"
            aria-label={'Flujo neto de ' + RESOURCE[key].label} onChange={(event) => setFlow({ ...flow, [key]: event.target.value })} /></td>
          <td><strong>{cost != null && stock != null ? n(Math.max(0, cost - stock)) : '—'}</strong></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!valid && <p className="field-message" role="alert">Introduce costes y duración mayores o iguales a cero.</p>}
    <dl className="workbench-metrics">
      <div><dt>Materiales listos en</dt><dd>{ready == null ? 'Por confirmar' : ready === 0 ? 'Cubiertos' : hours(ready)}</dd></div>
      <div><dt>Obra desde el corte del escenario</dt><dd>{hours(total)}</dd></div>
    </dl>
    <p className="quiet">La estimación usa el inventario registrado y los flujos indicados. Confirma el precio, las existencias y la cola en el juego.</p>
    <Save draft={draft} onSave={onSave} />
  </section>;
}

function TransportPlan({ data, onSave }: { data: DashboardState; onSave: SaveDraft }) {
  const [amountText, setAmount] = useState('');
  const [shipsText, setShips] = useState(String(data.account?.data.merchant_ships_available ?? ''));
  const [capacityText, setCapacity] = useState(String(data.account?.data.merchant_capacity ?? ''));
  const [routeText, setRoute] = useState('');
  const [loadText, setLoad] = useState('');
  const amount = numeric(amountText), ships = numeric(shipsText), capacity = numeric(capacityText);
  const route = numeric(routeText), load = numeric(loadText);
  const valid = amount != null && amount > 0 && ships != null && ships >= 0 && Number.isInteger(ships)
    && capacity != null && capacity > 0 && (route == null || route >= 0) && (load == null || load >= 0);
  const result = valid ? calculate({ operation: 'transport', amount, available_ships: ships, capacity_per_ship: capacity, one_way_hours: route ?? undefined, load_hours: load ?? undefined }) : null;
  const schedule = result && 'waves' in result ? result : null;
  const draft: Draft | null = schedule ? {
    title: 'Transporte de ' + n(amount) + ' unidades', status: 'proposed', source: 'Cuartel de mando · Transportes',
    content: '## Escenario de transporte\n- ' + n(amount) + ' unidades. ' + n(ships) + ' barcos disponibles de ' + n(capacity) + ' por barco.\n'
      + '- ' + n(schedule.ships_needed) + ' cargas de barco; ' + (schedule.waves == null ? 'flota insuficiente' : n(schedule.waves) + ' tandas') + '.\n'
      + '- Última entrega estimada: ' + hours(schedule.last_delivery_hours) + '.\n- Confirma el tiempo y el estado de la ruta antes de enviar.',
  } : null;
  return <div className="planner-grid"><section className="panel form-panel"><h3>Configura el envío</h3>
    <div className="input-grid">
      <Field label="Unidades a transportar"><input type="number" min="1" value={amountText} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Barcos disponibles"><input type="number" min="0" step="1" value={shipsText} onChange={(e) => setShips(e.target.value)} /></Field>
      <Field label="Capacidad por barco"><input type="number" min="1" value={capacityText} onChange={(e) => setCapacity(e.target.value)} /></Field>
      <Field label="Viaje de ida (horas)"><input type="number" min="0" step="any" value={routeText} onChange={(e) => setRoute(e.target.value)} /></Field>
      <Field label="Carga por tanda (horas)"><input type="number" min="0" step="any" value={loadText} onChange={(e) => setLoad(e.target.value)} /></Field>
    </div><p className="quiet">Introduce los tiempos que muestre el juego para estimar la entrega.</p>
    </section>
    <section className="panel"><div className="card-head"><div><h3>Entrega prevista</h3><p>Supone una flota y una ruta constantes.</p></div><span className="chip">Estimación</span></div>
      {schedule ? <>
        <dl className="workbench-metrics">
          <div><dt>Cargas de barco</dt><dd>{n(schedule.ships_needed)}</dd></div>
          <div><dt>Tandas</dt><dd>{schedule.waves == null ? 'Sin flota' : n(schedule.waves)}</dd></div>
          <div><dt>Última entrega</dt><dd>{hours(schedule.last_delivery_hours)}</dd></div>
        </dl>
        <p className="quiet">La entrega final supone retorno entre tandas. Cada salida se confirma en el juego.</p>
      </> : <Empty>Indica el volumen y la capacidad de la flota.</Empty>}
      <Save draft={draft} onSave={onSave} />
    </section></div>;
}

function ExpansionPlan({ data, target, onMap, onSave }: { data: DashboardState; target?: MapPoint | null; onMap: () => void; onSave: SaveDraft }) {
  const [resource, setResource] = useState<MapResource | ''>('');
  const [selected, setSelected] = useState<MapPoint | null>(target ?? null);
  const capital = data.cities.find((city) => city.data.capital);
  const origin = capital?.data.coordinates ?? data.ownIslands[0];
  const atlas = data.account?.data.server_settings?.server_code === 's74-es';
  const candidates = useMemo(() => data.nearby.filter((row) => row[7] > row[6] && (!resource || row[2] === resource))
    .sort((a, b) => Math.hypot(a[0] - (origin?.x ?? 44), a[1] - (origin?.y ?? 89)) - Math.hypot(b[0] - (origin?.x ?? 44), b[1] - (origin?.y ?? 89)))
    .slice(0, 14), [data.nearby, origin?.x, origin?.y, resource]);
  const point = atlas ? selected ?? candidates[0] : undefined;
  const colonies = data.cities.filter((city) => city.data.capital === false);
  const nextColony = colonies.length + 1;
  const palace = capital?.data.buildings?.palacio;
  const homes = colonies.filter((city) => city.data.buildings?.residencia_gobernador != null
    && city.data.buildings.residencia_gobernador < nextColony);
  const incomplete = data.cities.some((city) => city.data.capital == null)
    || colonies.some((city) => city.data.buildings?.residencia_gobernador == null);
  const ownTarget = point && data.ownIslands.some((island) => island.x === point[0] && island.y === point[1]);
  const draft: Draft | null = point ? {
    title: 'Evaluar colonia en ' + coordLabel(point[0], point[1]), status: 'proposed', source: 'Cuartel de mando · Expansión',
    content: '## Candidata ' + coordLabel(point[0], point[1]) + '\n- ' + RESOURCE[point[2]].label + ' · ' + (point[5] ?? 'maravilla sin dato')
      + ' · ' + (point[7] - point[6]) + ' plazas declaradas por IkaDatos.\n- '
      + (palace != null ? 'Palacio ' + palace + ', ' + colonies.length + ' colonias registradas y ' + nextColony + ' tras fundar.' : 'Confirmar Palacio y colonias.')
      + (homes.length ? '\n- Revisar residencias de ' + homes.map(cityName).join(', ') + '.' : '')
      + '\n- Verifica plaza, coste de fundación, ruta y capacidad de abastecerla antes de comprometer recursos.',
  } : null;
  return <div className="planner-grid">
    <section className="panel form-panel"><h3>Próxima colonia</h3>
      <p className="quiet">{atlas ? 'Compara candidatas del entorno o elige cualquier isla del mapa.' : 'El mapa integrado corresponde a Atlas España.'}</p>
      {atlas && <>
        <Field label="Recurso de la isla"><Select value={resource} onChange={(value) => { setResource(value as MapResource | ''); setSelected(null); }}>
          <option value="">Cualquiera</option>{MAP_RESOURCES.map((key) => <option value={key} key={key}>{RESOURCE[key].label}</option>)}
        </Select></Field>
        <Field label="Isla candidata"><Select value={point ? point[0] + ':' + point[1] : ''} onChange={(value) => setSelected(candidates.find((item) => item[0] + ':' + item[1] === value) ?? null)}>
          {!point && <option value="">Sin candidatas en el entorno</option>}
          {point && !candidates.some(([x, y]) => x === point[0] && y === point[1]) && <option value={point[0] + ':' + point[1]}>{coordLabel(point[0], point[1])} · {RESOURCE[point[2]].label}</option>}
          {candidates.map((row) => <option key={row[0] + ':' + row[1]} value={row[0] + ':' + row[1]}>{coordLabel(row[0], row[1])} · {RESOURCE[row[2]].label} · {row[7] - row[6]} {row[7] - row[6] === 1 ? 'plaza' : 'plazas'}</option>)}
        </Select></Field>
        {point && <dl className="workbench-metrics"><div><dt>Yacimiento</dt><dd>{n(point[4])}</dd></div>
          <div><dt>Aserradero</dt><dd>{n(point[3])}</dd></div>
          <div><dt>Distancia en casillas</dt><dd>{origin ? n(Math.hypot(point[0] - origin.x, point[1] - origin.y)) : '—'}</dd></div>
        </dl>}
        <button className="button secondary" onClick={onMap}><Compass size={17} />Explorar mapa de Atlas</button>
      </>}
    </section>
    <section className="panel"><div className="card-head"><div><h3>Requisitos de expansión</h3><p>Antes de fundar, comprueba la plaza y el abastecimiento.</p></div></div>
      <dl className="workbench-metrics"><div><dt>Palacio observado</dt><dd>{n(palace)}</dd></div>
        <div><dt>Colonias registradas</dt><dd>{colonies.length}</dd></div>
        <div><dt>Colonias tras fundar</dt><dd>{nextColony}</dd></div></dl>
      <ol className="checklist">
        <li>{palace == null ? 'Confirma el nivel de Palacio en la capital.' : palace < nextColony ? 'La ampliación requiere revisar el Palacio antes de fundar.' : 'El Palacio observado cubre el número de colonias del escenario.'}</li>
        <li>{homes.length ? 'Revisa las residencias de ' + homes.map(cityName).join(', ') + ' para estimar la corrupción.' : 'Comprueba el nivel de la residencia y el gobierno para calcular la corrupción.'}</li>
        <li>{point ? 'Confirma la plaza de ' + coordLabel(point[0], point[1]) + (ownTarget ? ' con la vista del juego, porque IkaDatos omite ciudades propias.' : ' con la vista del juego.') : 'Elige una isla y verifica las plazas.'}</li>
        <li>Calcula el coste de fundación, primer envío de vino y tiempo de llegada.</li>
      </ol>
      {incomplete && <p className="quiet">Faltan niveles o datos de alguna colonia.</p>}
      <Save draft={draft} onSave={onSave} />
    </section>
  </div>;
}

export function Planner({ data, module, setModule, cityId, setCity, horizon, setHorizon, target, building, save, onMap }: {
  data: DashboardState; module: Module; setModule: (key: Module) => void; cityId: string; setCity: (id: string) => void;
  horizon: number; setHorizon: (hours: number) => void; target: MapPoint | null; building?: string;
  save: SaveDraft; onMap: () => void;
}) {
  const city = data.cities.find((item) => item.record_id === cityId) ?? data.cities[0];
  const plans = data.entries.filter((entry) => entry.kind === 'plan');
  return <>
    <div className="section-head"><div><h2>Planificación</h2><p>Simula tus próximos pasos y guarda las opciones que quieras revisar.</p></div><span className="chip"><CalendarRange size={16} />Horizonte {horizon} h</span></div>
    <div className="plan-modules" role="group" aria-label="Módulo de planificación">
      {(Object.keys(PLAN_MODULES) as Module[]).map((key) => { const { label, icon: Icon, description } = PLAN_MODULES[key];
        return <button key={key} aria-pressed={module === key} onClick={() => setModule(key)}>
          <span className="feature-icon"><Icon size={21} /></span><span><strong>{label}</strong><small>{description}</small></span>
        </button>;
      })}
    </div>
    {(module === 'wine' || module === 'build') && citiesAvailable(data) && <div className="plan-setup">
      <CitySelect cities={data.cities} cityId={city.record_id} setCity={setCity} />
      {module === 'wine' && <Horizon value={horizon} onChange={setHorizon} />}
    </div>}
    {module === 'wine' && (city ? <WinePlan key={city.record_id} city={city} budget={wineBudget(city.data, data.references[city.record_id])} horizon={horizon} onSave={save} /> : <Empty>Registra una ciudad para simular su vino.</Empty>)}
    {module === 'build' && (city ? <BuildPlan key={city.record_id + (building ?? '')} city={city} initialBuilding={building} data={data} onSave={save} /> : <Empty>Registra una ciudad para planificar su obra.</Empty>)}
    {module === 'transport' && <TransportPlan data={data} onSave={save} />}
    {module === 'expand' && <ExpansionPlan key={target ? target[0] + ':' + target[1] : 'expand'} data={data} target={target} onMap={onMap} onSave={save} />}
    <section className="panel saved-plans">
      <div className="card-head"><div><h3>Planes guardados</h3><p>Consulta los pasos y actualiza su estado.</p></div><span className="chip">{plans.length}</span></div>
      {plans.length ? plans.map((plan) => <EntryCard key={plan.record_id} record={plan} onSave={save} />) : <Empty>Los planes que guardes aparecerán aquí.</Empty>}
    </section>
  </>;
}

function citiesAvailable(data: DashboardState) { return data.cities.length > 0; }
