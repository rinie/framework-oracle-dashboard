// index.js — Express sidecar entry point.
// Exposes: GET /health, POST /refresh, POST /refresh/:dataset, WS /data

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { attachWebSocket } from "./broadcaster.js";
import { startScheduler, triggerRefresh } from "./scheduler.js";

const app = express();
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireBearer(req, res, next) {
  const token = process.env.BEARER_TOKEN;
  if (!token) return next(); // no token configured = open (dev only)

  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── In-flight guard (409) ────────────────────────────────────────────────────

const inFlight = new Set();

function conflictGuard(key) {
  return (req, res, next) => {
    if (inFlight.has(key)) {
      return res.status(409).json({ error: "Refresh already in progress", dataset: key });
    }
    inFlight.add(key);
    res.on("finish", () => inFlight.delete(key));
    next();
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Refresh all datasets
app.post(
  "/refresh",
  requireBearer,
  conflictGuard("__all__"),
  async (req, res) => {
    try {
      const triggered = await triggerRefresh();
      res.json({ triggered, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Refresh a single dataset
app.post(
  "/refresh/:dataset",
  requireBearer,
  (req, res, next) => conflictGuard(req.params.dataset)(req, res, next),
  async (req, res) => {
    try {
      const triggered = await triggerRefresh(req.params.dataset);
      res.json({ triggered, timestamp: new Date().toISOString() });
    } catch (err) {
      const status = err.message.startsWith("Dataset not found") ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  }
);

// ── Server bootstrap ─────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const server = createServer(app);

attachWebSocket(server);
startScheduler();

server.listen(PORT, () => {
  console.log(`[sidecar] Listening on http://localhost:${PORT}`);
  console.log(`[sidecar] WebSocket on  ws://localhost:${PORT}/data`);
});
