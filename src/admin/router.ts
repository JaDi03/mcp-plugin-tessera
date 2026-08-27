import express, { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TesseraSidecarClient } from "../sidecar-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates the Express router handling Creator Portal UI and API endpoints.
 */
export function createCreatorRouter(client: TesseraSidecarClient): Router {
  const router = express.Router();
  router.use(express.json());

  // Static assets for the Creator Portal
  const publicDir = path.resolve(__dirname, "public");
  router.use(express.static(publicDir));

  /**
   * GET /api/balance - Returns current creator accumulated earnings
   */
  router.get("/api/balance", async (_req, res) => {
    try {
      const balance = await client.getCreatorBalance();
      res.json(balance);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  /**
   * POST /api/withdraw - Triggers a claim/withdrawal to the creator's payout wallet
   */
  router.post("/api/withdraw", async (req, res) => {
    try {
      const amount = req.body.amount ? parseFloat(req.body.amount) : undefined;
      const result = await client.completeWithdraw(amount);
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  /**
   * GET /api/config - Returns creator payout wallet and sidecar status
   */
  router.get("/api/config", (_req, res) => {
    res.json({
      payoutWallet: client.getPayoutWallet(),
      defaultRatePerSecond: client.getDefaultRate(),
      sidecarUrl: client.getSidecarUrl(),
    });
  });

  return router;
}
