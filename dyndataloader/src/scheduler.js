// scheduler.js — runs ETL on a configurable interval.

import { runEtl } from "./etl.js";

let intervalHandle = null;

export function startScheduler() {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? "60000", 10);

  if (isNaN(intervalMs) || intervalMs < 1000) {
    console.error("[scheduler] POLL_INTERVAL_MS must be >= 1000ms");
    process.exit(1);
  }

  console.log(`[scheduler] Starting — interval: ${intervalMs}ms`);

  intervalHandle = setInterval(async () => {
    console.log("[scheduler] Tick — running ETL");
    try {
      await runEtl();
    } catch (err) {
      console.error("[scheduler] ETL error:", err.message);
    }
  }, intervalMs);
}

export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[scheduler] Stopped");
  }
}
