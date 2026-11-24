'use client';

import { Activity, BookOpen, Building2, CalendarRange, Compass, Database, Grape, Layers3, MapPin, Ship, Swords, TriangleAlert, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Account, Coordinate, DashboardState, JournalEntry, KnowledgeInfo, LedgerRecord, MapPoint } from '../../lib/icariam/dashboard-types';
import { AtlasView, MiniAtlas } from './atlas';
import { CitiesView, StockByCity } from './cities';
import { Combat, type CombatCatalog, type CombatExample } from './combat';
import { OtherPlayers } from './other-players';
import combatUnits from '../../data/combat-units.json';
import combatExamples from '../../data/combat-examples.json';
import { Horizon, Planner, type Draft, type Module } from './planner';
import { cityName, coordLabel, Empty, External, fieldDate, MAP_RESOURCES, n, RecordContent, RESOURCE, ResourceMark, time, wineBudget } from './ui';

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: Activity },
  { id: 'atlas', label: 'Mapa de Atlas', icon: Compass },
  { id: 'ciudades', label: 'Ciudades', icon: Building2 },
  { id: 'jugadores', label: 'Otros jugadores', icon: UsersRound },
  { id: 'combate', label: 'Combate', icon: Swords },
  { id: 'planes', label: 'Planificación', icon: CalendarRange },
  { id: 'registro', label: 'Registro', icon: BookOpen },
] as const;
type Tab = (typeof TABS)[number]['id'];
const isTab = (value: string): value is Tab => TABS.some(({ id }) => value === id);

function Header({ tab, navigate, account, accounts }: {
  tab: Tab; navigate: (tab: Tab) => void; account: LedgerRecord<Account> | null; accounts: LedgerRecord<Account>[];
}) {
  return <header className="topbar">
    <div className="frame topbar-inner">
      <a className="brand" href="#resumen" onClick={(e) => { e.preventDefault(); navigate('resumen'); }}>
        <img src="/favicon.svg" alt="" width="38" height="38" /><span>IKARIAM</span>
      </a>
      <nav aria-label="Navegación del cuartel">
        {TABS.map(({ id, label, icon: Icon }) => <a key={id} href={'#' + id} aria-current={tab === id ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); navigate(id); }}><Icon size={17} aria-hidden="true" />{label}</a>)}
      </nav>
      {account && <div className="account-chip" title={account.data.alias}>
        <span className="account-mark">{(account.data.alias ?? 'I').slice(0, 1).toUpperCase()}</span>
        {accounts.length > 1
          ? <select aria-label="Cuenta" value={account.record_id} onChange={(e) => {
            const query = new URLSearchParams({ cuenta: e.target.value });
            window.location.assign('/?' + query + '#' + tab);
          }}>{accounts.map((item) => <option key={item.record_id} value={item.record_id}>{item.data.alias ?? item.record_id}</option>)}</select>
          : <span><strong>{account.data.alias ?? account.record_id}</strong><small>{account.data.world ?? 'Ikariam'}{account.data.community ? ' · ' + account.data.community : ''}</small></span>}
      </div>}
    </div>
  </header>;
}

function Overview({ data, horizon, setHorizon, center, navigate, onCity, onSelect, openPlan }: {
  data: DashboardState; horizon: number; setHorizon: (hours: number) => void; center: Coordinate;
  navigate: (tab: Tab) => void; onCity: (id: string) => void; onSelect: (point: MapPoint) => void;
  openPlan: (module: Module, cityId?: string, building?: string) => void;
}) {
  const account = data.account?.data;
  const server = account?.server_settings?.server_code;
  const wineBudgets = data.cities.flatMap((city) => {
    const wine = city.data.stocks?.wine;
    const limit = wineBudget(city.data, data.references[city.record_id]);
    return wine != null && limit != null ? [{ city, wine, limit }] : [];
  });
  const wineRows = wineBudgets.filter(({ wine, limit }) => wine < limit * horizon)
    .sort((a, b) => a.wine / a.limit - b.wine / b.limit);
  const wineStocks = data.cities.map((city) => city.data.stocks?.wine).filter((stock): stock is number => stock != null);
  const wineTotal = wineStocks.length ? wineStocks.reduce((sum, value) => sum + value, 0) : null;
  const buildingCount = data.cities.reduce((sum, city) => sum + Object.keys(city.data.buildings ?? {}).length, 0);
  const lastStock = data.cities.flatMap((city) => Object.keys(city.data.stocks ?? {}).flatMap((key) => {
    const stamp = fieldDate(city.data, 'stocks.' + key);
    return stamp ? [stamp] : [];
  })).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const hasMap = data.nearby.length > 0;
  const atlasWorld = server === 's74-es';
  return <>
    <section className="hero-dash">
      <div>
        <p className="overline">{account?.world ?? 'Ikariam'}{account?.community === 'ES' ? ' España' : ''}{server ? ' · ' + server : ''}</p>
        <h1>Cuartel de mando</h1>
        <p className="hero-intro">Tus ciudades, el mapa y las decisiones de la próxima expedición.</p>
        <div className="hero-actions">
          <button className="button gold" onClick={() => openPlan('wine')}><CalendarRange size={19} />Simular un plan</button>
          <button className="button on-dark" onClick={() => navigate('atlas')}><Compass size={18} />Abrir mapa</button>
        </div>
      </div>
      <div className="hero-reading">
        <div className="hero-reading-icon"><Layers3 size={25} strokeWidth={1.5} /></div>
        <div><span>Último corte de reservas</span><strong>{time(lastStock)}</strong><small>Observaciones guardadas</small></div>
      </div>
    </section>
    <div className="metrics-grid">
      <article className="metric"><span className="metric-icon"><Building2 size={20} /></span><div><p>Ciudades propias</p><strong>{n(data.cities.length)}</strong><small>{n(buildingCount)} edificios observados</small></div></article>
      <article className="metric"><span className="metric-icon wine"><Grape size={20} /></span><div><p>Vino registrado</p><strong>{n(wineTotal)}</strong><small>{wineStocks.length} ciudades con lectura</small></div></article>
      <article className="metric"><span className="metric-icon sand"><TriangleAlert size={20} /></span><div><p>Bajo reserva de {horizon} h</p><strong>{n(wineBudgets.length ? wineRows.length : null)}</strong><small>{wineBudgets.length === data.cities.length && wineBudgets.length ? 'Taberna al máximo estimado' : `${wineBudgets.length}/${data.cities.length} con presupuesto`}</small></div></article>
      <article className="metric"><span className="metric-icon blue"><MapPin size={20} /></span><div><p>Islas de Atlas</p><strong>{n(data.atlas.islands)}</strong><small>{n(data.atlas.free)} plazas en IkaDatos</small></div></article>
    </div>
    <div className="overview-grid">
      <StockByCity cities={data.cities} reference={data.references} horizon={horizon} onCity={onCity} />
      <section className="panel overview-map">
        <div className="card-head"><div><h3>{hasMap ? 'Tus islas en Atlas' : 'Cartografía de Atlas'}</h3>
          <p>{hasMap ? data.ownIslands.length + ' islas propias · ' + coordLabel(center.x, center.y) + ' de referencia' : n(data.atlas.islands) + ' islas cartografiadas'}</p></div>
          <button className="map-quick" onClick={() => navigate('atlas')} aria-label="Abrir mapa de Atlas"><Compass size={22} /></button></div>
        {hasMap && <MiniAtlas points={data.nearby} own={data.ownIslands} center={center} onSelect={onSelect} />}
        <div className="map-resource-strip" aria-label="Distribución mundial de recursos">
          {MAP_RESOURCES.map((resource) => <div key={resource}><span><ResourceMark resource={resource} size={16} />{RESOURCE[resource].label}</span>
            <strong>{n(data.atlas.byResource[resource])}</strong></div>)}
        </div>
      </section>
    </div>
    <section className="panel review-panel">
      <div className="card-head"><div><h3>Próxima revisión</h3><p>Usa el horizonte para comparar reservas antes de comprometer envíos u obras.</p></div>
        <Horizon value={horizon} onChange={setHorizon} /></div>
      <div className="review-grid">
        <article><div className="feature-icon review-wine"><Grape size={21} /></div><h4>Comprobar las tabernas</h4>
          <p>{wineRows.length ? wineRows.slice(0, 4).map((row) => cityName(row.city)).join(', ') + ' tienen menos vino que el presupuesto de referencia.'
            : 'Comprueba servicio y producción locales para proyectar la autonomía.'}</p>
          <button className="link-button" onClick={() => openPlan('wine', wineRows[0]?.city.record_id)}>Simular reservas</button></article>
        <article><div className="feature-icon"><Ship size={21} /></div><h4>Verificar los envíos</h4>
          <p>{data.entries.some((entry) => entry.record_id === 'vino-plan-12h-2026-11-21') ?
            'Hay un reparto comunicado. Comprueba destinos, cantidades y llegadas en Movimientos.' : 'Calibra la capacidad de la flota y los tiempos de ida y carga.'}</p>
          <button className="link-button" onClick={() => openPlan('transport')}>Calcular transporte</button></article>
        <article><div className="feature-icon"><Building2 size={21} /></div><h4>Preparar la siguiente obra</h4>
          <p>Compara costes y faltantes cuando la reserva de vino esté cubierta.</p>
          <button className="link-button" onClick={() => openPlan('build')}>Presupuestar mejora</button></article>
      </div>
      {atlasWorld && <p className="quiet coverage-line">Atlas · IkaDatos consultado el {time(data.atlas.observedAt)} · {n(data.atlas.cityLists)} fichas nominales y capa SAC.</p>}
    </section>
  </>;
}

function Registry({ data, knowledge, selected, select }: {
  data: DashboardState; knowledge: KnowledgeInfo[]; selected: string; select: (id: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [section, setSection] = useState<'observations' | 'knowledge'>('observations');
  const records = data.entries.filter((record) => record.kind !== 'plan');
  const active = records.find((record) => record.record_id === selected) ?? records[0];
  const words = filter.trim().toLocaleLowerCase('es');
  const modules = knowledge.filter((item) => (item.title + ' ' + item.summary).toLocaleLowerCase('es').includes(words));
  return <>
    <div className="section-head"><div><h2>Registro y fuentes</h2><p>Observaciones de tus ciudades, inventario y guías para contrastar cálculos.</p></div>
      {data.workbookUrl && <External className="button secondary" href={data.workbookUrl}>Inventario de Atlas</External>}</div>
    <div className="segmented registry-tabs" role="group" aria-label="Tipo de registro">
      <button type="button" aria-pressed={section === 'observations'} onClick={() => setSection('observations')}>Observaciones</button>
      <button type="button" aria-pressed={section === 'knowledge'} onClick={() => setSection('knowledge')}>Guías de Ikariam</button>
    </div>
    {section === 'observations' ? <>
      <div className="registry-layout">
        <section className="panel record-list"><h3>Datos registrados</h3>
          {records.length ? records.map((record) => <button key={record.record_id} type="button" aria-pressed={active?.record_id === record.record_id}
            onClick={() => select(record.record_id)}><strong>{record.data.title ?? record.record_id}</strong><small>{time(record.data.observed_at ?? record.updated_at)}</small></button>)
            : <p className="quiet">Aún no hay observaciones guardadas.</p>}
        </section>
        <article className="panel record-paper">
          {active ? <>
            <div className="card-head"><div><h3>{active.data.title ?? active.record_id}</h3><p>{time(active.data.observed_at ?? active.updated_at, true)}</p></div></div>
            <RecordContent content={active.data.content} />
            {active.data.source && <p className="source-note">{active.data.source}</p>}
          </> : <Empty>Selecciona una observación cuando esté disponible.</Empty>}
        </article>
      </div>
      <section className="panel">
        <div className="card-head"><div><h3>Cobertura del mapa</h3><p>Consulta de IkaDatos del {time(data.atlas.observedAt, true)}.</p></div>
          <External href={data.atlas.sourceUrl}>Abrir IkaDatos</External></div>
        <dl className="workbench-metrics"><div><dt>Islas geolocalizadas</dt><dd>{n(data.atlas.islands)}</dd></div>
          <div><dt>Ciudades en fichas nominales</dt><dd>{n(data.atlas.cities)}</dd></div>
          <div><dt>Ciudades en capa SAC</dt><dd>{n(data.atlas.sacCities)}</dd></div></dl>
        <p className="quiet">{n(data.atlas.cityLists)} fichas nominales detalladas. La capa SAC puede coincidir con parte de esas fichas. {data.ownIslands.length ? 'Las plazas de tus islas requieren contraste con el juego.' : ''}</p>
      </section>
      {data.account?.data.notes && <section className="panel"><h3>Cuenta observada</h3><p className="quiet">{data.account.data.notes}</p>
        {data.account.data.goals?.length ? <ul className="simple-list">{data.account.data.goals.map((goal) => <li key={goal}>{goal}</li>)}</ul> : null}</section>}
    </> : <section className="panel knowledge">
      <div className="card-head"><div><h3>Guías y referencias</h3><p>Abre cada guía para ver los datos y sus fuentes.</p></div>
        <input className="filter-input" aria-label="Buscar una guía" placeholder="Buscar una guía" value={filter} onChange={(event) => setFilter(event.target.value)} /></div>
      {modules.length ? modules.map((item) => <details className="building-row" key={item.id}>
        <summary><span><strong>{item.title}</strong><small>{item.summary}</small></span><BookOpen size={17} /></summary>
        <div className="building-body"><RecordContent content={item.content} />
          <div className="source-links">{item.sources.map((source) => <External key={source.id} href={source.url}>{source.title}</External>)}</div></div>
      </details>) : <Empty>No se encontraron guías.</Empty>}
    </section>}
  </>;
}

export function Dashboard({ data: initial, knowledge, signedIn, signInUrl }: {
  data: DashboardState; knowledge: KnowledgeInfo[]; signedIn: boolean; signInUrl: string;
}) {
  const [tab, setTab] = useState<Tab>('resumen');
  const [entries, setEntries] = useState(initial.entries);
  const [cityId, setCityId] = useState(initial.cities[0]?.record_id ?? '');
  const [module, setModule] = useState<Module>('wine');
  const [building, setBuilding] = useState<string>();
  const [horizon, setHorizon] = useState(12);
  const [mapFocus, setMapFocus] = useState<Coordinate | null>(null);
  const [target, setTarget] = useState<MapPoint | null>(null);
  const [record, setRecord] = useState('');
  const [playerName, setPlayerName] = useState('');
  const data = useMemo(() => ({ ...initial, entries }), [initial, entries]);
  const center = data.account?.data.server_settings?.server_code === 's74-es'
    ? data.cities.find((city) => city.data.capital)?.data.coordinates ?? data.ownIslands[0] ?? { x: 44, y: 89 }
    : { x: 50, y: 50 };
  useEffect(() => {
    function locationTab() {
      const next = window.location.hash.slice(1);
      if (isTab(next)) setTab(next);
      else setTab('resumen');
    }
    locationTab();
    window.addEventListener('popstate', locationTab);
    window.addEventListener('hashchange', locationTab);
    return () => { window.removeEventListener('popstate', locationTab); window.removeEventListener('hashchange', locationTab); };
  }, []);
  function navigate(next: Tab) {
    if (window.location.hash !== '#' + next) window.history.pushState(null, '', '#' + next);
    setTab(next);
    window.scrollTo({ top: 0 });
  }
  function openPlan(next: Module, id?: string, key?: string) {
    setModule(next);
    if (id) setCityId(id);
    setBuilding(key);
    navigate('planes');
  }
  function openCity(id: string) { setCityId(id); navigate('ciudades'); }
  function openRecord(id: string) { setRecord(id); navigate('registro'); }
  function openMap(x?: number, y?: number) {
    if (x != null && y != null) setMapFocus({ x, y });
    navigate('atlas');
  }
  async function save(draft: Draft, entryId?: string, revision?: number) {
    if (!data.account) throw Error('Selecciona una cuenta para guardar el plan.');
    const id = entryId ?? 'plan-' + crypto.randomUUID();
    const response = await fetch('/api/dashboard', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: data.account.record_id, entry_id: id, expected_revision: revision ?? 0,
        data: { title: draft.title.slice(0, 200), content: draft.content, status: draft.status, source: draft.source,
          ...(revision === undefined ? { observed_at: new Date().toISOString() } : {}) },
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { message?: string } | null;
      throw Error(result?.message ?? 'No se pudo guardar el plan.');
    }
    const saved = await response.json() as LedgerRecord<JournalEntry>;
    setEntries((current) => current.some((row) => row.record_id === saved.record_id && row.kind === 'plan')
      ? current.map((row) => row.record_id === saved.record_id && row.kind === 'plan' ? saved : row)
      : [saved, ...current]);
    return saved;
  }

  if (!signedIn) return <div className="dashboard">
    <header className="topbar"><div className="frame topbar-inner"><a className="brand" href="/"><img src="/favicon.svg" alt="" width="38" height="38" />IKARIAM</a></div></header>
    <main className="frame main-frame">
      <section className="hero-dash signed-out"><div><p className="overline">Atlas España</p><h1>Cuartel de mando</h1>
        <p className="hero-intro">Entra para consultar tus ciudades, el mapa y los planes guardados.</p>
        <a className="button gold" href={signInUrl} target="_top">Entrar con ChatGPT</a></div></section>
    </main>
  </div>;

  return <div className="dashboard">
    <Header tab={tab} navigate={navigate} account={data.account} accounts={data.accounts} />
    <main className={'frame main-frame' + (tab === 'jugadores' ? ' players-frame' : '')} id="contenido">
      {tab !== 'jugadores' && data.connectionError && <p className="notice warning" role="alert"><TriangleAlert size={18} />El registro de la cuenta no está disponible. <a href="">Volver a cargar</a></p>}
      {tab !== 'jugadores' && !data.account && !data.connectionError && <p className="notice"><Database size={18} />Registra tu cuenta desde el chat de Ikariam para cargar tus ciudades y guardar planes.</p>}
      {tab === 'resumen' && <Overview data={data} horizon={horizon} setHorizon={setHorizon} center={center} navigate={navigate} onCity={openCity}
        onSelect={(point) => openMap(point[0], point[1])} openPlan={openPlan} />}
      {tab === 'atlas' && <AtlasView own={data.account?.data.server_settings?.server_code === 's74-es' ? data.ownIslands : []}
        center={center} initial={mapFocus} onRecord={openRecord} onSelect={(point) => setMapFocus({ x: point[0], y: point[1] })}
        onPlan={(point) => { setTarget(point); openPlan('expand'); }} />}
      {tab === 'ciudades' && <CitiesView cities={data.cities} references={data.references} own={data.ownIslands} cityId={cityId} setCity={setCityId}
        onPlan={(id, key) => openPlan('build', id, key)} onMap={openMap} onRecord={openRecord}
        hasIntendance={data.entries.some((entry) => entry.record_id === 'intendencia-104849-20261121-200437')}
        hasSanctuary={data.entries.some((entry) => entry.record_id === 'santuario-104851-20261121-195601')} />}
      {tab === 'jugadores' && <OtherPlayers worldPoints={data.nearby} selectedName={playerName} selectName={setPlayerName} />}
      {tab === 'combate' && <Combat units={combatUnits as CombatCatalog} examples={combatExamples as unknown as CombatExample[]} />}
      {tab === 'planes' && <Planner data={data} module={module} setModule={(next) => { setModule(next); setBuilding(undefined); }}
        cityId={cityId} setCity={(id) => { setCityId(id); setBuilding(undefined); }}
        horizon={horizon} setHorizon={setHorizon} target={target} building={building} save={save} onMap={() => openMap()} />}
      {tab === 'registro' && <Registry data={data} knowledge={knowledge} selected={record} select={setRecord} />}
    </main>
    <footer className="frame footer"><span>Ikariam · Cuartel de mando</span>
      <span>Capturas e inventarios registrados. Mapa de IkaDatos.</span>
      {data.workbookUrl && <External href={data.workbookUrl}>Abrir inventario</External>}
    </footer>
  </div>;
}
