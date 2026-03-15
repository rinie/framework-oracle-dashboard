// src/components/duckdb-ui.js
//
// Thin wrapper around the duckdb-ui HTTP server endpoints.
// Used by data loaders (Node.js context) and optionally
// by browser-side code for live queries.
//
// The duckdb-ui-client TypeScript package is the official
// client; until it is published to npm we talk to the
// HTTP API directly — the protocol is stable enough for this.

const DUCKDB_UI_BASE = process.env.DUCKDB_UI_URL ?? "http://localhost:4213";

/**
 * Run a SQL query against the duckdb-ui HTTP server.
 * Returns an array of plain objects (one per row).
 *
 * @param {string} sql
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function query(sql) {
  const res = await fetch(`${DUCKDB_UI_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`duckdb-ui query failed (${res.status}): ${text}`);
  }

  const json = await res.json();

  // duckdb-ui response shape:
  //   { columns: [{ name, type }], rows: [[v, v, ...], ...] }
  // Normalise to array-of-objects for convenience.
  const { columns, rows } = json;
  if (!columns || !rows) return json; // pass through if shape differs

  const names = columns.map((c) => c.name);
  return rows.map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
}

/**
 * Fetch current catalog snapshot (schemas + tables).
 * Useful for sidebar tree / schema explorer.
 *
 * @returns {Promise<Array>}
 */
export async function getCatalog() {
  return query(`
    SELECT table_catalog, table_schema, table_name, table_type
    FROM information_schema.tables
    ORDER BY table_catalog, table_schema, table_name
  `);
}

/**
 * Subscribe to SSE catalog-change events from duckdb-ui.
 * Only meaningful in a browser context.
 *
 * @param {(event: MessageEvent) => void} onEvent
 * @returns {() => void} unsubscribe function
 */
export function subscribeToCatalogEvents(onEvent) {
  const es = new EventSource(`${DUCKDB_UI_BASE}/localEvents`);
  es.onmessage = onEvent;
  es.onerror = (e) => console.warn("duckdb-ui SSE error", e);
  return () => es.close();
}
