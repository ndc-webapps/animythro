import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const catPath = resolve('lib', 'expanded-catalog.json');
const plPath = resolve('lib', 'expanded-playlists.json');
const cat = JSON.parse(readFileSync(catPath, 'utf8'));
const pl = JSON.parse(readFileSync(plPath, 'utf8'));

// Age-restricted (dead embeds) + non-anime VIZ junk titles
const removeTitles = new Set([
  'Naruto',
  'BLEACH: Thousand-Year Blood War',
  "Mangaka Mania '21",
  'Got Manga Summer Reading Book Club',
  'VIZ Question Quest',
  'VIZ Plays',
  'Unboxings',
  'Creators, Voice Actors, and more!',
  'VIZ @ Conventions',
  'SHONEN JUMP',
]);

const before = cat.length;
const keep = cat.filter(
  (c) => !(/VIZ/i.test(c.sourceName || '') && removeTitles.has(c.title.trim()))
);
const keys = new Set(keep.map((c) => c.key));
const newPl = {};
for (const k of Object.keys(pl)) if (keys.has(k)) newPl[k] = pl[k];

writeFileSync(catPath, `${JSON.stringify(keep, null, 2)}\n`, 'utf8');
writeFileSync(plPath, `${JSON.stringify(newPl, null, 2)}\n`, 'utf8');

console.log('removed:', before - keep.length, '| catalog now:', keep.length);
console.log('remaining VIZ anime:', keep.filter((c) => /VIZ/i.test(c.sourceName || '')).map((c) => c.title).join(', '));
