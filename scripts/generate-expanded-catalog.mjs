import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const channelId = 'UCGbshtvS9t-8CW11W7TooQg';
const maxAdditionalTitles = 200;
const existingPlaylistIds = new Set([
  'PLwLSw1_eDZl1wGMYg5oB3uEns0CZNl6sI',
  'PLwLSw1_eDZl2SdSro00Nvg38MQUf-5ZL8',
  'PLwLSw1_eDZl2VQRIahDF73hnkdPjNRYnu',
  'PLwLSw1_eDZl1k3PpCugshhYpSQVWUAaib',
  'PLwLSw1_eDZl10YPPR7qDsVf10wZfYnIMK',
  'PLwLSw1_eDZl1Sf_lALh99YZAJTp5IaRft',
  'PLwLSw1_eDZl2gLJyLH6BkSr4l1XPaKDjT',
]);

const famousTitles = [
  'one-punch man',
  'attack on titan',
  're:zero',
  'that time i got reincarnated as a slime',
  'dan da dan',
  'the seven deadly sins',
  'jojo',
  'tokyo revengers',
  'mushoku tensei',
  'goblin slayer',
  'ouran high school host club',
  'cells at work',
  'date a live',
  'hyouka',
  'assassination classroom',
];

function runYtDlp(url) {
  return execFileAsync(
    'python',
    ['-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', url],
    { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 },
  ).then(({ stdout }) => JSON.parse(stdout));
}

function cleanTitle(title) {
  return title
    .replace(/^\s*\[(?:limited-time|film)\]\s*/i, '')
    .replace(/^\s*\((?:full series)\)\s*/i, '')
    .replace(/\s*\[(?:english sub|english dub)\]\s*$/i, '')
    .trim();
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'official-anime';
}

function isMovie(title) {
  return /\bmovies?\b|\bfilm\b/i.test(title);
}

function isCandidate(title) {
  const english = /\[English (?:Sub|Dub)\]/i.test(title);
  const playableCollection = english || /\(Full Series\)/i.test(title);
  const excluded = /\b(?:promotion|trailer|teaser|shorts?|opening|ending|music|song|pv)\b/i.test(title);
  return playableCollection && !excluded;
}

function priority(title) {
  const normalized = title.toLowerCase();
  const famousIndex = famousTitles.findIndex((name) => normalized.includes(name));
  if (famousIndex !== -1) return famousIndex;
  if (isMovie(title)) return famousTitles.length;
  if (/\bfull series\b/i.test(title)) return famousTitles.length + 1;
  return famousTitles.length + 2;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const item = items[index++];
      const result = await mapper(item);
      if (result) output.push(result);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return output;
}

const channel = await runYtDlp(`https://www.youtube.com/channel/${channelId}/playlists`);
const candidates = channel.entries
  .filter((playlist) => playlist?.id && playlist?.title)
  .filter((playlist) => !existingPlaylistIds.has(playlist.id))
  .filter((playlist) => isCandidate(playlist.title))
  .sort((a, b) => priority(a.title) - priority(b.title));

const usedIds = new Set();
const verified = await mapWithConcurrency(candidates, 8, async (playlist) => {
  try {
    const data = await runYtDlp(`https://www.youtube.com/playlist?list=${playlist.id}`);
    const videos = data.entries
      .filter((entry) => entry?.id && entry?.title)
      .filter((entry) => !/^\[(?:private|deleted) video\]$/i.test(entry.title))
      .filter((entry) => !entry.duration || entry.duration >= 600)
      .map((entry) => ({ id: entry.id, title: entry.title }));

    if (videos.length === 0) return null;

    const title = cleanTitle(playlist.title);
    let id = slugify(title);
    if (usedIds.has(id)) id = `${id}-${playlist.id.slice(-6).toLowerCase()}`;
    usedIds.add(id);

    return {
      config: {
        key: id,
        id,
        title,
        description: `Official ${isMovie(playlist.title) ? 'anime movie' : 'anime episode'} collection from Muse Asia.`,
        genres: isMovie(playlist.title) ? ['Movie'] : [],
        playlistId: playlist.id,
        trending: Math.max(1, 90 - priority(playlist.title)),
        type: isMovie(playlist.title) ? 'movie' : 'series',
      },
      videos,
    };
  } catch (error) {
    console.warn(`Skipped ${playlist.title}: ${error.message}`);
    return null;
  }
});

const selected = verified.slice(0, maxAdditionalTitles);
const configs = selected.map((item) => item.config);
const playlists = Object.fromEntries(selected.map((item) => [item.config.key, item.videos]));

writeFileSync(resolve('lib', 'expanded-catalog.json'), `${JSON.stringify(configs, null, 2)}\n`, 'utf8');
writeFileSync(resolve('lib', 'expanded-playlists.json'), `${JSON.stringify(playlists, null, 2)}\n`, 'utf8');

console.log(`Generated ${configs.length} additional official titles.`);
console.log(`Movies: ${configs.filter((item) => item.type === 'movie').length}`);
