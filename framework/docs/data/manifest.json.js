// Observable Framework data loader: outputs manifest_raw.json to stdout.
// Re-runs automatically when manifest_raw.json changes (mtime-based cache).

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const raw = join(dirname(fileURLToPath(import.meta.url)), "manifest_raw.json");

process.stdout.write(
  existsSync(raw)
    ? readFileSync(raw)
    : Buffer.from(JSON.stringify({ datasets: {} }))
);
