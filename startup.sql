-- startup.sql
-- Run with: duckdb -init startup.sql [database.db]
--
-- Requires duckdb v1.5+ with allow_unsigned_extensions
-- so the ui_remote_url override works.

SET allow_unsigned_extensions = true;

-- Load your locally-built oracle extension (adjust path)
LOAD '/path/to/duckdb_oracle.duckdb_extension';

-- Attach Oracle — update DSN to your environment
ATTACH 'user/password@//oracle-host:1521/MYDB' AS oracle (TYPE oracle);

-- Point the UI asset proxy at Observable Framework dev server
-- (only active during local dev; comment out for production)
SET ui_remote_url = 'http://localhost:3000';

-- Start the HTTP server on the default port 4213
-- The browser will NOT be opened automatically (we control the UI)
CALL start_ui_server();

SELECT 'DuckDB UI server ready on http://localhost:4213' AS status;
