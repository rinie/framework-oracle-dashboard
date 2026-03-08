// scheduler.js — runs pushAll on a configurable interval.

import { pushAll, pushDataset } from "./broadcaster.js";
import { datasets } from "./datasets.js";

let intervalHandle = null;

export function startScheduler() {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? "60000", 10);

  if (isNaN(intervalMs) || intervalMs < 1000) {
    console.error("[scheduler] POLL_INTERVAL_MS must be >= 1000ms");
    process.exit(1);
  }

  console.log(`[scheduler] Starting — interval: ${intervalMs}ms`);

  intervalHandle = setInterval(async () => {
    console.log("[scheduler] Tick — pushing all datasets");
    await pushAll();
  }, intervalMs);
}

export function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[scheduler] Stopped");
  }
}

/**
 * Trigger an immediate push for one or all datasets (used by POST /refresh).
 * Returns an array of dataset names that were triggered.
 */
export async function triggerRefresh(datasetName = null) {
  if (datasetName) {
    const dataset = datasets.find((d) => d.name === datasetName && d.enabled);
    if (!dataset) throw new Error(`Dataset not found or disabled: ${datasetName}`);
    await pushDataset(dataset);
    return [datasetName];
  }

  await pushAll();
  return datasets.filter((d) => d.enabled).map((d) => d.name);
}
