// scripts/recover-catalog.mjs — recover catalog/playlists JSON from .next build chunks.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.js') && !e.endsWith('.js.map')) out.push(p);
  }
  return out;
}

// Find `JSON.parse(` then read the full JS string literal char-by-char (escape-aware).
function extractJson(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const marker = 'JSON.parse(';
  const m = raw.indexOf(marker);
  if (m < 0) return null;
  let i = m + marker.length;
  const quote = raw[i];
  if (quote !== '"' && quote !== "'") return null;
  i++;
  let lit = '';
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\') { lit += ch + raw[i + 1]; i += 2; continue; }
    if (ch === quote) break;
    lit += ch;
    i++;
  }
  // lit is the inner JS string-literal body; turn it into real text, then parse JSON.
  const text = JSON.parse(`${quote === "'" ? '"' : quote}${quote === "'" ? lit.replace(/"/g, '\\"') : lit}${quote === "'" ? '"' : quote}`);
  return JSON.parse(text);
}

const files = walk(resolve('.next'));
let bestCat = null, bestPl = null;
for (const f of files) {
  try {
    if (f.includes('lib_expanded-catalog_json')) {
      const j = extractJson(f);
      if (Array.isArray(j) && (!bestCat || j.length > bestCat.length)) bestCat = j;
    } else if (f.includes('lib_expanded-playlists_json')) {
      const j = extractJson(f);
      if (j && !Array.isArray(j) && (!bestPl || Object.keys(j).length > Object.keys(bestPl).length)) bestPl = j;
    }
  } catch (e) { /* skip bad chunk */ }
}

if (!bestCat || !bestPl) { console.error('recovery failed', { cat: bestCat?.length, pl: bestPl && Object.keys(bestPl).length }); process.exit(1); }
console.log('recovered catalog:', bestCat.length, '| playlists:', Object.keys(bestPl).length);

const keep = bestCat.filter((c) => bestPl[c.key]?.length > 0);
const keys = new Set(keep.map((c) => c.key));
const pl = {};
for (const k of Object.keys(bestPl)) if (keys.has(k)) pl[k] = bestPl[k];

writeFileSync(resolve('lib', 'expanded-catalog.json'), `${JSON.stringify(keep, null, 2)}\n`, 'utf8');
writeFileSync(resolve('lib', 'expanded-playlists.json'), `${JSON.stringify(pl, null, 2)}\n`, 'utf8');
console.log('restored catalog:', keep.length, '| playlists:', Object.keys(pl).length);
