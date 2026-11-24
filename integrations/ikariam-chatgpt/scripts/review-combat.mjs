import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewCombatReports } from '../lib/icariam/combat-validation.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/review-combat.mjs /path/to/private-reports.json');
const catalogBytes = readFileSync(new URL('../data/combat-units.json', import.meta.url));
const catalog = JSON.parse(catalogBytes);
const catalogSha256 = createHash('sha256').update(catalogBytes).digest('hex');
const cases = JSON.parse(readFileSync(file, 'utf8'));
for (const item of cases) {
  if (item.provenance?.catalogSha256 !== catalogSha256) throw new Error('catalog_revision_mismatch');
  item.scenario = { ...item.scenario, units: catalog[item.scenario?.mode] };
}
process.stdout.write(JSON.stringify(reviewCombatReports(cases), null, 2) + '\n');
