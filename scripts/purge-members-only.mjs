// scripts/purge-members-only.mjs
// Re-checks EVERY catalog playlist and removes members-only / private / deleted /
// premium videos from the snapshots. Drops entries left with 0 playable videos.
// Keeps keys/ids stable (no re-slugging) so nothing else breaks.
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const CONCURRENCY = 10;
const BLOCKED = new Set(['subscriber_only', 'premium_only', 'needs_auth', 'needs_subscription', 'private']);
const BAD_TITLE = /^\[(?:private|deleted|members(?:-only)?|unavailable) video\]$/i;

const catalogPath = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const playlists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

function fetchPlaylist(playlistId) {
  return execFileAsync('python', [
    '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings',
    `https://www.youtube.com/playlist?list=${playlistId}`,
  ], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }).then(({ stdout }) => JSON.parse(stdout));
}

async function pool(items, n, fn) {
  const out = []; let i = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      if (++done % 50 === 0) console.log(`  ${done}/${items.length}...`);
    }
  }));
  return out;
}

let removedVideos = 0, droppedEntries = 0, unchanged = 0;

const results = await pool(catalog, CONCURRENCY, async (cfg) => {
  let data;
  try { data = await fetchPlaylist(cfg.playlistId); }
  catch { return { cfg, videos: playlists[cfg.key] ?? [] }; } // network blip → keep existing
  const entries = (data.entries || []).filter((e) => e?.id && e?.title);
  const free = entries
    .filter((e) => !e.availability || !BLOCKED.has(e.availability))
    .filter((e) => !BAD_TITLE.test(e.title));
  removedVideos += Math.max(0, entries.length - free.length);
  if (free.length === 0) { droppedEntries++; return null; }
  if (free.length === (playlists[cfg.key]?.length ?? -1)) unchanged++;
  return { cfg, videos: free.map((e) => ({ id: e.id, title: e.title })) };
});

const kept = results.filter(Boolean);
const newCatalog = kept.map((k) => k.cfg);
const newPl = {};
for (const k of kept) newPl[k.cfg.key] = k.videos;

writeFileSync(catalogPath, JSON.stringify(newCatalog, null, 2) + '\n', 'utf8');
writeFileSync(playlistsPath, JSON.stringify(newPl, null, 2) + '\n', 'utf8');

console.log('\n--- PURGE DONE ---');
console.log('members-only/blocked videos removed:', removedVideos);
console.log('entries dropped (empty after purge):', droppedEntries);
console.log('catalog now:', newCatalog.length);
