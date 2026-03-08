// broadcaster.js — manages WebSocket clients and pushes Arrow IPC payloads.

import { WebSocketServer } from "ws";
import { queryToArrow } from "./db.js";
import { datasets } from "./datasets.js";

let wss = null;
const clients = new Set();

export function attachWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/data" });

  // Send a heartbeat ping every 20 s so clients can detect dead connections
  // through the proxy (which may not propagate close events reliably).
  const PING_MSG = JSON.stringify({ type: "ping" });
  setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(PING_MSG);
    }
  }, 20_000);

  wss.on("connection", (ws, req) => {
    console.log(`[ws] Client connected (${clients.size + 1} total)`);
    clients.add(ws);

    // Send all datasets immediately on connect
    pushAll([ws]);

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[ws] Client disconnected (${clients.size} remaining)`);
    });

    ws.on("error", (err) => {
      console.error("[ws] Client error:", err.message);
      clients.delete(ws);
    });
  });

  console.log("[ws] WebSocket server attached at /data");
}

/**
 * Push all enabled datasets to a list of clients (default: all connected).
 */
export async function pushAll(targets = null) {
  const activeClients = targets ?? [...clients];
  if (activeClients.length === 0) return;

  const enabledDatasets = datasets.filter((d) => d.enabled);

  for (const dataset of enabledDatasets) {
    await pushDataset(dataset, activeClients);
  }
}

/**
 * Push a single dataset to a list of clients.
 */
export async function pushDataset(dataset, targets = null) {
  const activeClients = targets ?? [...clients];
  if (activeClients.length === 0) return;

  console.log(`[ws] Querying dataset: ${dataset.name}`);

  let arrowBuffer;
  try {
    arrowBuffer = await queryToArrow(dataset.sql);
  } catch (err) {
    console.error(`[ws] Query error for ${dataset.name}:`, err.message);

    // Push an error message to clients so they can display feedback
    const errMsg = JSON.stringify({
      type: "error",
      dataset: dataset.name,
      message: err.message,
      timestamp: new Date().toISOString()
    });

    for (const ws of activeClients) {
      if (ws.readyState === ws.OPEN) ws.send(errMsg);
    }
    return;
  }

  // Message envelope: 4-byte header (dataset name length) + name bytes + Arrow IPC bytes
  const nameBytes = Buffer.from(dataset.name, "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(nameBytes.length, 0);
  const envelope = Buffer.concat([header, nameBytes, Buffer.from(arrowBuffer)]);

  console.log(`[ws] Pushing ${dataset.name} (${envelope.length} bytes) to ${activeClients.length} client(s)`);

  for (const ws of activeClients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(envelope, { binary: true });
    }
  }
}
