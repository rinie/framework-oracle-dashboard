---
title: Oracle Tables
---

# Oracle Tables

```js
const DUCKDB_UI = "http://localhost:4213";

async function runQuery(sql) {
  const res = await fetch(`${DUCKDB_UI}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const { columns, rows } = await res.json();
  const names = columns.map((c) => c.name);
  return rows.map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
}
```

```js
// Schema selector — populated from information_schema
const schemas = await runQuery(`
  SELECT DISTINCT table_schema
  FROM information_schema.tables
  WHERE table_catalog = 'oracle'
  ORDER BY table_schema
`);

const selectedSchema = view(
  Inputs.select(schemas.map((r) => r.table_schema), { label: "Schema" })
);
```

```js
// Tables in selected schema
const tables = await runQuery(`
  SELECT table_name, table_type
  FROM information_schema.tables
  WHERE table_catalog = 'oracle'
    AND table_schema = '${selectedSchema}'
  ORDER BY table_name
`);

const selectedTable = view(Inputs.table(tables, { multiple: false }));
```

```js
// Preview rows from selected table
const preview = selectedTable
  ? await runQuery(`SELECT * FROM oracle."${selectedSchema}"."${selectedTable.table_name}" LIMIT 200`)
  : [];
```

## Preview: ${selectedTable?.table_name ?? "—"}

```js
selectedTable
  ? Inputs.table(preview)
  : html`<p style="color: var(--theme-foreground-muted)">Select a table above to preview data.</p>`
```
