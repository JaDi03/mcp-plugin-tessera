import crypto from "node:crypto";
import {
  TesseraPluginConfig,
  TesseraStartSessionPayload,
  CreatorBalanceResponse,
  CompleteWithdrawResponse,
} from "./types.js";

/**
 * Client communicating with the Tessera sidecar microservices.
 * Implements HMAC SHA-256 signed ingest identical to Tessera Jellyfin and PeerTube plugins.
 */
export class TesseraSidecarClient {
  private readonly sidecarUrl: string;
  private readonly webhookSecret: string;
  private readonly payoutWallet: string;
  private readonly defaultRate: number;

  constructor(config: TesseraPluginConfig = {}) {
    this.sidecarUrl = (
      config.sidecarUrl ||
      process.env.TESSERA_URL ||
      process.env.TESSERA_SERVER_URL ||
      "http://localhost:7878"
    ).replace(/\/$/, "");

    this.webhookSecret =
      config.webhookSecret ||
      process.env.TESSERA_SECRET ||
      process.env.TESSERA_INGEST_SECRET ||
      "";

    this.payoutWallet =
      config.payoutWallet ||
      process.env.TESSERA_PAYOUT_WALLET ||
      process.env.CREATOR_WALLET ||
      "";

    this.defaultRate =
      config.defaultRatePerSecond ??
      parseFloat(process.env.TESSERA_RATE_PER_SECOND || "0.002");
  }

  /**
   * Sends a signed HMAC request to the Tessera sidecar.
   */
  public async sendSignedIngest(
    path: string,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    if (!this.webhookSecret) {
      return { ok: false, status: 503, error: "Webhook secret not configured" };
    }

    const url = `${this.sidecarUrl}${path}`;
    const timestamp = String(Date.now());
    const nonce = crypto.randomBytes(16).toString("hex");
    const payload = JSON.stringify(body);

    const signature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${nonce}.${payload}`)
      .digest("hex");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tessera-Timestamp": timestamp,
          "X-Tessera-Nonce": nonce,
          "X-Tessera-Signature": signature,
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (response.ok) return { ok: true, status: response.status };
      const error = await response.text();
      return { ok: false, status: response.status, error };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[TesseraPlugin] Ingest to ${path} failed: ${msg}`);
      return { ok: false, status: 503, error: msg };
    }
  }

  /**
   * Starts a billing session in Tessera when an AI agent begins tool execution.
   */
  public async startSession(params: {
    userId: string;
    resourceId: string;
    ratePerSecond?: number;
    metadata?: Record<string, string>;
  }): Promise<{ ok: boolean; status: number; error?: string }> {
    const rate = (params.ratePerSecond ?? this.defaultRate).toString();
    const payload: TesseraStartSessionPayload = {
      userId: params.userId,
      resourceId: params.resourceId,
      ratePerSecond: rate,
      payoutAddress: this.payoutWallet,
      metadata: params.metadata,
    };

    return this.sendSignedIngest("/api/core/v1/sessions/start", payload as unknown as Record<string, unknown>);
  }

  /**
   * Stops an active billing session in Tessera when tool execution completes.
   */
  public async stopSession(userId: string): Promise<{ ok: boolean; status: number; error?: string }> {
    return this.sendSignedIngest("/api/core/v1/sessions/stop", { userId });
  }

  /**
   * Fetches the accumulated earnings balance for the creator payout wallet.
   */
  public async getCreatorBalance(): Promise<CreatorBalanceResponse> {
    const url = `${this.sidecarUrl}/api/core/creator/balance?wallet=${encodeURIComponent(
      this.payoutWallet
    )}`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          payoutAddress: this.payoutWallet,
          accumulatedBalanceUsdc: data.balanceUsdc || 0,
          totalSessionsServed: data.totalSessions || 0,
          totalDurationSeconds: data.totalDurationSeconds || 0,
          status: "active",
        };
      }
    } catch {
      // Fallback
    }

    return {
      payoutAddress: this.payoutWallet,
      accumulatedBalanceUsdc: 0,
      totalSessionsServed: 0,
      totalDurationSeconds: 0,
      status: "empty",
    };
  }

  /**
   * Triggers withdrawal/claim of accumulated earnings to the creator's EVM wallet.
   */
  public async completeWithdraw(amountUsdc?: number): Promise<CompleteWithdrawResponse> {
    const url = `${this.sidecarUrl}/api/core/creator/complete-withdraw`;
    const payload = {
      payoutAddress: this.payoutWallet,
      amountUsdc,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          transactionHash: data.txHash || data.transactionHash,
          withdrawnAmountUsdc: data.amount || amountUsdc,
          payoutAddress: this.payoutWallet,
        };
      }

      const errText = await response.text();
      return {
        success: false,
        payoutAddress: this.payoutWallet,
        error: `Withdrawal failed (${response.status}): ${errText}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        payoutAddress: this.payoutWallet,
        error: `Sidecar communication error: ${msg}`,
      };
    }
  }

  public getPayoutWallet(): string {
    return this.payoutWallet;
  }

  public getDefaultRate(): number {
    return this.defaultRate;
  }

  public getSidecarUrl(): string {
    return this.sidecarUrl;
  }

  public isRelayAssetFile(fileName: string): boolean {
    return (
      fileName === "paywall.bundle.js" ||
      fileName === "paywall.css" ||
      fileName === "creator-earnings.css"
    );
  }

  public async relayRequest(
    sidecarPathAndQuery: string,
    init: { method: string; contentType?: string; body?: string }
  ): Promise<{ status: number; contentType: string | null; body: Buffer }> {
    const path = sidecarPathAndQuery.startsWith("/")
      ? sidecarPathAndQuery
      : `/${sidecarPathAndQuery}`;
    const url = `${this.sidecarUrl}${path}`;
    const headers: Record<string, string> = {};
    if (init.contentType) headers["Content-Type"] = init.contentType;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        method: init.method,
        headers,
        body: init.body,
        signal: controller.signal,
      });
      const body = Buffer.from(await response.arrayBuffer());
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
