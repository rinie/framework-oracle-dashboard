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
    mkdirSync(outDir, { recursive: true });
    await writePartitionedByMonth(rows, outDir);
  } else {
    // Incremental: overwrite only the current month's partition
    const ym = currentYearMonth();
    const partDir = join(outDir, `ym=${ym}`);
    mkdirSync(partDir, { recursive: true });
    await rowsToParquet(rows, join(partDir, "data.parquet"));
  }

  // Write a static combined Parquet so the browser can fetch it without
  // going through Observable Framework's data-loader cache (which only
  // invalidates when the .js loader script itself changes).
  await writeCombinedParquet(outDir, join(DATA_DIR, `${dataset.name}.parquet`));

  updateManifest(dataset.name, {
    updatedAt: new Date().toISOString(),
    rows: rows.length,
    mode: runFull ? "full" : "incremental",
  });

  console.log(`[etl] ${dataset.name}: done → ${outDir}`);
}

/** Full run: write one Hive partition per month using DuckDB PARTITION_BY. */
async function writePartitionedByMonth(rows, outputDir) {
  if (rows.length === 0) return; // nothing to write

  const tempFile = join(tmpdir(), `etl_full_${process.pid}_${Date.now()}.json`);
  try {
    // Add 'ym' derived from the ISO month string for use as the Hive partition key.
    // DuckDB PARTITION_BY extracts it into the directory name and drops it from the file.
    const data = rows.map((r) => ({ ...r, ym: r.month.slice(0, 7) }));
    writeFileSync(tempFile, JSON.stringify(data));

    const src = toDuckPath(tempFile);
    const dst = toDuckPath(outputDir);
    await runDuckSQL(
      `COPY (SELECT * FROM read_json_auto('${src}')) TO '${dst}' ` +
      `(FORMAT PARQUET, COMPRESSION zstd, PARTITION_BY (ym))`
    );
  } finally {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

/** Incremental run: write rows directly to a single Parquet file. */
async function rowsToParquet(rows, outputPath) {
  const tempFile = join(tmpdir(), `etl_inc_${process.pid}_${Date.now()}.json`);
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

/** Combine all Hive partition files into a single static Parquet for direct serving. */
async function writeCombinedParquet(partitionsDir, outputPath) {
  if (!existsSync(partitionsDir)) return;
  const src = toDuckPath(partitionsDir) + "/**/*.parquet";
  const dst = toDuckPath(outputPath);
  await runDuckSQL(
    `COPY (SELECT * FROM read_parquet('${src}')) TO '${dst}' (FORMAT PARQUET, COMPRESSION zstd)`
  );
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
