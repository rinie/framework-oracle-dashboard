// observablehq.config.js
export default {
  title: "Oracle Dashboard",
  root: "src",
  output: "dist",
  pages: [
    { name: "Overview", path: "/" },
    { name: "Oracle Tables", path: "/oracle-tables" },
  ],
  // Allow data loaders to reach the local duckdb-ui server
  // and pass through the Oracle table env var
  // Set these in your shell or .env before running `npm run dev`
  // DUCKDB_UI_URL=http://localhost:4213
  // ORACLE_SAMPLE_TABLE=oracle.EMPLOYEES
};
