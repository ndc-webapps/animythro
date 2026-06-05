// scripts/remove-talkshows.mjs — removes a CURATED list of confirmed talkshow/non-episode keys.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REMOVE_KEYS = new Set([
  'inuyasha-yashahime', 'seis-manos', 'sailor-moon', 'gunpla-figure', 'witch-hat-atelier',
  'one-punch-man-qcmouh', 'got-manga-summer-reading-book-club', 'naruto-manga',
  'naruto-naruto-shippuden', 'world-trigger', 'unboxings', 'shonen-jump', 'viz-plays',
  'musegaming', 'anime-watch-a-long-with-muse-malaysia', 'viz-conventions', 'yu-gi-oh',
  'the-world-next-door', 'one-piece', 'mabar-musegaming',
]);

const catPath = resolve('lib', 'expanded-catalog.json');
const plPath = resolve('lib', 'expanded-playlists.json');
const cat = JSON.parse(readFileSync(catPath, 'utf8'));
const pl = JSON.parse(readFileSync(plPath, 'utf8'));

const before = cat.length;
const keep = cat.filter((c) => !REMOVE_KEYS.has(c.key));
const keys = new Set(keep.map((c) => c.key));
const newPl = {};
for (const k of Object.keys(pl)) if (keys.has(k)) newPl[k] = pl[k];

writeFileSync(catPath, `${JSON.stringify(keep, null, 2)}\n`, 'utf8');
writeFileSync(plPath, `${JSON.stringify(newPl, null, 2)}\n`, 'utf8');
console.log(`Removed ${before - keep.length} talkshow entries | catalog now: ${keep.length}`);
