---
title: Sales Summary
---

# Sales Summary

<div id="status-bar" class="status-bar status-loading">Loading data…</div>

```js
// ── Manifest polling + Parquet loading ────────────────────────────────────────
// Polls /data/manifest.json every 30 s (served by the manifest.json.js data loader).
// When updatedAt changes, fetches /data/sales_summary.parquet (data loader combines
// all Hive partitions) and loads it into DuckDB-WASM.

const POLL_MS = 30_000;
const salesData = Mutable([]);
const statusEl = document.getElementById("status-bar");
let lastUpdatedAt = null;

async function fetchSalesData() {
  let manifest;
  try {
    const r = await fetch(`/_file/data/manifest_raw.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
    manifest = await r.json();
  } catch (e) {
    statusEl.className = "status-bar status-error";
    statusEl.textContent = "⚠ Cannot reach manifest — is the dyndataloader running?";
    return;
  }

  const info = manifest.datasets?.sales_summary;
  if (!info) {
    statusEl.className = "status-bar status-error";
    statusEl.textContent = "⚠ No data yet — trigger POST /refresh on the dyndataloader";
    return;
  }

  if (info.updatedAt === lastUpdatedAt) return; // no change
  lastUpdatedAt = info.updatedAt;

  statusEl.className = "status-bar status-loading";
  statusEl.textContent = "↻ Loading…";

  try {
    const buf = await fetch(`/_file/data/sales_summary.parquet?t=${Date.now()}`).then((r) => r.arrayBuffer());
    const db = await DuckDBClient.of({});
    await db._db.registerFileBuffer("sales_summary.parquet", new Uint8Array(buf));
    const result = await db.query("SELECT * FROM read_parquet('sales_summary.parquet')");

    salesData.value = result.toArray().map((row) => ({
      month: new Date(row.month),
      region: String(row.region),
      total_sales: Number(row.total_sales),
      order_count: Number(row.order_count),
    }));

    const mode = info.mode === "incremental" ? " · incremental" : "";
    statusEl.className = "status-bar status-ok";
    statusEl.textContent = `● ${info.rows.toLocaleString()} rows — ${new Date(info.updatedAt).toLocaleString()}${mode}`;
  } catch (e) {
    console.error("[poll] Failed to load Parquet:", e);
    statusEl.className = "status-bar status-error";
    statusEl.textContent = `⚠ Failed to load data: ${e.message}`;
  }
}

await fetchSalesData();
{
  const id = setInterval(() => fetchSalesData().catch(console.error), POLL_MS);
  invalidation.then(() => clearInterval(id));
}
```

```js
// ── KPI cards ─────────────────────────────────────────────────────────────────

const totalSales = d3.sum(salesData, (d) => d.total_sales);
const totalOrders = d3.sum(salesData, (d) => d.order_count);
const regions = [...new Set(salesData.map((d) => d.region))].length;
```

<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-label">Total Sales</div>
    <div class="kpi-value">${totalSales.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Total Orders</div>
    <div class="kpi-value">${totalOrders.toLocaleString()}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Regions</div>
    <div class="kpi-value">${regions}</div>
  </div>
</div>

```js
// ── Sales over time ────────────────────────────────────────────────────────────

Plot.plot({
  title: "Monthly Sales by Region",
  width,
  height: 320,
  x: { type: "time", label: "Month" },
  y: { label: "Total Sales", grid: true },
  color: { legend: true },
  marks: [
    Plot.lineY(salesData, {
      x: "month",
      y: "total_sales",
      stroke: "region",
      curve: "monotone-x",
      strokeWidth: 2
    }),
    Plot.dotY(salesData, {
      x: "month",
      y: "total_sales",
      fill: "region",
      r: 3
    }),
    Plot.crosshairX(salesData, { x: "month", y: "total_sales" })
  ]
})
```

```js
// ── Order count by month ───────────────────────────────────────────────────────

Plot.plot({
  title: "Order Count by Month",
  width,
  height: 260,
  x: { type: "time", label: "Month" },
  y: { label: "Orders", grid: true },
  color: { legend: true },
  marks: [
    Plot.rectY(salesData, {
      x1: (d) => d.month,
      x2: (d) => new Date(d.month.getFullYear(), d.month.getMonth() + 1),
      y: "order_count",
      fill: "region",
      tip: true
    })
  ]
})
```

```js
// ── Data table ─────────────────────────────────────────────────────────────────

Inputs.table(salesData, {
  columns: ["month", "region", "total_sales", "order_count"],
  header: { month: "Month", region: "Region", total_sales: "Total Sales", order_count: "Orders" },
  format: {
    month: (d) => d.toLocaleDateString("en-US", { year: "numeric", month: "short" }),
    total_sales: (d) => d.toLocaleString("en-US", { maximumFractionDigits: 0 })
  },
  sort: "month",
  reverse: true
})
```

<style>
.status-bar {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  font-weight: 500;
}
.status-loading { background: #fef3c7; color: #92400e; }
.status-ok      { background: #d1fae5; color: #065f46; }
.status-error   { background: #fee2e2; color: #991b1b; }

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.kpi-card {
  background: var(--theme-background-alt, #f8f8f8);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--theme-foreground-faintest, #e5e5e5);
}
.kpi-label { font-size: 0.8rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
</style>
