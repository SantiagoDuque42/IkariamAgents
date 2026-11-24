// Convert a Mayor v0.1 snapshot ({type:"ikariam-snapshot", version:1, ...}) into a mayor.snapshot.v1 envelope.
// Usage: node mayor/normalize.mjs <in.json> [out.json]   (prints to stdout without out.json)
import { readFileSync, writeFileSync } from 'node:fs';

export function fromLegacy(s) {
  if (!s || s.type !== 'ikariam-snapshot') throw new Error('Not a v0.1 Mayor snapshot (type ikariam-snapshot)');
  const { type, version, takenAt, server, cities, islands, ...rest } = s;
  const isl = {};
  for (const [id, i] of Object.entries(islands || {})) {
    const { lux, ...o } = i; isl[id] = { ...o, tradegood: lux ?? i.tradegood ?? null };
  }
  return {
    schema: 'mayor.snapshot.v1',
    producedAt: takenAt,
    producer: `mayor@0.${version}.0`,
    server: String(server || '').split('.')[0],
    player: null,
    scope: { towns: cities.length, convertedFrom: 'ikariam-snapshot v' + version },
    payload: { cities, islands: isl, ...rest },
  };
}

export function fileName(env) {
  const d = new Date(env.producedAt); const p = n => String(n).padStart(2, '0');
  const st = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z`;
  return `mayor.snapshot_${env.server}_${st}.json`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inp, out] = process.argv;
  if (!inp) { console.error('usage: node mayor/normalize.mjs <in.json> [out.json]'); process.exit(1); }
  const env = fromLegacy(JSON.parse(readFileSync(inp, 'utf8')));
  const text = JSON.stringify(env, null, 1);
  if (out) { writeFileSync(out, text); console.error(`wrote ${out} (suggested store name: ${fileName(env)})`); } else process.stdout.write(text + '\n');
}
