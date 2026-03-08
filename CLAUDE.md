# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (root workspace)
npm install

# Development (runs dyndataloader + framework concurrently)
npm run dev

# Build production static site (output: framework/dist/)
npm run build

# Production preview (dyndataloader + framework static preview)
npm run start

# Dyndataloader only
npm run dev --workspace=dyndataloader
npm run start --workspace=dyndataloader

# Framework only
npm run dev --workspace=framework
npm run build --workspace=framework
```

There are no test scripts defined. Linting is also not configured.

## Environment Setup

Before running the dyndataloader, copy and populate the env file:

```bash
cp dyndataloader/.env.example dyndataloader/.env
```

Required env vars: `ORACLE_DSN`, `ORACLE_USER`, `ORACLE_PASSWORD`.
Optional: `PORT` (default 3001), `BEARER_TOKEN`, `POLL_INTERVAL_MS` (default 60000).

## Architecture

This is an **npm workspaces** monorepo with two packages:

- `dyndataloader/` — Node.js/Express server that queries Oracle and writes Parquet data
- `framework/` — Observable Framework static site that visualizes the data

### Data flow

```
Oracle DB → node-oracledb → dyndataloader → Hive-partitioned zstd Parquet → framework/docs/data/ → browser (DuckDB-WASM) → charts
```

1. **`dyndataloader/src/db.js`** — Oracle connection pool via node-oracledb (thick mode). Returns plain lowercase-keyed rows.

2. **`dyndataloader/src/datasets.js`** — Single source of truth for all Oracle queries. Each entry has `name`, `sql`, `sqlIncremental`, `enabled`. This is the file to edit when adding new data sources.

3. **`dyndataloader/src/etl.js`** — Hive-partitioned Parquet writer. Full run clears and rewrites all partitions; incremental run overwrites only the current month. Also writes a static combined `sales_summary.parquet` for direct browser fetch.

4. **`dyndataloader/src/manifest.js`** — Writes `manifest_raw.json` after each ETL run (dataset name, updatedAt, row count, mode).

5. **`dyndataloader/src/scheduler.js`** — Calls ETL on a `setInterval` based on `POLL_INTERVAL_MS`. Also exports `triggerRefresh(datasetName?)` for the HTTP `/refresh` endpoints.

6. **`framework/docs/`** — Observable Framework pages (Markdown + embedded JS). Pages poll `/_file/data/manifest_raw.json` and fetch `/_file/data/<dataset>.parquet` via DuckDB-WASM.

7. **`framework/observablehq.config.js`** — Framework config with `root: "framework/docs"`. Run with `--root framework` from repo root.

### Adding a new dataset

1. Add an entry to `dyndataloader/src/datasets.js` (`name`, `sql`, `sqlIncremental`, `enabled: true`).
2. Create or edit a page in `framework/docs/` — poll `/_file/data/manifest_raw.json`, fetch `/_file/data/your_dataset.parquet`.
3. Register the page in `framework/observablehq.config.js` under `pages`.
4. Use `POST /refresh/your_dataset_name` (with `Authorization: Bearer <token>`) to push immediately without waiting for the scheduler.
