// Tests the pure functions of sheets/AtlasImporter.gs by loading the script into a Node VM context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../sheets/AtlasImporter.gs', import.meta.url), 'utf8'), ctx);
const env = JSON.parse(readFileSync(new URL('./fixtures/spymaster.reports.v1.example.json', import.meta.url), 'utf8'));

// Same layout as the real "Farmeos" sheet: blank row 1, header in row 2 from column B, one manual row.
const HEADER = ['', 'Ubicación', 'Recurso Isla', 'Ciudad', 'Jugador', 'Alianza', 'Madera', 'Vino', 'Marmol', 'Cristal', 'Azufre', 'Depósito ', 'Seguro', 'Muralla', 'FECHA INTEL', 'FECHA DE SAQUEO', 'Observaciones', 'Ejército', 'Espiado por'];
const grid = () => [
  Array(19).fill(''),
  HEADER,
  ['', '(20:21)', 'Azufre', 'Farmtown', 'Sleeper', '', 1, 1, 1, 1, 1, 11, 5380, 1, '02/01/2026', 'hoy', 'keep me', '', 'Friend'],
];

test('history rows: one per report, de-duplicated, lootable above safe', () => {
  const seen = { 5001: true };
  const rows = ctx.historyRows_(env, 'f.json', seen);
  assert.equal(rows.length, 3);
  const r = rows.find(x => x[0] === '5002');
  // lootable = (143442-5380) + 0 + (19500-5380) + (13333-5380) + (143442-5380)
  assert.equal(r[17], 138062 + 14120 + 7953 + 138062);
  assert.equal(r[18], Math.ceil((138062 + 14120 + 7953 + 138062) / 500));
  assert.equal(r[4], 'Azufre');
});

test('targets: existing row updated in place, manual columns untouched, new target appended', () => {
  const plan = ctx.planTargets_(env, grid());
  assert.equal(plan.headerRow, 1);
  assert.equal(plan.updates.length, 1);
  const u = plan.updates[0];
  assert.equal(u.row, 2);
  const col = n => plan.cols[n];
  assert.equal(u.cells[col('madera')], 143442);
  assert.equal(u.cells[col('espiado por')], 'Scout');
  assert.match(u.cells[col('ejercito')], /^Hoplita 10 \(\d\d\/01\)$/);
  assert.equal(u.cells[col('fecha de saqueo')], undefined);
  assert.equal(u.cells[col('observaciones')], undefined);
  assert.equal(plan.appends.length, 1);
  const a = plan.appends[0];
  assert.equal(a.length, 19);
  assert.equal(a[col('ciudad')], 'Newfarm');
  assert.equal(a[col('seguro')], 815);
  assert.equal(a[col('recurso isla')], 'Mármol');
});

test('targets: older intel does not overwrite newer sheet data', () => {
  const g = grid(); g[2][14] = '05/01/2026';
  const plan = ctx.planTargets_(env, g);
  const u = plan.updates.find(x => x.row === 2);
  assert.equal(u.cells[plan.cols['madera']], undefined);
});
