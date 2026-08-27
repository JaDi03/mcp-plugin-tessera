import { randomUUID } from "node:crypto";
import { TesseraPluginConfig, UsageMetadata } from "./types.js";
import { TesseraSidecarClient } from "./sidecar-client.js";
import { createCreatorRouter } from "./admin/router.js";
import type { Router } from "express";

/**
 * Result returned by a Tessera-wrapped tool execution.
 */
export interface WrappedToolResult<T> {
  result: T;
  usage: UsageMetadata;
}

/**
 * Universal wrapper for MCP tools and servers to enable per-second Tessera billing.
 */
export class TesseraMcpWrapper {
  private readonly client: TesseraSidecarClient;
  private readonly toolRates: Record<string, number>;

  constructor(config: TesseraPluginConfig = {}) {
    this.client = new TesseraSidecarClient(config);
    this.toolRates = config.toolRates || {};
  }

  /**
   * Wraps an individual MCP tool execution handler with automatic session lifecycle management.
   */
  public wrapTool<TArgs, TResult>(
    toolName: string,
    handler: (args: TArgs) => Promise<TResult>,
    rateOverride?: number
  ): (args: TArgs, callerUserId?: string) => Promise<WrappedToolResult<TResult>> {
    const ratePerSecond =
      rateOverride ?? this.toolRates[toolName] ?? this.client.getDefaultRate();

    return async (args: TArgs, callerUserId?: string): Promise<WrappedToolResult<TResult>> => {
      const startMs = Date.now();
      const userId = callerUserId || `agent_${randomUUID().slice(0, 8)}`;

      // Notify Tessera of session start
      this.client
        .startSession({
          userId,
          resourceId: toolName,
          ratePerSecond,
          metadata: { toolName, startMs: String(startMs) },
        })
        .catch(() => {});

      try {
        const result = await handler(args);
        const endMs = Date.now();

        // Notify Tessera of session stop
        this.client.stopSession(userId).catch(() => {});

        const durationSeconds = Math.max(
          parseFloat(((endMs - startMs) / 1000).toFixed(3)),
          0.001
        );
        const costUsd = parseFloat((durationSeconds * ratePerSecond).toFixed(6));

        return {
          result,
          usage: {
            duration_seconds: durationSeconds,
            rate_usd_per_second: ratePerSecond,
            cost_usd: costUsd,
          },
        };
      } catch (err) {
        // Ensure session stops on error
        this.client.stopSession(userId).catch(() => {});
        throw err;
      }
    };
  }

  /**
   * Returns the Tessera sidecar client.
   */
  public getClient(): TesseraSidecarClient {
    return this.client;
  }

  /**
   * Creates an Express router hosting the Creator Portal and Claim APIs.
   */
  public createAdminRouter(): Router {
    return createCreatorRouter(this.client);
  }
}

/**
 * Helper factory function to instantiate a Tessera MCP Wrapper.
 */
export function createTesseraWrapper(config: TesseraPluginConfig = {}): TesseraMcpWrapper {
  return new TesseraMcpWrapper(config);
}
