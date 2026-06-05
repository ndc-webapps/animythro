// scripts/scan-embeddability.mjs
// Uses the YouTube Data API to remove videos that can NEVER embed for anyone:
//   • age-restricted (contentRating.ytRating === 'ytAgeRestricted')  ← Naruto problem
//   • status.embeddable === false
//   • private / deleted (not returned by the API at all)
// Region-locked videos are KEPT (they still work for users in the licensed region)
// but counted, since we cannot proxy/VPN them (see notes in chat).
//
// Reads YOUTUBE_API_KEY from .env.local
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Load API key from .env.local ───────────────────────────────────────────
const env = readFileSync(resolve('.env.local'), 'utf8');
const API_KEY = (env.match(/^YOUTUBE_API_KEY=(.+)$/m)?.[1] ?? '').trim();
if (!API_KEY || API_KEY === 'your_youtube_api_key') {
  console.error('No valid YOUTUBE_API_KEY in .env.local');
  process.exit(1);
}

const catalogPath = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const playlists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

// Collect all unique video IDs
const allIds = new Set();
for (const vids of Object.values(playlists)) for (const v of vids) allIds.add(v.id);
const ids = [...allIds];
console.log(`Checking ${ids.length} unique videos via YouTube Data API...`);

// ── Batch check (50 IDs per call) ──────────────────────────────────────────
const status = new Map(); // id -> 'ok' | 'age' | 'noembed' | 'gone' | 'geo'
let quota = 0;

for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50);
  const url = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=${batch.join(',')}&maxResults=50&key=${API_KEY}`;
  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  HTTP ${res.status} on batch ${i} — ${(await res.text()).slice(0, 120)}`);
      // mark as ok (don't delete on transient API failure)
      batch.forEach((id) => status.set(id, 'ok'));
      continue;
    }
    data = await res.json();
    quota++;
  } catch (err) {
    console.error(`  fetch error batch ${i}: ${err.message}`);
    batch.forEach((id) => status.set(id, 'ok'));
    continue;
  }

  const returned = new Set();
  for (const item of data.items ?? []) {
    returned.add(item.id);
    const age = item.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted';
    const embeddable = item.status?.embeddable === true;
    const isPublic = item.status?.privacyStatus === 'public';
    const region = item.contentDetails?.regionRestriction;
    if (age) status.set(item.id, 'age');
    else if (!embeddable) status.set(item.id, 'noembed');
    else if (!isPublic) status.set(item.id, 'gone');
    else if (region?.blocked?.length || region?.allowed?.length) status.set(item.id, 'geo');
    else status.set(item.id, 'ok');
  }
  // IDs not returned = deleted/private/terminated
  for (const id of batch) if (!returned.has(id)) status.set(id, 'gone');

  if ((i / 50) % 20 === 0) console.log(`  ...${i + batch.length}/${ids.length}`);
}

// ── Decide which to remove ─────────────────────────────────────────────────
// Remove: age-restricted, non-embeddable, gone. KEEP geo (works in-region).
const REMOVE = new Set(['age', 'noembed', 'gone']);
const counts = { ok: 0, age: 0, noembed: 0, gone: 0, geo: 0 };
for (const s of status.values()) counts[s] = (counts[s] ?? 0) + 1;

let removedVideos = 0;
const newPlaylists = {};
for (const [key, vids] of Object.entries(playlists)) {
  const kept = vids.filter((v) => !REMOVE.has(status.get(v.id) ?? 'ok'));
  removedVideos += vids.length - kept.length;
  if (kept.length > 0) newPlaylists[key] = kept;
}

// Drop catalog entries whose playlist is now empty
const before = catalog.length;
const newCatalog = catalog.filter((c) => newPlaylists[c.key]?.length > 0);
const removedEntries = before - newCatalog.length;
// trim playlists to surviving keys
const keys = new Set(newCatalog.map((c) => c.key));
for (const k of Object.keys(newPlaylists)) if (!keys.has(k)) delete newPlaylists[k];

writeFileSync(catalogPath, `${JSON.stringify(newCatalog, null, 2)}\n`, 'utf8');
writeFileSync(playlistsPath, `${JSON.stringify(newPlaylists, null, 2)}\n`, 'utf8');

console.log('\n--- SCAN DONE ---');
console.log(`API calls (quota units): ${quota}`);
console.log(`Video status: ok=${counts.ok} age=${counts.age} noembed=${counts.noembed} gone=${counts.gone} geo=${counts.geo}`);
console.log(`Removed videos (age/noembed/gone): ${removedVideos}`);
console.log(`Removed empty entries: ${removedEntries}`);
console.log(`Geo-locked videos KEPT (work in-region): ${counts.geo}`);
console.log(`Catalog now: ${newCatalog.length} titles`);
