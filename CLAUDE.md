# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (root workspace)
npm install

# Development (runs sidecar + framework concurrently)
npm run dev

# Build production static site (output: framework/dist/)
npm run build

# Production preview (sidecar + framework static preview)
npm run start

# Sidecar only
npm run dev --workspace=sidecar
npm run start --workspace=sidecar

# Framework only
npm run dev --workspace=framework
npm run build --workspace=framework
```

There are no test scripts defined. Linting is also not configured.

## Environment Setup

Before running the sidecar, copy and populate the env file:

```bash
cp sidecar/.env.example sidecar/.env
```

Required env vars: `ORACLE_DSN`, `ORACLE_USER`, `ORACLE_PASSWORD`.
Optional: `PORT` (default 3001), `BEARER_TOKEN`, `POLL_INTERVAL_MS` (default 60000).

## Architecture

This is an **npm workspaces** monorepo with two packages:

- `sidecar/` — Node.js/Express server that queries Oracle and streams data
- `framework/` — Observable Framework static site that visualizes the data

### Data flow

```
Oracle DB → duckdb-oracle → sidecar → WebSocket (Arrow IPC) → browser (DuckDB-WASM) → charts
```

1. **`sidecar/src/db.js`** — Opens a DuckDB `:memory:` instance, loads the `oracle` extension, then ATTACHes Oracle on each query and DETACHes after. Returns Arrow IPC `Uint8Array` via `apache-arrow`'s `tableToIPC`.

2. **`sidecar/src/datasets.js`** — Single source of truth for all Oracle queries. Each entry has `name`, `sql`, `enabled`. This is the file to edit when adding new data sources.

3. **`sidecar/src/broadcaster.js`** — Manages connected WebSocket clients. On new connection, pushes all datasets immediately. Exports `pushAll()` and `pushDataset()`. Wire message format: `[4-byte LE uint32 name length][name bytes][Arrow IPC bytes]`. Errors are sent as JSON strings `{ type, dataset, message, timestamp }`.

4. **`sidecar/src/scheduler.js`** — Calls `pushAll()` on a `setInterval` based on `POLL_INTERVAL_MS`. Also exports `triggerRefresh(datasetName?)` for the HTTP `/refresh` endpoints.

5. **`framework/src/components/oracle-ws.js`** — Browser-side WebSocket client. Decodes the binary envelope, deserializes Arrow IPC with `tableFromIPC`, and dispatches to registered callbacks. Auto-reconnects with exponential backoff (3 s → 30 s). Subscribe to connection status via `subscribe("__status__", cb)` and per-dataset errors via `subscribe("__error__:datasetName", cb)`.

6. **`framework/docs/`** — Observable Framework pages (Markdown + embedded JS). Pages use `Mutable()` for reactive state and call `subscribe("dataset_name", table => ...)`. Charts are built with Observable Plot.

7. **`framework/observablehq.config.js`** — Framework config. In dev, proxies `ws://localhost:3001/data` so the framework dev server forwards WebSocket connections to the sidecar. In production, a reverse proxy must forward `/data` to the sidecar.

### Adding a new dataset

1. Add an entry to `sidecar/src/datasets.js` (`name`, `sql`, `enabled: true`).
2. Create or edit a page in `framework/docs/` — call `subscribe("your_dataset_name", (table) => { ... })`.
3. Register the page in `framework/observablehq.config.js` under `pages`.
4. Use `POST /refresh/your_dataset_name` (with `Authorization: Bearer <token>`) to push immediately without waiting for the scheduler.
