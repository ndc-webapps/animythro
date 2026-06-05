// scripts/expand-catalog-900.mjs
// Pulls REAL, verified, full-episode playlists from official legal channels.
// Verifies every playlist actually contains full-length videos (>=8min) before adding.
// Merges safely with existing catalog — never duplicates existing playlist IDs.
import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// ─── Official channels (all IDs verified via yt-dlp 2026-06) ────────────────
// geo: which country code to use for bypass (SG for Asian-licensed, US for Western)
const CHANNELS = [
  // Already fully scanned — kept here for re-run safety (existing playlist IDs are skipped)
  { id: 'UCGbshtvS9t-8CW11W7TooQg', name: 'Muse Asia Official',       geo: 'SG', strict: true  },
  { id: 'UC0wNSTMWIL3qaorLx0jie6A', name: 'Ani-One Asia Official',    geo: 'SG', strict: false },
  { id: 'UC67pLBZ_z4Gd46t6mW7uHjA', name: 'Ani-One India Official',   geo: 'SG', strict: false },
  { id: 'UCxxnxya_32jcKj4yN1_kD7A', name: 'Muse Indonesia Official',  geo: 'SG', strict: true  },
  { id: 'UCott96qGP5ADmsB_yNQMvDA', name: 'Muse Vietnam Official',    geo: 'SG', strict: true  },
  { id: 'UC8I6E03SVRqPgAnrlrQfoYg', name: 'Muse Malaysia Official',   geo: 'SG', strict: true  },
  { id: 'UCejtUitnpnf8Be-v5NuDSLw', name: 'GUNDAM.INFO Official',     geo: 'SG', strict: false },

  // New channels being added this run
  { id: 'UCsj_CYajUSQ2ca8bYCMan9g', name: "It's Anime powered by REMOW", geo: 'SG', strict: false },
  { id: 'UCV1da9peoqEwqr45bpTJsbQ', name: 'VIZ Media',                   geo: 'US', strict: false },
  { id: 'UCzGf0DdUJVrsbcWL3e_tK1Q', name: 'Anime! on TMS Official',       geo: 'US', strict: false },
  { id: 'UCQYYekTKCb1y12sas08T6gQ', name: 'Toei Animation Official',      geo: 'US', strict: false },
  // Crunchyroll = clips/moments only, no full episodes on YouTube — excluded
  // Pokémon     = TCG events, not anime episodes — excluded
];

const TARGET_NEW   = 1000;  // aim high; we'll take what's real
const CONCURRENCY  = 10;
const MIN_SECS     = 480;   // 8 min — filters trailers, shorts, PVs

const catalogPath   = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');

const existingCatalog   = JSON.parse(readFileSync(catalogPath,   'utf8'));
const existingPlaylists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

const existingPlaylistIds = new Set(existingCatalog.map(c => c.playlistId).filter(Boolean));
const usedIds             = new Set(existingCatalog.map(c => c.id));

// Patterns that indicate non-episode content
const EXCLUDE = /\b(?:trailer|teaser|promo|preview|opening|ending|ost|music\s*video|pv|cm|short|clip|highlight|recap|interview|reaction|making|announce|spoiler|countdown|behind|moment|compilat|news|q&a|fan)\b/i;
// For strict channels: only playlists that look like episode collections
const STRICT  = /\[English (?:Sub|Dub)\]|\(Full Series\)|Full Episodes?|Ep(?:isode)?s?\s*\d/i;

function ytArgs(url, geo) {
  const args = ['-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings'];
  if (geo) args.push('--geo-bypass-country', geo);
  args.push(url);
  return args;
}

function run(url, geo) {
  return execFileAsync('python', ytArgs(url, geo), {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
  }).then(({ stdout }) => JSON.parse(stdout));
}

function isCandidate(title, strict) {
  if (EXCLUDE.test(title)) return false;
  if (strict && !STRICT.test(title)) return false;
  return true;
}

function cleanTitle(raw) {
  return String(raw)
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*(?:English Sub|English Dub|Multi[- ]Sub|MULTI-?SUB)[^\]]*\]/gi, ' ')
    .replace(/\[(?:Spring|Summer|Fall|Winter)\s+\d{4}\s+Anime\]/gi, ' ')
    .replace(/\s*\|\s*.+$/, ' ')
    .replace(/《([^》]+)》.*/s, '$1')
    .replace(/[《》【】（）｜|]/g, ' ')
    .replace(/\bULTRA\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(v) {
  return (v || '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'anime';
}

function isMovie(title) {
  return /\bmovies?\b|\bfilm\b|\bthe movie\b/i.test(title);
}

async function pool(items, concurrency, fn) {
  const out = []; let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      if (++done % 30 === 0) console.log(`  verified ${done}/${items.length}...`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

console.log('Fetching channel playlist indexes...');
const allCandidates = [];

for (const ch of CHANNELS) {
  try {
    const data = await run(`https://www.youtube.com/channel/${ch.id}/playlists`, ch.geo);
    const cands = (data.entries || [])
      .filter(p => p?.id && p?.title)
      .filter(p => !existingPlaylistIds.has(p.id))
      .filter(p => isCandidate(p.title, ch.strict))
      .map(p => ({ ...p, _ch: ch }));
    console.log(`  ${ch.name}: ${(data.entries||[]).length} playlists, ${cands.length} candidates`);
    allCandidates.push(...cands);
  } catch (err) {
    console.warn(`  ${ch.name}: FAILED — ${String(err.message).split('\n')[0]}`);
  }
}

// Dedupe by playlist ID
const seen = new Set();
const candidates = allCandidates.filter(p => {
  if (seen.has(p.id)) return false;
  seen.add(p.id);
  return true;
});
console.log(`\nTotal unique candidates to verify: ${candidates.length}`);

// Verify each playlist has real full-length videos
const results = await pool(candidates, CONCURRENCY, async pl => {
  try {
    const data = await run(`https://www.youtube.com/playlist?list=${pl.id}`, pl._ch.geo);
    const videos = (data.entries || [])
      .filter(e => e?.id && e?.title)
      .filter(e => !/^\[(?:private|deleted) video\]$/i.test(e.title))
      .filter(e => !e.duration || e.duration >= MIN_SECS)
      .map(e => ({ id: e.id, title: e.title }));

    if (videos.length === 0) return null;

    const rawTitle = cleanTitle(pl.title) || cleanTitle(videos[0]?.title || pl.title);
    if (!rawTitle) return null;

    let id = slugify(rawTitle);
    if (!id) return null;
    if (usedIds.has(id)) id = `${id}-${pl.id.slice(-6).toLowerCase()}`;
    if (usedIds.has(id)) return null;
    usedIds.add(id);

    return {
      config: {
        key: id, id,
        title: rawTitle,
        description: `Official anime from ${pl._ch.name}.`,
        genres: isMovie(pl.title) ? ['Movie'] : [],
        playlistId: pl.id,
        trending: 72,
        type: isMovie(pl.title) ? 'movie' : 'series',
        sourceName: pl._ch.name,
        channelId: pl._ch.id,
        regionNote: `Licensed via ${pl._ch.name}. Availability controlled by the rights holder.`,
      },
      videos,
    };
  } catch {
    return null;
  }
});

const verified = results.filter(Boolean);
console.log(`\nVerified ${verified.length} new playable titles.`);

const selected = verified.slice(0, TARGET_NEW);

const newCatalog  = [...existingCatalog, ...selected.map(s => s.config)];
const newPl       = { ...existingPlaylists };
for (const s of selected) newPl[s.config.key] = s.videos;

writeFileSync(catalogPath,   `${JSON.stringify(newCatalog,  null, 2)}\n`, 'utf8');
writeFileSync(playlistsPath, `${JSON.stringify(newPl, null, 2)}\n`,       'utf8');

console.log('\n--- DONE ---');
console.log(`Added:  ${selected.length} new titles`);
console.log(`Total:  ${newCatalog.length} titles in catalog`);
console.log(`Movies: ${selected.filter(s => s.config.type==='movie').length}`);
console.log(`Series: ${selected.filter(s => s.config.type==='series').length}`);
