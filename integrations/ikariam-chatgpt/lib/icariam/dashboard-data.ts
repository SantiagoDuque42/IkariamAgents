import atlas from '../../data/atlas-map.json';
import inventory from '../../data/atlas-inventory.json';
import knowledge from '../../data/knowledge.json';
import { runTool } from './service';
import type {
  Account, AtlasSummary, City, CityReference, DashboardState, JournalEntry, KnowledgeInfo, LedgerRecord,
  MapIsland, MapPoint, MapResource, OwnIsland,
} from './dashboard-types';

const resourceKeys: Record<string, MapResource> = { Vino: 'wine', Mármol: 'marble', Cristal: 'crystal', Azufre: 'sulfur' };
const mapPoints: MapPoint[] = atlas.islands.flatMap((island) => {
  const resource = island.resource ? resourceKeys[island.resource] : undefined;
  if (!resource || island.occupied == null || island.capacity == null) return [];
  return [[island.x, island.y, resource, island.sawmillLevel, island.resourceLevel, island.wonder,
    island.occupied, island.capacity, island.sacCityCount, island.cities ? 1 : 0]];
});
const mapIndex = new Map(mapPoints.map((point) => [point[0] + ':' + point[1], point]));
const detailsIndex = new Map(atlas.islands.map((island) => [island.x + ':' + island.y, island]));
const byResource = { wine: 0, marble: 0, crystal: 0, sulfur: 0 };
for (const point of mapPoints) byResource[point[2]]++;
const atlasSummary: AtlasSummary = {
  observedAt: atlas.observedAt, sourceUrl: atlas.sourceUrl, islands: mapPoints.length,
  occupied: mapPoints.reduce((sum, row) => sum + row[6], 0),
  free: mapPoints.reduce((sum, row) => sum + row[7] - row[6], 0),
  capacity: mapPoints.reduce((sum, row) => sum + row[7], 0),
  cityLists: atlas.islands.filter((row) => row.cities != null).length,
  cities: atlas.islands.reduce((sum, row) => sum + (row.cities?.length ?? 0), 0),
  sacCities: mapPoints.reduce((sum, row) => sum + row[8], 0),
  sacIslands: mapPoints.filter((row) => row[8] > 0).length,
  byResource,
};

export function atlasPoints() { return { points: mapPoints, summary: atlasSummary }; }

export function atlasIsland(x: number, y: number): MapIsland | undefined {
  const key = x + ':' + y;
  const point = mapIndex.get(key);
  const detail = detailsIndex.get(key);
  if (!point || !detail) return undefined;
  return { point, cities: detail.cities ?? null, sac: detail.sacCities ?? [],
    sourceUrl: detail.detailUrl || atlas.sourceUrl, cityDate: detail.citiesObservedAt ?? undefined };
}

export function knowledgeForDashboard(): KnowledgeInfo[] {
  return knowledge.modules.map((module) => ({
    id: module.id, title: module.title, summary: module.summary, content: module.content,
    reviewed_at: module.reviewed_at,
    sources: knowledge.sources.filter((source) => module.source_ids.includes(source.id)),
  }));
}

function ownIslands(cities: LedgerRecord<City>[], entries: LedgerRecord<JournalEntry>[],
  references: DashboardState['references']): OwnIsland[] {
  const islands = new Map<string, OwnIsland>();
  for (const city of cities) {
    const { coordinates, island_resource: resource } = city.data;
    if (!coordinates || !resource) continue;
    const key = coordinates.x + ':' + coordinates.y;
    let island = islands.get(key);
    if (!island) {
      const record = entries.find((entry) => entry.kind === 'report' && entry.record_id === 'isla-' + coordinates.x + '-' + coordinates.y);
      const content = record?.data.content ?? '';
      const wonderMatch = content.match(/^- Maravilla: (.+?), nivel (\d+)/m);
      const name = record?.data.title?.match(/^Isla (.+?) \[/)?.[1];
      const level = (pattern: RegExp) => {
        const value = content.match(pattern)?.[1];
        return value ? Number(value) : null;
      };
      island = {
        ...coordinates, resource, name: name ?? references[city.record_id]?.island ?? key, cityNames: [],
        sawmill: level(/Bosque: nivel (\d+)/i),
        deposit: level(/(?:Cantera|Vid|Mina de azufre|Mina de cristal|Viñedo): nivel (\d+)/i),
        wonder: wonderMatch?.[1] ?? null, wonderLevel: wonderMatch?.[2] ? Number(wonderMatch[2]) : null,
        observedAt: record?.data.observed_at, reportId: record?.record_id,
      };
      islands.set(key, island);
    }
    island.cityNames.push(city.data.name ?? city.record_id);
  }
  return [...islands.values()];
}

export async function loadDashboard(userId: string | null, db: D1Database | undefined, requestedId?: string): Promise<DashboardState> {
  const state: DashboardState = {
    account: null, accounts: [], cities: [], entries: [], atlas: atlasSummary,
    nearby: [], ownIslands: [], references: {}, workbookUrl: null, connectionError: false,
  };
  if (!userId) return state;
  try {
    const accountResponse = await runTool('list_accounts', {}, userId, db) as { accounts: LedgerRecord<Account>[] };
    state.accounts = accountResponse.accounts;
    const account = state.accounts.find((row) => row.record_id === requestedId)
      ?? [...state.accounts].sort((a, b) => Number(b.data.server_settings?.server_code === 's74-es') - Number(a.data.server_settings?.server_code === 's74-es'))[0];
    if (!account) return state;
    const response = await runTool('get_account', { account_id: account.record_id }, userId, db) as { records: LedgerRecord<unknown>[] };
    state.account = response.records.find((record) => record.kind === 'account') as LedgerRecord<Account> ?? account;
    state.cities = (response.records.filter((record) => record.kind === 'city') as LedgerRecord<City>[])
      .sort((a, b) => Number(Boolean(b.data.capital)) - Number(Boolean(a.data.capital)) || (a.data.name ?? '').localeCompare(b.data.name ?? '', 'es'));
    state.entries = response.records.filter((record) => !['city', 'account'].includes(record.kind)) as LedgerRecord<JournalEntry>[];
    state.references = state.account.record_id === inventory.accountId ? inventory.cities as Record<string, CityReference> : {};
    state.ownIslands = ownIslands(state.cities, state.entries, state.references);
    state.workbookUrl = state.entries.find((entry) => entry.record_id === 'inventario-excel')?.data.content
      ?.match(/https:\/\/chatgpt\.com\/library\?file_id=[a-zA-Z0-9_-]+(?:&account_id=personal)?/)?.[0] ?? null;
    if (state.account.data.server_settings?.server_code === 's74-es') {
      const center = state.cities.find((city) => city.data.capital)?.data.coordinates ?? state.ownIslands[0];
      if (center) state.nearby = mapPoints.filter(([x, y]) => Math.abs(x - center.x) <= 9 && Math.abs(y - center.y) <= 9);
    }
    return state;
  } catch (error) {
    console.error('Ikariam dashboard', error instanceof Error ? error.name : 'runtime error');
    return { ...state, connectionError: true };
  }
}
