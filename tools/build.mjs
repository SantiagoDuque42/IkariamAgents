// Build the bookmarklets: inline shared/ikariam.js at the `/*@shared*/` marker, then write
//   dist/<name>.js               readable build (what runs)
//   dist/<name>.bookmarklet.txt  `javascript:` URL to paste as a bookmark's address
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const shared = readFileSync(root + 'shared/ikariam.js', 'utf8')
  .replace(/^export\s+(?=(const|function|async function|let)\b)/gm, '');
const targets = {
  mayor: 'mayor/mayor.bookmarklet.js',
  spymaster: 'spymaster/spymaster.bookmarklet.js',
  cartographer: 'cartographer/cartographer.bookmarklet.js',
  ikadatos: 'cartographer/ikadatos.bookmarklet.js',
};
mkdirSync(root + 'dist', { recursive: true });
for (const [name, path] of Object.entries(targets)) {
  const src = readFileSync(root + path, 'utf8');
  if (!src.includes('/*@shared*/')) throw new Error(`${path}: missing /*@shared*/ marker`);
  const js = src.replace('/*@shared*/', () => shared);
  const out = `${root}dist/${name}.js`;
  writeFileSync(out, js);
  execFileSync(process.execPath, ['--check', out]); // syntax check
  writeFileSync(`${root}dist/${name}.bookmarklet.txt`, 'javascript:' + encodeURIComponent(js));
  console.log(`built dist/${name}.js (${js.length} chars)`);
}
