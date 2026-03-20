---
title: Oracle Dashboard
---

# Oracle Dashboard

```js
// Load static snapshot produced by the data loader at build / preview time.
const oracleTables = FileAttachment("data/oracle-tables.json").json();
```

```js
// Live connection to duckdb-ui SSE endpoint.
// When the Oracle catalog changes, we invalidate and re-fetch.
const DUCKDB_UI = "http://localhost:4213";

const catalogVersion = Generators.observe((notify) => {
  let version = 0;
  notify(version);

  const es = new EventSource(`${DUCKDB_UI}/localEvents`);
  es.onmessage = () => notify(++version);
  es.onerror = (e) => console.warn("duckdb-ui SSE error", e);

  return () => es.close();
});
```

```js
// Live query — re-runs every time catalogVersion ticks.
// Wrap in parens so the comma is the comma-operator (dependency trick), not a const declaration.
const liveRows = (catalogVersion, await fetch(`${DUCKDB_UI}/query`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sql: `SELECT table_schema, table_name, table_type
          FROM information_schema.tables
          WHERE table_catalog = 'oracle'
          ORDER BY table_schema, table_name`
  })
}).then(r => r.json()).then(({ columns, rows }) => {
  const names = columns.map(c => c.name);
  return rows.map(row => Object.fromEntries(names.map((n, i) => [n, row[i]])));
}));
```

## Oracle tables (live)

Refreshes automatically when the Oracle schema changes via SSE.

```js
Inputs.table(liveRows)
```

## Static snapshot (build-time)

Loaded from the data loader cache — instant page load, no DuckDB required.

```js
Inputs.table(await oracleTables)
```
