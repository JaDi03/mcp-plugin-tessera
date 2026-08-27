/**
 * Configuration options for the Tessera MCP Plugin connector.
 */
export interface TesseraPluginConfig {
  /** URL of the running Tessera Sidecar (default: "http://localhost:7878") */
  sidecarUrl?: string;
  /** Webhook secret key for HMAC SHA-256 signing (must match sidecar TESSERA_INGEST_SECRET) */
  webhookSecret?: string;
  /** EVM payout wallet address of the MCP creator to receive usage earnings */
  payoutWallet?: string;
  /** Default billing rate per second in USDC (default: 0.002) */
  defaultRatePerSecond?: number;
  /** Per-tool billing rate overrides in USDC (e.g. { "deep_web_research": 0.005 }) */
  toolRates?: Record<string, number>;
}

/**
 * Usage metadata injected into MCP tool execution results.
 */
export interface UsageMetadata {
  /** Execution duration measured in seconds */
  duration_seconds: number;
  /** Applicable rate in USD per second */
  rate_usd_per_second: number;
  /** Total cost incurred in USD */
  cost_usd: number;
}

/**
 * Ingest payload for starting a billing session in Tessera.
 */
export interface TesseraStartSessionPayload {
  userId: string;
  resourceId: string;
  ratePerSecond: string;
  payoutAddress: string;
  metadata?: Record<string, string>;
}

/**
 * Creator earnings balance response from the Tessera sidecar.
 */
export interface CreatorBalanceResponse {
  payoutAddress: string;
  accumulatedBalanceUsdc: number;
  totalSessionsServed: number;
  totalDurationSeconds: number;
  status: "active" | "empty" | "error";
}

/**
 * Creator withdrawal execution response.
 */
export interface CompleteWithdrawResponse {
  success: boolean;
  transactionHash?: string;
  withdrawnAmountUsdc?: number;
  payoutAddress: string;
  error?: string;
}
