export type Resource = 'wood' | 'wine' | 'marble' | 'crystal' | 'sulfur';
export type MapResource = Exclude<Resource, 'wood'>;
export type Stock = Partial<Record<Resource, number>>;
export type Coordinate = { x: number; y: number };
export type PlanStatus = 'proposed' | 'pending' | 'in_progress' | 'done' | 'cancelled';
export type Account = {
  alias?: string; player_name?: string; world?: string; community?: string; time_zone?: string;
  observed_at?: string; game_version?: string; goals?: string[]; notes?: string;
  server_settings?: Record<string, unknown>; treasury?: number; gold_net_per_hour?: number;
  merchant_ships_available?: number; merchant_capacity?: number;
};
export type City = {
  name?: string; capital?: boolean; island_resource?: MapResource; coordinates?: Coordinate;
  buildings?: Record<string, number>; stocks?: Stock; capacity?: Stock; net_per_hour?: Stock;
  population?: number; satisfaction?: number; corruption_pct?: number;
  observed_at?: string; source?: string; notes?: string; _field_observed_at?: Record<string, string>;
};
export type JournalEntry = {
  title?: string; content?: string; status?: PlanStatus; priority?: string; source?: string;
  observed_at?: string; due_at?: string | null;
};
export type LedgerRecord<T> = {
  record_id: string; kind: string; data: T; revision: number; updated_at: string; account_id: string;
};
export type Building = {
  label: string; level: number; copy?: string | number | null; category?: string;
  effect?: string; nextEffect?: string; operating?: string; investment: Stock; nextCost: Stock; nextHours?: number | null;
};
export type CityReference = {
  name: string; island: string; baseline: { observedAt: string; stocks: Stock };
  wineModel: {
    tavernLevel: number; pressLevel: number; maxBase: number; maxAfterPress: number;
    hourlyBudget: number; pressSavings: number; producerBonus: number; nextPressSavings: number;
  };
  capacity: {
    housing: number; actions: number; culturalGoods: number; museumFixed: number; museumMaximum: number;
    scientists: number; scientistGoldCost: number; priests: number; spies: number; landGarrison: number;
    storage: number; protected: number;
  };
  reductions: Stock; productionBonus: Stock; buildings: Record<string, Building>;
};
export type OwnIsland = Coordinate & {
  name: string; resource: MapResource; cityNames: string[]; sawmill: number | null; deposit: number | null;
  wonder: string | null; wonderLevel: number | null; reportId?: string; observedAt?: string;
};
export type MapPoint = [
  x: number, y: number, resource: MapResource, sawmill: number | null, deposit: number | null,
  wonder: string | null, occupied: number, capacity: number, sac: number, coverage: 0 | 1
];
export type MapCity = { player: string; name: string; level: number | null; alliance?: string | null; status?: string | null };
export type MapIsland = { point: MapPoint; cities: MapCity[] | null; sac: MapCity[]; sourceUrl: string; cityDate?: string };
export type PlayerCity = Coordinate & { name: string; level: number; status: string; position: number };
export type AtlasPlayer = {
  name: string; alliance: string | null; review: 'Corto' | 'Medio' | 'Censo'; status: string;
  points: number; generals: number; offense: number; defense: number; loot: number; rank: number;
  closest: Coordinate; distance: number; maxLevel: number; note: string; rankedOn: string; rankUrl: string;
  cities: PlayerCity[];
};
export type PlayerIsland = Coordinate & {
  name: string | null; base: Coordinate; distance: number; resource: MapResource; sawmill: number | null;
  deposit: number | null; wonder: string | null; occupied: number; free: number; capacity: number;
  ownCities: number; gameLevels: string | null; gameObservedAt: string | null;
  observedAt: string; sourceUrl: string; sacCities: number;
};
export type AtlasPlayers = {
  world: string; server: string; rankedOn: string; observedAt: string; workbookUrl: string; mapUrl: string;
  islands: PlayerIsland[]; players: AtlasPlayer[];
};
export type AtlasSummary = {
  observedAt: string; sourceUrl: string; islands: number; occupied: number; free: number; capacity: number;
  cityLists: number; cities: number; sacCities: number; sacIslands: number; byResource: Record<MapResource, number>;
};
export type DashboardState = {
  account: LedgerRecord<Account> | null; accounts: LedgerRecord<Account>[]; cities: LedgerRecord<City>[];
  entries: LedgerRecord<JournalEntry>[]; atlas: AtlasSummary; nearby: MapPoint[]; ownIslands: OwnIsland[];
  references: Record<string, CityReference>; workbookUrl: string | null; connectionError: boolean;
};
export type KnowledgeInfo = {
  id: string; title: string; summary: string; content: string; reviewed_at: string;
  sources: { id: string; title: string; url: string }[];
};
