// scripts/clean-members-only.mjs
// Re-verifies every non-Muse catalog entry with the CORRECT geo per channel,
// removes members-only / private / premium videos, drops entries left empty,
// and fixes any CJK-only titles. Muse entries (already clean) are kept as-is.
import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const MIN_SECS = 480;
const CONCURRENCY = 10;
const BLOCKED = new Set(['subscriber_only', 'premium_only', 'needs_auth', 'needs_subscription', 'private']);

// Western channels need US geo; everything else SG.
const US_CHANNELS = new Set([
  'UCV1da9peoqEwqr45bpTJsbQ', // VIZ
  'UCzGf0DdUJVrsbcWL3e_tK1Q', // TMS
  'UCQYYekTKCb1y12sas08T6gQ', // Toei
  'UCsj_CYajUSQ2ca8bYCMan9g', // REMOW
  'UCejtUitnpnf8Be-v5NuDSLw', // GundamInfo
]);

const catalogPath = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const playlists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

const isMuse = (c) => !c.sourceName || /Muse/i.test(c.sourceName);

function geoFor(cfg) {
  return US_CHANNELS.has(cfg.channelId) ? 'US' : 'SG';
}

function run(url, geo) {
  return execFileAsync('python', [
    '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings',
    '--geo-bypass-country', geo, url,
  ], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }).then(({ stdout }) => JSON.parse(stdout));
}

function cleanup(s) {
  return String(s)
    .replace(/【[^】]*】/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/（[^）]*）/g, ' ')
    .replace(/[｜|].*$/, ' ').replace(/\bULTRA\b/gi, ' ')
    .replace(/[　-鿿가-힯぀-ヿ]/g, ' ').replace(/《|》/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function pickTitle(plTitle, vids) {
  let best = '';
  for (const c of [plTitle, ...vids]) {
    for (const m of String(c).matchAll(/《([^》]+)》/g)) {
      if (/[A-Za-z]/.test(m[1]) && m[1].length > best.length) best = m[1];
    }
  }
  if (best) return cleanup(best);
  const p = cleanup(plTitle);
  if (/[A-Za-z0-9]/.test(p)) return p;
  for (const v of vids) { const s = cleanup(v); if (/[A-Za-z0-9]/.test(s)) return s; }
  return '';
}
function slugify(v) {
  return (v || '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || '';
}

async function pool(items, concurrency, fn) {
  const out = []; let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      if (++done % 40 === 0) console.log(`  processed ${done}/${items.length}...`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

const muse = catalog.filter(isMuse);
const toCheck = catalog.filter((c) => !isMuse(c));
console.log(`Muse kept as-is: ${muse.length}`);
console.log(`Non-Muse to re-verify: ${toCheck.length}`);

const usedIds = new Set(muse.map((c) => c.id));
let removedVideos = 0, removedEntries = 0, retitled = 0;

const repaired = await pool(toCheck, CONCURRENCY, async (cfg) => {
  let data;
  try {
    data = await run(`https://www.youtube.com/playlist?list=${cfg.playlistId}`, geoFor(cfg));
  } catch {
    // On fetch failure keep the existing data (don't lose a good entry on a network blip)
    return { config: cfg, videos: playlists[cfg.key] ?? [] };
  }
  const entries = data.entries || [];
  const before = entries.length;
  const free = entries
    .filter((e) => e?.id && e?.title)
    .filter((e) => !e.availability || !BLOCKED.has(e.availability))
    .filter((e) => !/^\[(?:private|deleted|members) video\]$/i.test(e.title))
    .filter((e) => !e.duration || e.duration >= MIN_SECS);

  removedVideos += Math.max(0, before - free.length);
  if (free.length === 0) { removedEntries++; return null; }

  const newTitle = pickTitle(data.title ?? cfg.title, free.map((e) => e.title));
  if (!newTitle) { removedEntries++; return null; }

  let id = slugify(newTitle);
  if (!id) { removedEntries++; return null; }
  if (usedIds.has(id) && id !== cfg.id) id = `${id}-${cfg.playlistId.slice(-6).toLowerCase()}`;
  if (usedIds.has(id) && id !== cfg.id) return null;
  usedIds.add(id);
  if (newTitle !== cfg.title) retitled++;

  return {
    config: { ...cfg, key: id, id, title: newTitle },
    videos: free.map((e) => ({ id: e.id, title: e.title })),
  };
});

const kept = repaired.filter(Boolean);
const newCatalog = [...muse, ...kept.map((k) => k.config)];
const newPl = {};
for (const c of muse) newPl[c.key] = playlists[c.key] ?? [];
for (const k of kept) newPl[k.config.key] = k.videos;

writeFileSync(catalogPath, `${JSON.stringify(newCatalog, null, 2)}\n`, 'utf8');
writeFileSync(playlistsPath, `${JSON.stringify(newPl, null, 2)}\n`, 'utf8');

console.log('\n--- CLEAN DONE ---');
console.log(`Members-only/blocked videos removed: ${removedVideos}`);
console.log(`Entries removed (no free videos): ${removedEntries}`);
console.log(`Entries retitled: ${retitled}`);
console.log(`Total catalog now: ${newCatalog.length} titles`);
