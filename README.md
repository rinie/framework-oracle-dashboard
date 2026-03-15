# framework-oracle-dashboard

Observable Framework dashboard backed by DuckDB 1.5 + duckdb-oracle extension,
using the duckdb-ui HTTP server as the query backend.

## Prerequisites

- Node.js 20+
- DuckDB v1.5 CLI binary
- Your compiled `duckdb_oracle.duckdb_extension` (built against v1.5 headers)
- Oracle Instant Client on `LD_LIBRARY_PATH` / `PATH`

## Quick start

### 1. Start DuckDB with the oracle extension and UI server

```bash
duckdb -init startup.sql my-data.db
```

Edit `startup.sql` to set the correct:
- Path to `duckdb_oracle.duckdb_extension`
- Oracle DSN (`user/pass@//host:port/SID`)

The UI server will listen on `http://localhost:4213`.

### 2. Start Observable Framework dev server

```bash
npm install
npm run dev
```

Framework starts on `http://localhost:3000`.
Because `startup.sql` sets `ui_remote_url = 'http://localhost:3000'`,
visiting `http://localhost:4213` will proxy UI assets from Framework.

You can also visit Framework directly at `http://localhost:3000`.

### 3. Open the dashboard

```
http://localhost:3000
```

Data loaders hit the duckdb-ui `/query` endpoint at build time to
produce static JSON snapshots. The browser additionally subscribes
to `/localEvents` SSE for live schema-change notifications.

## Architecture

```
Oracle DB
   │  ODPI-C / Instant Client
   ▼
DuckDB 1.5 process            Observable Framework
  ├─ duckdb-oracle extension      ├─ dev server  :3000
  ├─ duckdb-ui HTTP server :4213  ├─ data loaders (Node.js)
  │    ├─ POST /query  ◄──────────┤    └─ fetch → /query
  │    ├─ GET  /localEvents (SSE) │
  │    └─ proxy → :3000 ◄─────── ┤  (ui_remote_url)
  └─ DuckDB engine                └─ dashboard pages (.md)
                                       └─ SSE listener
                                           /localEvents
```

## Configuration

| Env var | Default | Description |
|---|---|---|
| `DUCKDB_UI_URL` | `http://localhost:4213` | duckdb-ui server base URL |
| `ORACLE_SAMPLE_TABLE` | `oracle.EMPLOYEES` | Table used by sample data loader |

## Key files

| File | Purpose |
|---|---|
| `startup.sql` | DuckDB init — loads oracle ext, starts UI server |
| `src/components/duckdb-ui.js` | Shared query helper (Node.js + browser) |
| `src/data/oracle-tables.json.js` | Data loader: Oracle table list snapshot |
| `src/data/oracle-sample.json.js` | Data loader: sample table rows |
| `src/index.md` | Home page with live SSE + static snapshot |
| `src/oracle-tables.md` | Interactive Oracle table explorer |

## Extension ABI note

The `duckdb_oracle.duckdb_extension` binary **must** be compiled against
DuckDB v1.5 headers. Extension ABI is version-locked — a v1.4-built
extension will be refused by a v1.5 DuckDB process.
