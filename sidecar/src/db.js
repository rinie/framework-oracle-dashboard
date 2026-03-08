// db.js — DuckDB connection with duckdb-oracle extension.
// Queries Oracle and returns results as Arrow IPC Uint8Array.

import duckdb from "duckdb";
import { tableFromArrays, tableToIPC } from "apache-arrow";

let db = null;
let extensionLoaded = false;

async function getDb() {
  if (db && extensionLoaded) return db;

  db = new duckdb.Database(":memory:");

  await new Promise((resolve, reject) => {
    db.run("LOAD oracle;", (err) => {
      if (err) return reject(new Error(`Failed to load oracle extension: ${err.message}`));
      extensionLoaded = true;
      console.log("[db] duckdb-oracle extension loaded");
      resolve();
    });
  });

  return db;
}

/**
 * Attach Oracle, run SQL, detach, return Arrow IPC Uint8Array.
 * @param {string} sql
 * @returns {Promise<Uint8Array>}
 */
export async function queryToArrow(sql) {
  const { ORACLE_DSN, ORACLE_USER, ORACLE_PASSWORD } = process.env;

  if (!ORACLE_DSN || !ORACLE_USER || !ORACLE_PASSWORD) {
    throw new Error("Missing ORACLE_DSN / ORACLE_USER / ORACLE_PASSWORD env vars");
  }

  const database = await getDb();
  const con = database.connect();

  return new Promise((resolve, reject) => {
    const attachSql = `ATTACH 'oracle://${ORACLE_USER}:${ORACLE_PASSWORD}@${ORACLE_DSN}' AS oracle_db (TYPE oracle);`;

    con.run(attachSql, (err) => {
      if (err) {
        con.close();
        return reject(new Error(`ATTACH failed: ${err.message}`));
      }

      con.all(sql, (err, rows) => {
        // Always detach
        con.run("DETACH oracle_db;", () => {
          con.close();

          if (err) return reject(new Error(`Query failed: ${err.message}`));

          try {
            resolve(rowsToArrowIPC(rows ?? []));
          } catch (e) {
            reject(e);
          }
        });
      });
    });
  });
}

/**
 * Convert duckdb row objects to Arrow IPC binary.
 * @param {object[]} rows
 * @returns {Uint8Array}
 */
function rowsToArrowIPC(rows) {
  if (rows.length === 0) {
    return tableToIPC(tableFromArrays({}));
  }

  const keys = Object.keys(rows[0]);
  const arrays = {};
  for (const key of keys) {
    arrays[key] = rows.map((r) => r[key]);
  }

  return tableToIPC(tableFromArrays(arrays));
}
