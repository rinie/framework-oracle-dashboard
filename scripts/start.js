// scripts/start.js
// Starts the custom DuckDB query server and Observable Framework dev server concurrently.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DUCKDB_UI_URL = process.env.DUCKDB_UI_URL ?? 'http://localhost:4213';
const TIMEOUT_MS = 30_000;

// --- Start custom DuckDB query server (Node.js, uses @duckdb/node-api) ------
const duckdb = spawn(process.execPath, [join(root, 'scripts', 'start-duckdb.js')], {
  stdio: 'inherit',
  cwd: root,
});

duckdb.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[duckdb] exited with code ${code}`);
    observable?.kill();
    process.exit(code);
  }
});

// --- Wait for DuckDB query server to be reachable ---------------------------
console.log(`[start] Waiting for DuckDB query server at ${DUCKDB_UI_URL} …`);
await waitForUrl(`${DUCKDB_UI_URL}/health`, TIMEOUT_MS);
console.log('[start] DuckDB query server ready.');

// --- Start Observable Framework ---------------------------------------------
const obsCmd = process.platform === 'win32'
  ? join(root, 'node_modules', '.bin', 'observable.cmd')
  : join(root, 'node_modules', '.bin', 'observable');

const observable = spawn(obsCmd, ['preview'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32', // .cmd files require a shell on Windows
});

observable.on('exit', (code) => {
  duckdb.kill();
  process.exit(code ?? 0);
});

// --- Graceful shutdown -------------------------------------------------------
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    duckdb.kill(sig);
    observable.kill(sig);
  });
}

// --- Helpers -----------------------------------------------------------------
async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`[start] Timed out waiting for ${url}`);
  duckdb.kill();
  process.exit(1);
}
