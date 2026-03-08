// index.js — Express sidecar entry point.
// Exposes: GET /health, POST /refresh[/:dataset][?full=true]

import "dotenv/config";
import express from "express";
import { runEtl } from "./etl.js";
import { startScheduler } from "./scheduler.js";

const app = express();
app.use(express.json());

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireBearer(req, res, next) {
  const token = process.env.BEARER_TOKEN;
  if (!token) return next();

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

// Refresh all datasets  (?full=true forces full history re-pull)
app.post(
  "/refresh",
  requireBearer,
  conflictGuard("__all__"),
  async (req, res) => {
    try {
      const full = req.query.full === "true";
      const triggered = await runEtl(null, { full });
      res.json({ triggered, full, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Refresh a single dataset  (?full=true forces full history re-pull)
app.post(
  "/refresh/:dataset",
  requireBearer,
  (req, res, next) => conflictGuard(req.params.dataset)(req, res, next),
  async (req, res) => {
    try {
      const full = req.query.full === "true";
      const triggered = await runEtl(req.params.dataset, { full });
      res.json({ triggered, full, timestamp: new Date().toISOString() });
    } catch (err) {
      const status = err.message.startsWith("Dataset not found") ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  }
);

// ── Server bootstrap ─────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3001", 10);

startScheduler();

app.listen(PORT, () => {
  console.log(`[sidecar] Listening on http://localhost:${PORT}`);
});
