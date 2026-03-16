-- startup.sql
-- Run with: duckdb -unsigned -init startup.sql [database.db]
--
-- The -unsigned flag is required to load the oracle extension.
-- allow_unsigned_extensions cannot be set via SQL in v1.5+; it must be
-- passed as a CLI flag.

-- Load your locally-built oracle extension (adjust path)
LOAD 'oracle';

-- Attach Oracle — update DSN to your environment
ATTACH '' AS oracle (TYPE oracle, SECRET my_oracle_secret);

-- ui_remote_url is not available in DuckDB v1.5.0.
-- Remove this comment block once a version that supports it is released.

-- Start the HTTP server on the default port 4213
-- The browser will NOT be opened automatically (we control the UI)
CALL start_ui_server();

SELECT 'DuckDB UI server ready on http://localhost:4213' AS status;
