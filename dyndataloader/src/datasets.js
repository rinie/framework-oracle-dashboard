// datasets.js — define your Oracle queries here.
//
// Fields:
//   name            : unique string key
//   sql             : full-history SQL (used on first run or POST /refresh?full=true)
//   sqlIncremental  : current-month-only SQL (used on subsequent scheduled runs)
//   enabled         : set to false to disable without removing

export const datasets = [
  {
    name: "sales_summary",
    enabled: true,

    // Full history — runs once on first ETL or on forced full refresh
    sql: `
      SELECT
        TRUNC(dtcreate, 'MM')  AS month,
        ordertype              AS region,
        COUNT(*)               AS total_sales,
        COUNT(distinct conumber)               AS order_count
      FROM cohist
      WHERE dtcreate >= ADD_MONTHS(SYSDATE, -36) and ordershippedmoment is not null
      GROUP BY TRUNC(dtcreate, 'MM'), ordertype
      ORDER BY month, region
    `,

    // Incremental — current month only, overwrites today's Hive partition
    sqlIncremental: `
      SELECT
        TRUNC(dtcreate, 'MM')  AS month,
        ordertype              AS region,
        COUNT(*)               AS total_sales,
        COUNT(distinct conumber)               AS order_count
      FROM cohist
      WHERE dtcreate >= TRUNC(SYSDATE, 'MM') and ordershippedmoment is not null
      GROUP BY TRUNC(dtcreate, 'MM'), ordertype
      ORDER BY month, region
    `
  }
  // Add more datasets here
];
