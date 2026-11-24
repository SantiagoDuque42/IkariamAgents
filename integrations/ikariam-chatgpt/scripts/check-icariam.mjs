import {execFileSync} from 'node:child_process';
import {buildSync} from 'esbuild';
import {mkdirSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(new URL('../outputs/',import.meta.url),{recursive:true});
buildSync({absWorkingDir:root,entryPoints:['lib/icariam/service.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'outputs/service-test.mjs'});
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
execFileSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
