// src/components/oracle-ws.js
// WebSocket client that receives Arrow IPC binary frames from the sidecar.
// Decodes the envelope (4-byte name length + name + Arrow IPC payload),
// dispatches data to registered dataset handlers, and auto-reconnects.

import { tableFromIPC } from "npm:apache-arrow";

const WS_URL = (() => {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/data`;
})();

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

// Map of dataset name → Set of callback functions
const handlers = new Map();

let ws = null;
let reconnectDelay = RECONNECT_DELAY_MS;
let manualClose = false;

/**
 * Register a handler for a named dataset.
 * Handler receives an Apache Arrow Table.
 *
 * @param {string} dataset
 * @param {(table: import("apache-arrow").Table) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribe(dataset, callback) {
  if (!handlers.has(dataset)) handlers.set(dataset, new Set());
  handlers.get(dataset).add(callback);

  if (!ws || ws.readyState === WebSocket.CLOSED) connect();

  return () => {
    handlers.get(dataset)?.delete(callback);
  };
}

function connect() {
  manualClose = false;
  console.log("[oracle-ws] Connecting to", WS_URL);
  ws = new WebSocket(WS_URL);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    console.log("[oracle-ws] Connected");
    reconnectDelay = RECONNECT_DELAY_MS;
    dispatchStatus("connected");
  });

  ws.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      // JSON control message (e.g. error)
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "error") {
          console.error(`[oracle-ws] Server error for ${msg.dataset}:`, msg.message);
          dispatchError(msg.dataset, msg.message);
        }
      } catch (_) {}
      return;
    }

    // Binary Arrow IPC envelope:
    // [4 bytes: name length LE] [name bytes] [Arrow IPC bytes]
    try {
      const buf = new DataView(event.data);
      const nameLen = buf.getUint32(0, true /* little-endian */);
      const nameBytes = new Uint8Array(event.data, 4, nameLen);
      const datasetName = new TextDecoder().decode(nameBytes);
      const arrowBytes = new Uint8Array(event.data, 4 + nameLen);

      const table = tableFromIPC(arrowBytes);
      console.log(`[oracle-ws] Received ${datasetName}: ${table.numRows} rows`);

      const datasetHandlers = handlers.get(datasetName);
      if (datasetHandlers) {
        for (const cb of datasetHandlers) cb(table);
      }
    } catch (err) {
      console.error("[oracle-ws] Failed to decode message:", err);
    }
  });

  ws.addEventListener("close", () => {
    console.warn("[oracle-ws] Disconnected");
    dispatchStatus("disconnected");
    if (!manualClose) scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.error("[oracle-ws] Error:", err);
  });
}

function scheduleReconnect() {
  console.log(`[oracle-ws] Reconnecting in ${reconnectDelay}ms...`);
  setTimeout(() => {
    if (!manualClose) connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

// Status handlers (dataset name "__status__")
function dispatchStatus(status) {
  const statusHandlers = handlers.get("__status__");
  if (statusHandlers) {
    for (const cb of statusHandlers) cb({ status });
  }
}

function dispatchError(dataset, message) {
  const errHandlers = handlers.get(`__error__:${dataset}`);
  if (errHandlers) {
    for (const cb of errHandlers) cb({ dataset, message });
  }
}

export function disconnect() {
  manualClose = true;
  ws?.close();
}
