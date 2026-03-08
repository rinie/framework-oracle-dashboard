# Oracle Dashboard

Observable Framework dashboard with a Node.js/Express sidecar that queries Oracle via `duckdb-oracle` and streams Arrow IPC data to the browser over WebSocket.

## Architecture

```
Oracle DB
  ↓ duckdb-oracle
Express Sidecar (Node.js)
  ├── GET  /health
  ├── POST /refresh          ← bearer auth, 409 guard
  ├── POST /refresh/:dataset ← bearer auth, 409 guard
  └── WS   /data             ← Arrow IPC binary frames, pushed on schedule
        ↓
Observable Framework (static site)
  └── DuckDB-WASM ← Arrow IPC → reactive charts + table
```

## Setup

### 1. Prerequisites

- Node.js 18+
- [duckdb-oracle](https://github.com/rinie/duckdb-oracle) extension built and loadable
- Oracle Instant Client on `LD_LIBRARY_PATH` / `PATH`

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the sidecar

```bash
cp sidecar/.env.example sidecar/.env
# Edit sidecar/.env with your Oracle credentials and settings
```

### 4. Add your datasets

Edit `sidecar/src/datasets.js` to add Oracle queries.

### 5. Run in development

```bash
npm run dev
```

- Sidecar: `http://localhost:3001`
- Framework: `http://localhost:3000` (proxies `/data` WebSocket to sidecar)

### 6. Build for production

```bash
npm run build
# framework/dist/ contains the static site
# Run the sidecar separately: npm run start --workspace=sidecar
```

## Manual refresh

```bash
# Refresh all datasets
curl -X POST http://localhost:3001/refresh \
  -H "Authorization: Bearer your_token"

# Refresh one dataset
curl -X POST http://localhost:3001/refresh/sales_summary \
  -H "Authorization: Bearer your_token"
```

## Adding datasets

1. Add an entry to `sidecar/src/datasets.js`
2. Add a `subscribe("your_dataset", ...)` call in your Framework page
3. The scheduler will pick it up on the next tick; use `/refresh` to trigger immediately

## WebSocket message format

Binary envelope:
```
[4 bytes: dataset name length, LE uint32]
[N bytes: dataset name, UTF-8]
[remaining: Arrow IPC stream bytes]
```

Error messages are JSON strings:
```json
{ "type": "error", "dataset": "sales_summary", "message": "...", "timestamp": "..." }
```
