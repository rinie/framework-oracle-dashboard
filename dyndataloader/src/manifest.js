// manifest.js — read/write manifest_raw.json
// Named "raw" to avoid conflicting with the Observable Framework data loader
// that outputs manifest.json from this file.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../framework/docs/data");
const MANIFEST_PATH = join(DATA_DIR, "manifest_raw.json");

export function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { datasets: {} };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    return { datasets: {} };
  }
}

export function updateManifest(datasetName, { partitionsDir, ...info }) {
  mkdirSync(DATA_DIR, { recursive: true });
  const manifest = readManifest();
  manifest.datasets[datasetName] = {
    ...info,
    partitions: scanPartitions(partitionsDir),
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/** Returns sorted list of ym values found in the Hive partition directory. */
function scanPartitions(partitionsDir) {
  if (!partitionsDir || !existsSync(partitionsDir)) return [];
  return readdirSync(partitionsDir)
    .filter((d) => d.startsWith("ym="))
    .map((d) => d.slice(3))
    .sort();
}
