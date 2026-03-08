// Observable Framework data loader: combines all Hive-partitioned Parquet files
// for sales_summary into a single zstd Parquet written to stdout.
// Re-runs automatically when any partition file changes (mtime-based cache).

import duckdb from "duckdb";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const PARTITIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "sales_summary");
const tmpFile = join(tmpdir(), `sales_summary_loader_${process.pid}.parquet`);

function toDuckPath(p) {
  return p.replace(/\\/g, "/").replace(/'/g, "''");
}

async function main() {
  if (!existsSync(PARTITIONS_DIR)) {
    // No data yet — write an empty Parquet with the expected schema
    const db = new duckdb.Database(":memory:");
    await new Promise((resolve, reject) => {
      db.run(
        `COPY (SELECT '' AS month, '' AS region, 0 AS total_sales, 0 AS order_count LIMIT 0) ` +
        `TO '${toDuckPath(tmpFile)}' (FORMAT PARQUET, COMPRESSION zstd)`,
        (err) => { db.close(); err ? reject(err) : resolve(); }
      );
    });
    process.stdout.write(readFileSync(tmpFile));
    unlinkSync(tmpFile);
    return;
  }

  const src = toDuckPath(PARTITIONS_DIR) + "/**/*.parquet";
  const dst = toDuckPath(tmpFile);

  const db = new duckdb.Database(":memory:");
  await new Promise((resolve, reject) => {
    db.run(
      `COPY (SELECT * FROM read_parquet('${src}')) TO '${dst}' (FORMAT PARQUET, COMPRESSION zstd)`,
      (err) => { db.close(); err ? reject(err) : resolve(); }
    );
  });

  process.stdout.write(readFileSync(tmpFile));
  unlinkSync(tmpFile);
}

main().catch((err) => {
  process.stderr.write(`[sales_summary.parquet.js] ${err.message}\n`);
  process.exit(1);
});
