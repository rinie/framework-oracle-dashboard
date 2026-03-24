// src/data/oracle-sample.json.js
// Data loader — adjust the SQL to your actual Oracle schema.

import { query } from "../components/duckdb-ui.js";

const TABLE = process.env.ORACLE_SAMPLE_TABLE ?? "oracle.config";

const rows = await query(`
  SELECT *
  FROM ${TABLE}
  LIMIT 500
`);

process.stdout.write(JSON.stringify(rows, null, 2));
