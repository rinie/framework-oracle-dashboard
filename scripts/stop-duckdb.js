// scripts/stop-duckdb.js
// Sends a shutdown request to the running DuckDB UI HTTP server.

const BASE = process.env.DUCKDB_UI_URL ?? 'http://localhost:4213';

try {
  const res = await fetch(`${BASE}/shutdown`, { method: 'POST' });
  if (res.ok) {
    console.log('[duckdb] UI server stopped.');
  } else {
    console.error(`[duckdb] Shutdown returned status ${res.status}`);
    process.exit(1);
  }
} catch (err) {
  console.error('[duckdb] Could not reach DuckDB UI server:', err.message);
  process.exit(1);
}
