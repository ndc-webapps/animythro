import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const catPath = resolve('lib', 'expanded-catalog.json');
const plPath = resolve('lib', 'expanded-playlists.json');
const cat = JSON.parse(readFileSync(catPath, 'utf8'));
const pl = JSON.parse(readFileSync(plPath, 'utf8'));

// Featured ids (defined in catalog-config.ts) — expanded entries must never reuse them
const FEATURED = new Set([
  'spy-family-trailer', 'hunter-x-hunter', 'fairy-tail', 'shangri-la-frontier',
  'frieren-beyond-journeys-end', 'welcome-to-demon-school-iruma-kun',
  'ragna-crimson', 'spy-family-main-trailer',
]);

const before = cat.length;
const seen = new Set();
const keep = [];
for (const c of cat) {
  if (FEATURED.has(c.id)) continue;       // drop collision with featured
  if (seen.has(c.id)) continue;           // drop internal dupe
  seen.add(c.id);
  keep.push(c);
}
const keys = new Set(keep.map((c) => c.key));
const newPl = {};
for (const k of Object.keys(pl)) if (keys.has(k)) newPl[k] = pl[k];

writeFileSync(catPath, `${JSON.stringify(keep, null, 2)}\n`, 'utf8');
writeFileSync(plPath, `${JSON.stringify(newPl, null, 2)}\n`, 'utf8');
console.log('removed dupes:', before - keep.length, '| catalog now:', keep.length);
