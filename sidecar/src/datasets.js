// datasets.js — define your Oracle queries here.
// Each dataset is pushed to WebSocket clients on schedule or manual refresh.
//
// Fields:
//   name    : unique string key, used as WS message type
//   sql     : Oracle SQL to execute via duckdb-oracle
//   enabled : set to false to disable without removing

export const datasets = [
  {
    name: "sales_summary",
    enabled: true,
    sql: `
      SELECT
        TRUNC(order_date, 'MM')  AS month,
        region,
        SUM(amount)              AS total_sales,
        COUNT(*)                 AS order_count
      FROM sales
      WHERE order_date >= ADD_MONTHS(SYSDATE, -12)
      GROUP BY TRUNC(order_date, 'MM'), region
      ORDER BY month, region
    `
  }
  // Add more datasets here:
  // {
  //   name: "inventory",
  //   enabled: true,
  //   sql: `SELECT ...`
  // }
];
