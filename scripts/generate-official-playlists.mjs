import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const playlists = {
  spyFamily: 'PLwLSw1_eDZl1wGMYg5oB3uEns0CZNl6sI',
  hunterXHunter: 'PLwLSw1_eDZl2SdSro00Nvg38MQUf-5ZL8',
  fairyTail: 'PLwLSw1_eDZl2VQRIahDF73hnkdPjNRYnu',
  shangriLaFrontier: 'PLwLSw1_eDZl1k3PpCugshhYpSQVWUAaib',
  frieren: 'PLwLSw1_eDZl10YPPR7qDsVf10wZfYnIMK',
  irumaKun: 'PLwLSw1_eDZl1Sf_lALh99YZAJTp5IaRft',
  ragnaCrimson: 'PLwLSw1_eDZl2gLJyLH6BkSr4l1XPaKDjT',
};

const output = {};

for (const [key, playlistId] of Object.entries(playlists)) {
  const raw = execFileSync(
    'python',
    [
      '-m',
      'yt_dlp',
      '--flat-playlist',
      '--dump-single-json',
      `https://www.youtube.com/playlist?list=${playlistId}`,
    ],
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  const playlist = JSON.parse(raw);
  output[key] = playlist.entries
    .filter((entry) => entry?.id && entry?.title)
    .map((entry) => ({ id: entry.id, title: entry.title }));
}

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'lib', 'official-playlists.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
