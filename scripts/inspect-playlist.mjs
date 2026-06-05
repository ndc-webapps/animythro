import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);

const playlistId = process.argv[2] || 'PLxSscENEp7JgdWqkc38w1s2ftrvict4zQ';

const { stdout } = await execFileAsync('python', [
  '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json',
  '--no-warnings', '--geo-bypass-country', 'SG',
  `https://www.youtube.com/playlist?list=${playlistId}`,
], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });

const d = JSON.parse(stdout);
console.log('playlist title:', d.title);
console.log('video count:', (d.entries || []).length);
for (const e of d.entries || []) {
  console.log(`avail=${e.availability ?? 'null'} | dur=${e.duration ?? '?'} | ${String(e.title).slice(0, 60)}`);
}
