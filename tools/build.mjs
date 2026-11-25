// Build the bookmarklets: inline shared/ikariam.js at the `/*@shared*/` marker, then write
//   dist/<name>.js               readable build (what runs)
//   dist/<name>.bookmarklet.txt  `javascript:` URL to paste as a bookmark's address
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(root + 'package.json', 'utf8'));
// Short loader bookmarks: some browsers refuse very long bookmark addresses. The loader pulls the
// built file for this release tag (v<version>) from jsDelivr's GitHub mirror and pins it with
// Subresource Integrity, so the browser runs it only if it is byte-identical to this build.
const CDN = `https://cdn.jsdelivr.net/gh/SantiagoDuque42/IkariamAgents@v${version}/dist/`;
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
  const sri = 'sha384-' + createHash('sha384').update(js, 'utf8').digest('base64');
  writeFileSync(`${root}dist/${name}.loader.txt`, 'javascript:' + encodeURIComponent(`(()=>{const s=document.createElement('script');s.src='${CDN}${name}.js';s.integrity='${sri}';s.crossOrigin='anonymous';s.onerror=()=>alert('Could not load the ${name} tool (blocked or offline). Use the console method in the README.');document.head.appendChild(s)})()`));
  console.log(`built dist/${name}.js (${js.length} chars)`);
}
