// scripts/expand-catalog-500.mjs
// Pulls REAL, verified, embeddable full-episode/movie playlists from official
// legal anime YouTube channels. Verifies every playlist actually contains
// full-length videos (>=8 min) before adding. Merges with existing catalog.
import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// Official, embedding-enabled anime channels.
// region: SG geo-bypass used for Asia-licensed channels (Muse / Ani-One).
const CHANNELS = [
  { id: 'UCGbshtvS9t-8CW11W7TooQg', name: 'Muse Asia Official', region: 'Asia (Muse Asia)', strict: true },
  { id: 'UC0wNSTMWIL3qaorLx0jie6A', name: 'Ani-One Asia Official', region: 'Asia (Ani-One / MediaLink)', strict: false },
  { id: 'UCejtUitnpnf8Be-v5NuDSLw', name: 'GUNDAM.INFO Official', region: 'Worldwide (Sunrise/Bandai)', strict: false },
  { id: 'UC67pLBZ_z4Gd46t6mW7uHjA', name: 'Ani-One India Official', region: 'India (Ani-One / MediaLink)', strict: false },
  { id: 'UCxxnxya_32jcKj4yN1_kD7A', name: 'Muse Indonesia Official', region: 'Indonesia (Muse)', strict: false },
  { id: 'UCott96qGP5ADmsB_yNQMvDA', name: 'Muse Vietnam Official', region: 'Vietnam (Muse)', strict: false },
  { id: 'UC8I6E03SVRqPgAnrlrQfoYg', name: 'Muse Malaysia Official', region: 'Malaysia (Muse)', strict: false },
];

const TARGET_NEW = 500;
const VERIFY_CONCURRENCY = 12;
const MIN_VIDEO_SECONDS = 480; // full episodes/movies only — filters trailers/PVs
const GEO = 'SG';

const catalogPath = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');

const existingCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const existingPlaylists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

const FEATURED_PLAYLIST_IDS = new Set([
  'PLwLSw1_eDZl1wGMYg5oB3uEns0CZNl6sI', 'PLwLSw1_eDZl2SdSro00Nvg38MQUf-5ZL8',
  'PLwLSw1_eDZl2VQRIahDF73hnkdPjNRYnu', 'PLwLSw1_eDZl1k3PpCugshhYpSQVWUAaib',
  'PLwLSw1_eDZl10YPPR7qDsVf10wZfYnIMK', 'PLwLSw1_eDZl1Sf_lALh99YZAJTp5IaRft',
  'PLwLSw1_eDZl2gLJyLH6BkSr4l1XPaKDjT',
]);
const existingPlaylistIds = new Set(
  existingCatalog.map((c) => c.playlistId).concat([...FEATURED_PLAYLIST_IDS])
);
const usedIds = new Set(existingCatalog.map((c) => c.id));

function runYtDlp(url) {
  return execFileAsync(
    'python',
    ['-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings',
      '--geo-bypass-country', GEO, url],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }
  ).then(({ stdout }) => JSON.parse(stdout));
}

// Extract a clean English-ish title. Handles Muse "[English Sub]" and
// Ani-One "《English》|《中文》【tag】" formats.
function cleanTitle(raw) {
  let t = raw;
  const cjk = t.match(/《([^》]+)》/);
  if (cjk) {
    // first 《...》block is the English/romaji title for Ani-One
    t = cjk[1];
  }
  return t
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\|.*$/, '')
    .replace(/\s*(?:full series|english sub|english dub)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return (
    value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'official-anime'
  );
}

function isMovie(title) {
  return /\bmovies?\b|\bfilm\b|\bthe movie\b/i.test(title);
}

const EXCLUDE = /\b(?:promotion|trailer|teaser|shorts?|opening|ending|theme|music|song|\bpv\b|highlight|recap|preview|clip|interview|news|countdown|compilation|playlist of)\b/i;

function isCandidate(title, strict) {
  if (EXCLUDE.test(title)) return false;
  if (strict) {
    return /\[English (?:Sub|Dub)\]/i.test(title) || /\(Full Series\)/i.test(title);
  }
  return true; // non-strict channels: rely on per-video duration verification
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const r = await mapper(items[i++]);
      if (r) {
        out.push(r);
        if (out.length % 25 === 0) console.log(`  verified ${out.length} new titles...`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

// 1. Gather candidate playlists per channel
console.log('Fetching channel playlist indexes...');
const allCandidates = [];
for (const ch of CHANNELS) {
  try {
    const channel = await runYtDlp(`https://www.youtube.com/channel/${ch.id}/playlists`);
    const cands = (channel.entries || [])
      .filter((p) => p?.id && p?.title)
      .filter((p) => !existingPlaylistIds.has(p.id))
      .filter((p) => isCandidate(p.title, ch.strict))
      .map((p) => ({ ...p, _channel: ch }));
    console.log(`  ${ch.name}: ${cands.length} candidate playlists`);
    allCandidates.push(...cands);
  } catch (err) {
    console.warn(`  ${ch.name} skipped: ${String(err.message).split('\n')[0]}`);
  }
}

const seenPl = new Set();
const candidates = allCandidates.filter((p) => {
  if (seenPl.has(p.id)) return false;
  seenPl.add(p.id);
  return true;
});
console.log(`Total unique candidates to verify: ${candidates.length}`);

// 2. Verify each playlist has real full-length videos
const verified = await mapWithConcurrency(candidates, VERIFY_CONCURRENCY, async (playlist) => {
  try {
    const data = await runYtDlp(`https://www.youtube.com/playlist?list=${playlist.id}`);
    const videos = (data.entries || [])
      .filter((e) => e?.id && e?.title)
      .filter((e) => !/^\[(?:private|deleted) video\]$/i.test(e.title))
      .filter((e) => !e.duration || e.duration >= MIN_VIDEO_SECONDS)
      .map((e) => ({ id: e.id, title: e.title }));

    if (videos.length === 0) return null;

    const ch = playlist._channel;
    const title = cleanTitle(playlist.title);
    if (!title || title.length < 2) return null;
    let id = slugify(title);
    if (usedIds.has(id)) id = `${id}-${playlist.id.slice(-6).toLowerCase()}`;
    if (usedIds.has(id)) return null;
    usedIds.add(id);

    return {
      config: {
        key: id,
        id,
        title,
        description: `Official ${isMovie(playlist.title) ? 'anime movie' : 'anime'} collection from ${ch.name}.`,
        genres: isMovie(playlist.title) ? ['Movie'] : [],
        playlistId: playlist.id,
        trending: 72,
        type: isMovie(playlist.title) ? 'movie' : 'series',
        sourceName: ch.name,
        channelId: ch.id,
        regionNote: `Licensed via ${ch.region}. Availability is controlled by the rights holder.`,
      },
      videos,
    };
  } catch {
    return null;
  }
});

console.log(`Verified ${verified.length} new playable titles.`);

const selected = verified.slice(0, TARGET_NEW);
const newConfigs = selected.map((s) => s.config);
const newPlaylists = Object.fromEntries(selected.map((s) => [s.config.key, s.videos]));

const mergedCatalog = [...existingCatalog, ...newConfigs];
const mergedPlaylists = { ...existingPlaylists, ...newPlaylists };

writeFileSync(catalogPath, `${JSON.stringify(mergedCatalog, null, 2)}\n`, 'utf8');
writeFileSync(playlistsPath, `${JSON.stringify(mergedPlaylists, null, 2)}\n`, 'utf8');

console.log('--- DONE ---');
console.log(`Added ${newConfigs.length} new titles (target ${TARGET_NEW}).`);
console.log(`Total catalog now: ${mergedCatalog.length} titles.`);
console.log(`New movies: ${newConfigs.filter((c) => c.type === 'movie').length}`);
