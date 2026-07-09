import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const tempRoot = resolve(root, '.Codex', 'tmp', 'apk-build');
const moves = [
  [resolve(root, 'app', 'api'), resolve(tempRoot, 'api')],
  [resolve(root, 'middleware.ts'), resolve(tempRoot, 'middleware.ts')],
].filter(([from]) => existsSync(from));

function move(from, to) {
  if (existsSync(to)) {
    throw new Error(`Stale APK build temp path exists: ${to}`);
  }
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
}

function restore() {
  for (const [from, to] of [...moves].reverse()) {
    if (existsSync(to) && !existsSync(from)) {
      mkdirSync(dirname(from), { recursive: true });
      renameSync(to, from);
    }
  }
}

try {
  const nextDir = resolve(root, '.next');
  if (nextDir.startsWith(root) && existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true });
  }
  moves.forEach(([from, to]) => move(from, to));
  const nextBin = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CAPACITOR_BUILD: '1',
      NEXT_PUBLIC_STATIC_EXPORT: '1',
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  restore();
}
