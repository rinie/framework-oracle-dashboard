// etl.js — Oracle → Hive-partitioned zstd Parquet via DuckDB.
//
// Partition structure:  data/{dataset}/ym=YYYY-MM/data.parquet
//   full run      : writes one partition per month (clears stale partitions first)
//   incremental   : writes/overwrites only the current month's partition

import duckdb from "duckdb";
import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { queryToRows } from "./db.js";
import { updateManifest } from "./manifest.js";
import { datasets } from "./datasets.js";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../framework/docs/data");

/**
 * Run ETL for one dataset (by name) or all enabled datasets.
 * @param {string|null} datasetName
 * @param {{ full?: boolean }} options
 * @returns {Promise<string[]>}
 */
export async function runEtl(datasetName = null, { full = false } = {}) {
  const targets = datasetName
    ? datasets.filter((d) => d.name === datasetName && d.enabled)
    : datasets.filter((d) => d.enabled);

  if (datasetName && targets.length === 0) {
    throw new Error(`Dataset not found or disabled: ${datasetName}`);
  }

  const triggered = [];
  for (const dataset of targets) {
    await etlDataset(dataset, { full });
    triggered.push(dataset.name);
  }
  return triggered;
}

async function etlDataset(dataset, { full }) {
  const outDir = join(DATA_DIR, dataset.name);
  const isFirstRun = !existsSync(outDir);
  const runFull = full || isFirstRun;

  const sql = runFull ? dataset.sql : (dataset.sqlIncremental ?? dataset.sql);
  console.log(`[etl] ${dataset.name}: ${runFull ? "full" : "incremental"} run`);

  const rows = await queryToRows(sql);
  console.log(`[etl] ${dataset.name}: ${rows.length} rows from Oracle`);

  if (runFull) {
    // Full: clear stale partitions and rewrite all months
    rmSync(outDir, { recursive: true, force: true });
    await writePartitionedByMonth(rows, outDir);
  } else {
    // Incremental: overwrite only the current month's partition
    const ym = currentYearMonth();
    const partDir = join(outDir, `ym=${ym}`);
    mkdirSync(partDir, { recursive: true });
    await rowsToParquet(rows, join(partDir, "data.parquet"));
  }

  updateManifest(dataset.name, {
    updatedAt: new Date().toISOString(),
    rows: rows.length,
    mode: runFull ? "full" : "incremental",
    partitionsDir: outDir,
  });

  console.log(`[etl] ${dataset.name}: done → ${outDir}`);
}

/** Full run: group rows by month in JS, write one data.parquet per partition. */
async function writePartitionedByMonth(rows, outputDir) {
  if (rows.length === 0) return;

  // Group by ym derived from the ISO month string
  const byMonth = new Map();
  for (const row of rows) {
    const ym = row.month.slice(0, 7); // "2026-03"
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym).push(row);
  }

  for (const [ym, monthRows] of byMonth) {
    const partDir = join(outputDir, `ym=${ym}`);
    mkdirSync(partDir, { recursive: true });
    await rowsToParquet(monthRows, join(partDir, "data.parquet"));
  }
}

/** Write rows to a single Parquet file via DuckDB. */
async function rowsToParquet(rows, outputPath) {
  const tempFile = join(tmpdir(), `etl_${process.pid}_${Date.now()}.json`);
  try {
    writeFileSync(tempFile, JSON.stringify(rows.length > 0 ? rows : [{}]));
    const src = toDuckPath(tempFile);
    const dst = toDuckPath(outputPath);
    const sql = rows.length > 0
      ? `COPY (SELECT * FROM read_json_auto('${src}')) TO '${dst}' (FORMAT PARQUET, COMPRESSION zstd)`
      : `COPY (SELECT * FROM read_json_auto('${src}') LIMIT 0) TO '${dst}' (FORMAT PARQUET, COMPRESSION zstd)`;
    await runDuckSQL(sql);
  } finally {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

function runDuckSQL(sql) {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(":memory:");
    db.run(sql, (err) => {
      db.close();
      if (err) reject(new Error(`DuckDB: ${err.message}`));
      else resolve();
    });
  });
}

function toDuckPath(p) {
  return p.replace(/\\/g, "/").replace(/'/g, "''");
}

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-03"
}
