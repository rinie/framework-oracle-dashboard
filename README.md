# Oracle Dashboard

Observable Framework dashboard with a Node.js/Express dyndataloader that queries Oracle via `node-oracledb` and writes Hive-partitioned zstd Parquet files consumed by the browser via DuckDB-WASM.

## Architecture

```
Oracle DB
  ↓ node-oracledb (thick mode)
dyndataloader (Node.js/Express)
  ├── GET  /health
  ├── POST /refresh          ← bearer auth, 409 guard, ?full=true for full reload
  └── POST /refresh/:dataset ← bearer auth, 409 guard
        ↓
framework/docs/data/
  ├── manifest_raw.json          ← updatedAt, row count per dataset
  ├── <dataset>.parquet          ← combined static Parquet (browser fetches this)
  └── <dataset>/ym=YYYY-MM/     ← Hive partitions (incremental ETL)
        ↓
Observable Framework (static site)
  └── DuckDB-WASM ← polls manifest, fetches Parquet → reactive charts
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Oracle Instant Client 19.26 at `C:\opt\oracle\instantclient_19_26`
- Oracle admin config at `C:\opt\Oracle\admin`

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the dyndataloader

```bash
cp dyndataloader/.env.example dyndataloader/.env
# Edit dyndataloader/.env with your Oracle credentials and settings
```

### 4. Add your datasets

Edit `dyndataloader/src/datasets.js` to add Oracle queries.

### 5. Run in development

```bash
npm run dev
```

- Dyndataloader: `http://localhost:3001`
- Framework: `http://localhost:3000`

### 6. Build for production

```bash
npm run build
# framework/dist/ contains the static site
# Run the dyndataloader separately: npm run start --workspace=dyndataloader
```

## Manual refresh

```bash
# Refresh all datasets (incremental)
curl -X POST http://localhost:3001/refresh \
  -H "Authorization: Bearer your_token"

# Full reload (clears and rewrites all Hive partitions)
curl -X POST "http://localhost:3001/refresh?full=true" \
  -H "Authorization: Bearer your_token"

# Refresh one dataset
curl -X POST http://localhost:3001/refresh/sales_summary \
  -H "Authorization: Bearer your_token"
```

## Adding datasets

1. Add an entry to `dyndataloader/src/datasets.js`
2. Create a Framework page in `framework/docs/` that polls `/_file/data/manifest_raw.json` and fetches `/_file/data/your_dataset.parquet`
3. Register the page in `framework/observablehq.config.js`
4. The scheduler will pick it up on the next tick; use `/refresh` to trigger immediately
