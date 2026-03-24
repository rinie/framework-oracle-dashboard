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
const selectedType = view(
  Inputs.radio(["Tables", "Views", "Both"], { label: "Show", value: "Both" })
);
```

```js
const typeFilter =
  selectedType === "Tables" ? `AND table_type = 'BASE TABLE'` :
  selectedType === "Views"  ? `AND table_type = 'VIEW'` :
  "";

const schemas = await runQuery(`
  SELECT DISTINCT table_schema
  FROM information_schema.tables
  WHERE table_catalog = 'oracle'
  ${typeFilter}
  ORDER BY table_schema
`);

const selectedSchema = view(
  Inputs.select(schemas.map((r) => r.table_schema), { label: "Schema" })
);
```

```js
const tables = await runQuery(`
  SELECT table_name, table_type
  FROM information_schema.tables
  WHERE table_catalog = 'oracle'
    AND table_schema = '${selectedSchema}'
  ${typeFilter}
  ORDER BY table_name
`);

const selectedTable = view(Inputs.table(tables, { multiple: false }));
```

```js
const preview = selectedTable
  ? await runQuery(`SELECT * FROM oracle."${selectedSchema}"."${selectedTable.table_name}" LIMIT 200`)
  : [];

const viewDef = selectedTable?.table_type === "VIEW"
  ? (await runQuery(`
      SELECT view_definition
      FROM information_schema.views
      WHERE table_catalog = 'oracle'
        AND table_schema = '${selectedSchema}'
        AND table_name = '${selectedTable.table_name}'
    `))[0]?.view_definition ?? null
  : null;
```

## Preview: ${selectedTable?.table_name ?? "—"}${selectedTable?.table_type === "VIEW" ? " (VIEW)" : ""}

```js
selectedTable
  ? html`
      ${viewDef ? html`<details style="margin-bottom:1rem">
        <summary style="cursor:pointer;font-weight:600">View Definition</summary>
        <pre style="background:var(--theme-background-alt);padding:1rem;border-radius:4px;overflow-x:auto;white-space:pre-wrap">${viewDef}</pre>
      </details>` : ""}
      ${Inputs.table(preview)}
    `
  : html`<p style="color:var(--theme-foreground-muted)">Select a table or view above to preview data.</p>`
```
