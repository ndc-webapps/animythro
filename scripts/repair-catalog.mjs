// scripts/repair-catalog.mjs
// Repairs the non-Muse catalog entries:
//  1. Removes members-only / subscriber-only / premium videos (unplayable for free users).
//  2. Re-derives clean English titles for CJK-only playlist names.
//  3. Drops entries that have no free, playable videos left.
// Muse entries are already clean (English titles, no members-only) and are kept as-is.
import { execFile } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const GEO = 'SG';
const MIN_VIDEO_SECONDS = 480;
const CONCURRENCY = 12;
const BLOCKED_AVAIL = new Set(['subscriber_only', 'premium_only', 'needs_auth', 'needs_subscription', 'private']);

const catalogPath = resolve('lib', 'expanded-catalog.json');
const playlistsPath = resolve('lib', 'expanded-playlists.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const playlists = JSON.parse(readFileSync(playlistsPath, 'utf8'));

const isMuse = (c) => !c.sourceName || /Muse/i.test(c.sourceName);

function cleanup(s) {
  return String(s)
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/（[^）]*）/g, ' ')
    .replace(/\((?:eng?\s*sub|jp\s*dub|english\s*(?:sub|dub)|cantonese|dub|sub)[^)]*\)/gi, ' ')
    .replace(/[｜|].*$/, ' ')
    .replace(/\bULTRA\b/gi, ' ')
    .replace(/[　-鿿가-힯぀-ヿ]/g, ' ') // CJK / Kana / Hangul
    .replace(/《|》/g, ' ')
    .replace(/\s*[—–-]\s*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickTitle(playlistTitle, videoTitles) {
  const candidates = [playlistTitle, ...videoTitles];
  let best = '';
  for (const c of candidates) {
    for (const m of String(c).matchAll(/《([^》]+)》/g)) {
      const b = m[1];
      if (/[A-Za-z]/.test(b) && b.length > best.length) best = b;
    }
  }
  if (best) return cleanup(best);
  const fromPl = cleanup(playlistTitle);
  if (/[A-Za-z0-9]/.test(fromPl)) return fromPl;
  for (const v of videoTitles) {
    const s = cleanup(v);
    if (/[A-Za-z0-9]/.test(s)) return s;
  }
  return '';
}

function slugify(value) {
  return (
    value.normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || ''
  );
}

function runYtDlp(url) {
  return execFileAsync('python', [
    '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json',
    '--no-warnings', '--geo-bypass-country', GEO, url,
  ], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 }).then(({ stdout }) => JSON.parse(stdout));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const out = [];
  let i = 0, done = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await mapper(items[idx]);
      if (++done % 40 === 0) console.log(`  processed ${done}/${items.length}...`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return out;
}

const museEntries = catalog.filter(isMuse);
const toRepair = catalog.filter((c) => !isMuse(c));
console.log(`Muse entries kept as-is: ${museEntries.length}`);
console.log(`Non-Muse entries to re-verify: ${toRepair.length}`);

const usedIds = new Set(museEntries.map((c) => c.id));
let removedMembersOnly = 0, retitled = 0, removedEmpty = 0;

const repaired = await mapWithConcurrency(toRepair, CONCURRENCY, async (cfg) => {
  let data;
  try {
    data = await runYtDlp(`https://www.youtube.com/playlist?list=${cfg.playlistId}`);
  } catch {
    return null; // unreachable now — drop to be safe
  }
  const entries = data.entries || [];
  const before = entries.length;
  const free = entries
    .filter((e) => e?.id && e?.title)
    .filter((e) => !e.availability || !BLOCKED_AVAIL.has(e.availability))
    .filter((e) => !/^\[(?:private|deleted|members) video\]$/i.test(e.title))
    .filter((e) => !e.duration || e.duration >= MIN_VIDEO_SECONDS);

  if (free.length < before) removedMembersOnly += (before - free.length);
  if (free.length === 0) { removedEmpty++; return null; }

  const newTitle = pickTitle(data.title ?? cfg.title, free.map((e) => e.title));
  if (!newTitle) { removedEmpty++; return null; }

  let id = slugify(newTitle);
  if (!id) { removedEmpty++; return null; }
  if (usedIds.has(id)) id = `${id}-${cfg.playlistId.slice(-6).toLowerCase()}`;
  if (usedIds.has(id)) return null;
  usedIds.add(id);

  if (newTitle !== cfg.title) retitled++;

  return {
    config: {
      ...cfg,
      key: id,
      id,
      title: newTitle,
    },
    videos: free.map((e) => ({ id: e.id, title: e.title })),
  };
});

const kept = repaired.filter(Boolean);

// Rebuild both files
const newCatalog = [...museEntries, ...kept.map((k) => k.config)];
const newPlaylists = {};
for (const c of museEntries) newPlaylists[c.key] = playlists[c.key] ?? [];
for (const k of kept) newPlaylists[k.config.key] = k.videos;

writeFileSync(catalogPath, `${JSON.stringify(newCatalog, null, 2)}\n`, 'utf8');
writeFileSync(playlistsPath, `${JSON.stringify(newPlaylists, null, 2)}\n`, 'utf8');

console.log('--- REPAIR DONE ---');
console.log(`Members-only videos removed: ${removedMembersOnly}`);
console.log(`Entries removed (no free videos): ${removedEmpty}`);
console.log(`Entries retitled: ${retitled}`);
console.log(`Total catalog now: ${newCatalog.length} titles.`);
