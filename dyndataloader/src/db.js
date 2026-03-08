// db.js — Oracle connection pool via node-oracledb.
// Returns plain row objects (lowercase keys) ready for ETL.

import oracledb from "oracledb";

oracledb.initOracleClient({
  configDir: "C:\\opt\\Oracle\\admin",
  libDir: "C:\\opt\\oracle\\instantclient_19_26",
});

let pool = null;

async function getPool() {
  if (pool) return pool;

  const { ORACLE_DSN, ORACLE_USER, ORACLE_PASSWORD } = process.env;

  if (!ORACLE_DSN || !ORACLE_USER || !ORACLE_PASSWORD) {
    throw new Error("Missing ORACLE_DSN / ORACLE_USER / ORACLE_PASSWORD env vars");
  }

  pool = await oracledb.createPool({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString: ORACLE_DSN,
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1,
  });

  console.log("[db] node-oracledb connection pool created");
  return pool;
}

/**
 * Run SQL against Oracle and return rows as plain objects with lowercase keys.
 * DATE columns are converted to ISO strings.
 * @param {string} sql
 * @returns {Promise<object[]>}
 */
export async function queryToRows(sql) {
  const p = await getPool();
  const connection = await p.getConnection();

  try {
    const result = await connection.execute(sql, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchArraySize: 1000,
    });

    return (result.rows ?? []).map((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        out[k.toLowerCase()] = v instanceof Date ? v.toISOString() : v;
      }
      return out;
    });
  } finally {
    await connection.close();
  }
}
