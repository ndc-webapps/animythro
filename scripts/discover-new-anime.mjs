// scripts/discover-new-anime.mjs
// Pull REAL anime playlists from the approved YouTube channels, dedupe against the
// existing catalog, and append >= TARGET new paired entries to:
//   lib/expanded-catalog.json   (catalog config rows)
//   lib/expanded-playlists.json (real {id,title} video snapshots)
//
// Source of truth for channels: lib/channel-sources.ts (kept in sync here).
// Requires: python -m yt_dlp on PATH.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(HERE, '..', 'lib', 'expanded-catalog.json');
const PLAYLISTS_PATH = resolve(HERE, '..', 'lib', 'expanded-playlists.json');

const TARGET = 115;            // collect a buffer over 100 (some get culled)
const MAX_PLAYLISTS_PER_CHANNEL = 250;
const MIN_VIDEOS = 1;

// Approved channels (mirror of lib/channel-sources.ts OFFICIAL_ANIME_CHANNELS)
const CHANNELS = [
  { id: 'UCGbshtvS9t-8CW11W7TooQg', name: 'Muse Asia Official' },
  { id: 'UC0wNSTMWIL3qaorLx0jie6A', name: 'Ani-One Asia Official' },
  { id: 'UC67pLBZ_z4Gd46t6mW7uHjA', name: 'Ani-One India Official' },
  { id: 'UCxxnxya_32jcKj4yN1_kD7A', name: 'Muse Indonesia Official' },
  { id: 'UCott96qGP5ADmsB_yNQMvDA', name: 'Muse Vietnam Official' },
  { id: 'UC8I6E03SVRqPgAnrlrQfoYg', name: 'Muse Malaysia Official' },
  { id: 'UCejtUitnpnf8Be-v5NuDSLw', name: 'GUNDAM.INFO Official' },
  { id: 'UCpXeZRcuolNPUVqp21TGdYQ', name: "It's Anime (REMOW)" },
  { id: 'UCV1da9peoqEwqr45bpTJsbQ', name: 'VIZ Media' },
  { id: 'UC6pGDc4bFGD1_36IKv3FnYg', name: 'Crunchyroll' },
  { id: 'UCVi2lI40LetxLBKn-rtWC3A', name: 'Crunchyroll Dubs' },
  { id: 'UCzGf0DdUJVrsbcWL3e_tK1Q', name: 'Anime! on TMS Official' },
  { id: 'UCTTv0NxWnJsNzAY3Ivj61zg', name: 'Toei Animation Official' },
  { id: 'UCyDicpSC5W69NOhbJthPSvw', name: 'Animax Asia Official' },
  { id: 'UCY5fcqgSrQItPAX_Z5Frmwg', name: 'KADOKAWAanime Official' },
  { id: 'UCOTnNH2Yh09ocsfv3HsDLaA', name: 'ADN (Anime Digital Network)' },
  { id: 'UCwUeTOXP3DD9DIvHttowuSA', name: 'Selecta Visión Official' },
];

// Drop trailers/promos/clips/reactions/concerts/etc.
// NOTE: avoid bare "live" — it appears in real titles (Date A Live, etc.).
const EXCLUDE = /\b(?:trailer|teaser|promo|preview|highlights?|recap|shorts?|clips?|opening|ending|ost|music\s*video|amv|pv|cm|commercial|announcement|interview|react(?:ing|ion)?|behind|making|unboxing|haul|merch|review|countdown|ranking|news|q&a|spoiler|collab|collaboration|fan|playlist|mix|compilation|vod|watch.?a.?long|watchalong|slaps?|punches?|transformations?|moments?|scenes?|best\s*of|top\s*\d+|vs\.?)\b|live\s*(?:stream|performance|concert|event)|digital\s*live|\bat\s+a\s+time\b/i;

// Featured shows already hard-coded in lib/catalog-config.ts — never re-add them.
const FEATURED_TITLES = [
  'SPY x FAMILY', 'HUNTER x HUNTER', 'Fairy Tail', 'Shangri-La Frontier',
  "Frieren: Beyond Journey's End", 'Welcome to Demon School! Iruma-kun', 'Ragna Crimson',
];
const normTitle = (s) => String(s).toLowerCase().replace(/english (sub|dub)/g, '').replace(/[^a-z0-9]/g, '');

// Theme/genre compilation playlists (e.g. "Sci-Fi Anime Full Episodes",
// "Anime where they pet the dog", "Witch Anime") — NOT a single series. Reject.
const COMPILATION = /\banime\b|\bfull\s+episodes?\b|\bwhere\s+they\b|\bopenings?\s*&?\s*endings?\b/i;
const MOVIE_HINT = /\b(?:movie|film)\b|劇場/i;
// A single episode marker, used to confirm a playlist is an actual episodic series.
const EPISODE_MARK = /(?:\bep\.?\s*\d+|\bepisode\s*\d+|\be\d{1,3}\b|第\s*\d+\s*話|#\s*\d+|\s-\s*0*\d{1,3}(?:\b|$))/i;

function yt(args) {
  return execFileSync('python', ['-m', 'yt_dlp', ...args], {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function listChannelPlaylists(channelId) {
  try {
    const raw = yt([
      '--flat-playlist',
      '--dump-single-json',
      '--playlist-end', String(MAX_PLAYLISTS_PER_CHANNEL),
      `https://www.youtube.com/channel/${channelId}/playlists`,
    ]);
    const json = JSON.parse(raw);
    return (json.entries ?? [])
      .filter((e) => e?.id && e?.title)
      .map((e) => ({ playlistId: e.id, title: e.title }));
  } catch {
    return [];
  }
}

function fetchPlaylistVideos(playlistId) {
  try {
    const raw = yt([
      '--flat-playlist',
      '--dump-single-json',
      `https://www.youtube.com/playlist?list=${playlistId}`,
    ]);
    const json = JSON.parse(raw);
    return (json.entries ?? [])
      .filter((e) => e?.id && e?.title)
      .map((e) => ({ id: e.id, title: e.title }));
  } catch {
    return [];
  }
}

// Clean a messy source playlist title into a display title.
function cleanTitle(raw) {
  let t = String(raw).split('|')[0];
  t = t.replace(/[《》【】（）()\[\]]/g, ' ');        // strip bracket glyphs
  t = t.replace(/[　-鿿가-힯]/g, ' '); // strip CJK/Hangul
  t = t.replace(/\s+/g, ' ').trim();
  if (!t) t = String(raw).replace(/[《》【】（）()\[\]|]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'anime';
}

function main() {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const snapshots = JSON.parse(readFileSync(PLAYLISTS_PATH, 'utf8'));

  const existingPlaylistIds = new Set(catalog.map((e) => String(e.playlistId).toLowerCase()));
  const existingIds = new Set(catalog.map((e) => e.id));
  const existingTitles = new Set(catalog.map((e) => slugify(e.title)));
  // Normalized-title dedupe (catches "X English Sub" re-uploads of featured/existing shows).
  const existingNorm = new Set([
    ...catalog.map((e) => normTitle(e.title)),
    ...FEATURED_TITLES.map(normTitle),
  ]);
  const usedKeys = new Set(Object.keys(snapshots));
  let nextKey = catalog.reduce((m, e) => Math.max(m, Number(e.key) || 0), 0) + 1;

  const added = [];

  for (const ch of CHANNELS) {
    if (added.length >= TARGET) break;
    const playlists = listChannelPlaylists(ch.id);
    process.stderr.write(`[${ch.name}] ${playlists.length} playlists\n`);

    for (const pl of playlists) {
      if (added.length >= TARGET) break;
      const pid = String(pl.playlistId).toLowerCase();
      if (existingPlaylistIds.has(pid)) continue;
      if (EXCLUDE.test(pl.title)) continue;
      if (COMPILATION.test(pl.title)) continue;

      const title = cleanTitle(pl.title);
      const titleSlug = slugify(title);
      if (titleSlug.length < 2) continue;
      if (COMPILATION.test(title)) continue;
      if (existingTitles.has(titleSlug)) continue;
      if (existingNorm.has(normTitle(title))) continue;

      const videos = fetchPlaylistVideos(pl.playlistId);
      if (videos.length < MIN_VIDEOS) continue;

      // Quality gate: real series must look episodic. Movies (single/few films) exempt.
      const isMovie = MOVIE_HINT.test(pl.title);
      if (!isMovie) {
        const epHits = videos.filter((v) => EPISODE_MARK.test(v.title)).length;
        // Real series: needs episode markers AND enough depth (kills clip/merch
        // mini-playlists that only had 2-3 videos).
        if (epHits < 2 || videos.length < 4) continue;
      }

      // unique id + key
      let id = titleSlug;
      let n = 2;
      while (existingIds.has(id)) id = `${titleSlug}-${n++}`;
      let key = String(nextKey++);
      while (usedKeys.has(key)) key = String(nextKey++);

      const type = MOVIE_HINT.test(pl.title) ? 'movie' : 'series';
      const entry = {
        key,
        id,
        title,
        description: `Official anime ${type} from ${ch.name}.`,
        genres: [],
        playlistId: pl.playlistId,
        trending: 45,
        type,
      };

      catalog.push(entry);
      snapshots[key] = videos;
      existingPlaylistIds.add(pid);
      existingIds.add(id);
      existingTitles.add(titleSlug);
      existingNorm.add(normTitle(title));
      usedKeys.add(key);
      added.push({ id, title, videos: videos.length, channel: ch.name });
      process.stderr.write(`  + ${title} (${videos.length} vids) [${added.length}]\n`);
    }
  }

  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  writeFileSync(PLAYLISTS_PATH, JSON.stringify(snapshots, null, 2) + '\n', 'utf8');

  process.stderr.write(`\nDONE: added ${added.length} new anime. catalog=${catalog.length}\n`);
  console.log(JSON.stringify({ added: added.length, total: catalog.length }, null, 2));
}

main();
