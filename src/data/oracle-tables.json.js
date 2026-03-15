// src/data/oracle-tables.json.js
// Observable Framework data loader (runs in Node.js at build / preview time).
// Writes JSON to stdout — Framework caches it and serves as a static snapshot.
//
// Run path: `observable build` or `observable preview` will execute this file
// and cache the result in .observablehq/cache/.

import { query } from "../components/duckdb-ui.js";

const tables = await query(`
  SELECT
    table_schema  AS schema_name,
    table_name,
    table_type
  FROM information_schema.tables
  WHERE table_catalog = 'oracle'
  ORDER BY table_schema, table_name
`);

// Framework data loaders write to stdout
process.stdout.write(JSON.stringify(tables, null, 2));
