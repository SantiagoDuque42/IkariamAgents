export type CombatMode = 'land' | 'naval';
type UnitCounts = Record<string, number>;
type Weapon = {
  damage?: number | null;
  armor?: number | null;
  accuracy?: number | null;
  ammo?: number | null;
};
export interface BattleUnit extends Weapon {
  id: string;
  name: string;
  role: string;
  hp: number | null;
  size: number | null;
  faction?: string;
  estimated?: boolean;
  estimate?: boolean;
  weapons?: Weapon[] | Record<string, Weapon>;
}
type Upgrade = { weapon?: number; defense?: number };
type Army = Upgrade & { army: UnitCounts; forge?: number; upgrades?: Record<string, Upgrade> };
export interface CombatInput {
  mode: CombatMode;
  units: BattleUnit[];
  sides: Army[];
  fieldLevel?: number;
  wallLevel?: number;
  wallStats?: { hp?: number; armor?: number; damage?: number };
  maxRounds?: number;
  seed?: number;
}
type Battlefield = { tier: number; level: number; label: string; lanes: Record<string, { slots: number; capacity: number }> };
type SideSummary = { morale: number; remaining: UnitCounts; losses: UnitCounts; ammo: UnitCounts; formations?: Record<string, UnitCounts> };
export interface BattleResult {
  modelVersion: string;
  assumptions: string[];
  winner: 'attack' | 'defense' | 'draw';
  reason: string;
  mode: CombatMode;
  field: Battlefield;
  garrisonLimit: number;
  seed: number;
  roundMinutes: number;
  rounds: { number: number; fieldTier: number; openField: boolean; wallRemaining: number; sides: [SideSummary, SideSummary] }[];
  sides: [SideSummary, SideSummary];
  warnings: string[];
  excluded: [UnitCounts, UnitCounts];
  sources: string[];
  model: string;
}
export function battlefield(mode: CombatMode, fieldLevel?: number): Battlefield;
export function garrisonLimit(mode: CombatMode, fieldLevel?: number, wallLevel?: number): number;
export function simulateCombat(input: CombatInput): BattleResult;
export const COMBAT_MODEL_VERSION: string;
export const COMBAT_ASSUMPTIONS: string[];
