---
title: Sales Summary
---

# Sales Summary

<div id="status-bar" class="status-bar status-connecting">Connecting to Oracle sidecar…</div>

```js
import { subscribe } from "./components/oracle-ws.js";

// ── Reactive state ────────────────────────────────────────────────────────────

const statusEl = document.getElementById("status-bar");

// Connection status
subscribe("__status__", ({ status }) => {
  statusEl.className = `status-bar status-${status}`;
  statusEl.textContent =
    status === "connected"
      ? "● Live — connected to Oracle sidecar"
      : "○ Disconnected — reconnecting…";
});

// Sales data — Mutable for reactivity
const salesData = Mutable([]);
subscribe("sales_summary", (table) => {
  salesData.value = table.toArray().map((row) => ({
    month: new Date(row.month),
    region: row.region,
    total_sales: Number(row.total_sales),
    order_count: Number(row.order_count)
  }));
});
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
// ── Sales over time (line chart) ──────────────────────────────────────────────

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
    Plot.crosshairX(salesData, {
      x: "month",
      y: "total_sales"
    })
  ]
})
```

```js
// ── Orders bar chart ──────────────────────────────────────────────────────────

Plot.plot({
  title: "Order Count by Month",
  width,
  height: 260,
  x: { type: "time", label: "Month" },
  y: { label: "Orders", grid: true },
  color: { legend: true },
  marks: [
    Plot.barY(salesData, {
      x: "month",
      y: "order_count",
      fill: "region",
      tip: true
    })
  ]
})
```

```js
// ── Data table ────────────────────────────────────────────────────────────────

Inputs.table(salesData, {
  columns: ["month", "region", "total_sales", "order_count"],
  header: {
    month: "Month",
    region: "Region",
    total_sales: "Total Sales",
    order_count: "Orders"
  },
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
.status-connecting { background: #fef3c7; color: #92400e; }
.status-connected  { background: #d1fae5; color: #065f46; }
.status-disconnected { background: #fee2e2; color: #991b1b; }

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
