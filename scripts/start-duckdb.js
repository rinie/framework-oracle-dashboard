// scripts/start-duckdb.js
// Custom DuckDB query server using @duckdb/node-api.
// Exposes POST /query  →  { columns: [{name, type}], rows: [[…], …] }
// and GET  /health    →  { status: "ok" }
// and POST /shutdown  →  gracefully stops the server
//
// This replaces the DuckDB UI HTTP server for programmatic data loader access.
// Port: DUCKDB_UI_PORT env var or 4213.

import { createServer } from 'http';
import { DuckDBInstance } from '@duckdb/node-api';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = parseInt(process.env.DUCKDB_UI_PORT ?? '4213', 10);

// ---------------------------------------------------------------------------
// Boot DuckDB
// allow_unsigned_extensions must be set at config time (not via SET).
// ---------------------------------------------------------------------------
console.log('[duckdb] Starting…');

const db = await DuckDBInstance.create(':memory:', {
  allow_unsigned_extensions: 'true',
});
const conn = await db.connect();

// Load the oracle extension (must be on DuckDB's extension path)
await conn.run("LOAD 'oracle'");
console.log('[duckdb] Oracle extension loaded.');

// Attach Oracle — relies on the persistent secret created outside source code.
// DSN can be overridden via ORACLE_DSN env var.
const dsn = process.env.ORACLE_DSN ?? '';
const secret = process.env.ORACLE_SECRET ?? 'my_oracle_secret';
await conn.run(`ATTACH '${dsn}' AS oracle (TYPE oracle, SECRET ${secret})`);
console.log('[duckdb] Oracle database attached.');

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const { method, url } = req;

  // Health check
  if (method === 'GET' && url === '/health') {
    return json(res, 200, { status: 'ok' });
  }

  // Query endpoint — matches the shape duckdb-ui.js expects
  if (method === 'POST' && url === '/query') {
    try {
      const body = await readBody(req);
      const { sql } = JSON.parse(body);
      if (!sql) return json(res, 400, { error: 'Missing "sql" field' });

      const reader = await conn.runAndReadAll(sql);
      const columns = reader.columnNames().map((name, i) => ({
        name,
        type: String(reader.columnType(i)),
      }));
      const rows = reader.getRowsJson();
      return json(res, 200, { columns, rows });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // Graceful shutdown
  if (method === 'POST' && url === '/shutdown') {
    json(res, 200, { status: 'shutting down' });
    conn.closeSync();
    server.close(() => process.exit(0));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[duckdb] Query server ready at http://localhost:${PORT}`);
});

process.on('SIGINT', () => { conn.closeSync(); server.close(); process.exit(0); });
process.on('SIGTERM', () => { conn.closeSync(); server.close(); process.exit(0); });
