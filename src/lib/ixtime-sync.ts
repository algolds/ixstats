/**
 * IxTime Synchronization System
 *
 * This module ensures synchronization between IxStats, Discord bot, and any other
 * systems that use IxTime. It provides centralized time management with accuracy
 * verification and automatic drift correction.
 */

import { IxTime } from "./ixtime";
import { IxTimeAccuracyVerifier } from "./ixtime-accuracy";

export interface SyncTarget {
  id: string;
  name: string;
  endpoint: string;
  type: "discord-bot" | "external-service" | "client";
  priority: "critical" | "high" | "medium" | "low";
  lastSync: number | null;
  syncInterval: number; // milliseconds
  isHealthy: boolean;
  lastError: string | null;
}

export interface SyncStatus {
  masterTime: number;
  target: string;
  targetTime: number;
  drift: number; // milliseconds
  accuracy: number; // percentage
  status: "synced" | "drift" | "error";
  lastSyncAttempt: number;
}

export interface MasterTimeState {
  currentIxTime: number;
  currentRealTime: number;
  multiplier: number;
  isPaused: boolean;
  hasOverrides: boolean;
  accuracy: number;
  epoch: {
    realWorld: number;
    inGame: number;
    speedChange: number;
  };
  transitions: {
    lastTransition: number;
    nextTransition: number | null;
    currentPeriod: "4x" | "2x" | "custom";
  };
}

export class IxTimeSyncManager {
  private static instance: IxTimeSyncManager;
  private syncTargets: Map<string, SyncTarget> = new Map();
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private masterState: MasterTimeState | null = null;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  // Drift tolerance settings
  private static readonly DRIFT_WARNING_THRESHOLD = 1000; // 1 second
  private static readonly DRIFT_CRITICAL_THRESHOLD = 5000; // 5 seconds
  private static readonly ACCURACY_THRESHOLD = 99.99; // 99.99%

  // Default sync targets
  private static readonly DEFAULT_TARGETS: Omit<
    SyncTarget,
    "lastSync" | "isHealthy" | "lastError"
  >[] = [
    {
      id: "discord-bot",
      name: "Discord Time Bot",
      endpoint: process.env.IXTIME_BOT_URL || "http://localhost:3001",
      type: "discord-bot",
      priority: "critical",
      syncInterval: 30000, // 30 seconds
    },
    // Note: MediaWiki integration removed as it doesn't support IxTime synchronization
    // MediaWiki operates independently and doesn't need time sync
  ];

  private constructor() {
    this.initializeDefaultTargets();
  }

  public static getInstance(): IxTimeSyncManager {
    if (!IxTimeSyncManager.instance) {
      IxTimeSyncManager.instance = new IxTimeSyncManager();
    }
    return IxTimeSyncManager.instance;
  }

  private initializeDefaultTargets(): void {
    for (const target of IxTimeSyncManager.DEFAULT_TARGETS) {
      this.syncTargets.set(target.id, {
        ...target,
        lastSync: null,
        isHealthy: true,
        lastError: null,
      });
    }
  }

  public addSyncTarget(target: Omit<SyncTarget, "lastSync" | "isHealthy" | "lastError">): void {
    this.syncTargets.set(target.id, {
      ...target,
      lastSync: null,
      isHealthy: true,
      lastError: null,
    });
  }

  public async checkTargetHealth(targetId: string): Promise<{
    available: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const target = this.syncTargets.get(targetId);
    if (!target) {
      return { available: false, error: "Target not found" };
    }

    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const endpoint =
        target.type === "discord-bot" ? `${target.endpoint}/health` : `${target.endpoint}/status`;

      const response = await fetch(endpoint, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok && response.status !== 404) {
        return {
          available: false,
          error: `HTTP ${response.status}`,
          responseTime,
        };
      }

      return { available: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return { available: false, error: "Timeout", responseTime };
        }
        if (error.message.includes("fetch")) {
          return { available: false, error: "Network unreachable", responseTime };
        }
        return { available: false, error: error.message, responseTime };
      }
      return { available: false, error: "Unknown error", responseTime };
    }
  }

  public removeSyncTarget(targetId: string): void {
    this.syncTargets.delete(targetId);
    this.syncStatuses.delete(targetId);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    console.log("[IxTime Sync] Starting synchronization manager...");
    this.isRunning = true;

    // Update master state
    await this.updateMasterState();

    // Perform initial sync of all targets
    await this.syncAllTargets();

    // Start periodic sync
    this.syncInterval = setInterval(async () => {
      await this.updateMasterState();
      await this.syncAllTargets();
    }, 15000); // Check every 15 seconds

    console.log("[IxTime Sync] Synchronization manager started");
  }

  public stop(): void {
    if (!this.isRunning) return;

    console.log("[IxTime Sync] Stopping synchronization manager...");
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    console.log("[IxTime Sync] Synchronization manager stopped");
  }

  private async updateMasterState(): Promise<void> {
    const accuracyStatus = IxTimeAccuracyVerifier.getAccuracyStatus();

    this.masterState = {
      currentIxTime: IxTime.getCurrentIxTime(),
      currentRealTime: Date.now(),
      multiplier: IxTime.getTimeMultiplier(),
      isPaused: IxTime.isPaused(),
      hasOverrides: !IxTime.isMultiplierNatural() || false, // Add this method to IxTime if missing
      accuracy: accuracyStatus.accuracy,
      epoch: {
        realWorld: IxTime.getRealWorldEpoch(),
        inGame: IxTime.getInGameEpoch(),
        speedChange: new Date("2025-07-27T00:00:00.000Z").getTime(),
      },
      transitions: {
        lastTransition: new Date("2025-07-27T00:00:00.000Z").getTime(),
        nextTransition: null, // No planned transitions currently
        currentPeriod: IxTime.getDefaultMultiplier() === 4 ? "4x" : "2x",
      },
    };
  }

  private async syncAllTargets(): Promise<void> {
    const syncPromises: Promise<void>[] = [];

    for (const [targetId, target] of this.syncTargets) {
      const now = Date.now();
      const shouldSync = !target.lastSync || now - target.lastSync >= target.syncInterval;

      if (shouldSync) {
        syncPromises.push(this.syncTarget(targetId));
      }
    }

    await Promise.allSettled(syncPromises);
  }

  private async syncTarget(targetId: string): Promise<void> {
    const target = this.syncTargets.get(targetId);
    if (!target || !this.masterState) return;

    try {
      const syncStatus = await this.performSync(target);
      this.syncStatuses.set(targetId, syncStatus);

      // Update target health
      target.isHealthy = syncStatus.status !== "error";
      target.lastSync = Date.now();
      target.lastError = syncStatus.status === "error" ? "Sync failed" : null;

      // Log significant drift
      if (Math.abs(syncStatus.drift) > IxTimeSyncManager.DRIFT_WARNING_THRESHOLD) {
        console.warn(
          `[IxTime Sync] Significant drift detected for ${target.name}: ${syncStatus.drift}ms`
        );

        // Auto-correct critical drift for critical targets
        if (
          target.priority === "critical" &&
          Math.abs(syncStatus.drift) > IxTimeSyncManager.DRIFT_CRITICAL_THRESHOLD
        ) {
          await this.correctDrift(target, syncStatus);
        }
      }
    } catch (error) {
      console.error(`[IxTime Sync] Failed to sync ${target.name}:`, error);
      target.isHealthy = false;
      target.lastError = error instanceof Error ? error.message : "Unknown error";

      this.syncStatuses.set(targetId, {
        masterTime: this.masterState.currentIxTime,
        target: targetId,
        targetTime: 0,
        drift: 0,
        accuracy: 0,
        status: "error",
        lastSyncAttempt: Date.now(),
      });
    }
  }

  private async performSync(target: SyncTarget): Promise<SyncStatus> {
    if (!this.masterState) {
      throw new Error("Master state not initialized");
    }

    let targetTime = 0;
    let targetStatus: any = null;

    try {
      // Fetch current time from target
      if (target.type === "discord-bot") {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`${target.endpoint}/ixtime/status`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("IxTime endpoint not found - bot may not be running");
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          targetStatus = await response.json();

          if (!targetStatus || typeof targetStatus.ixTimeTimestamp !== "number") {
            throw new Error("Invalid response format from Discord bot");
          }

          targetTime = targetStatus.ixTimeTimestamp;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error) {
            if (fetchError.name === "AbortError") {
              throw new Error("Request timeout - Discord bot may be unresponsive");
            }
            if (fetchError.message.includes("fetch")) {
              throw new Error("Network error - Discord bot may be offline");
            }
          }
          throw fetchError;
        }
      } else if (target.type === "external-service") {
        // Handle external services with better error handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Longer timeout for external services

        try {
          const response = await fetch(`${target.endpoint}/ixtime/current`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("IxTime endpoint not available on external service");
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          targetTime = data.ixTimeTimestamp || data.currentIxTime;

          if (typeof targetTime !== "number") {
            throw new Error("Invalid time format from external service");
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error) {
            if (fetchError.name === "AbortError") {
              throw new Error("Request timeout - external service unresponsive");
            }
            if (fetchError.message.includes("fetch")) {
              throw new Error("Network error - external service unavailable");
            }
          }
          throw fetchError;
        }
      } else {
        throw new Error(`Unsupported target type: ${target.type}`);
      }

      // Calculate drift
      const drift = targetTime - this.masterState.currentIxTime;
      const accuracy = Math.max(0, 100 - Math.abs(drift) / 1000); // Rough accuracy calculation

      // Determine status
      let status: "synced" | "drift" | "error" = "synced";
      if (Math.abs(drift) > IxTimeSyncManager.DRIFT_WARNING_THRESHOLD) {
        status = "drift";
      }

      return {
        masterTime: this.masterState.currentIxTime,
        target: target.id,
        targetTime,
        drift,
        accuracy,
        status,
        lastSyncAttempt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to sync with ${target.name}: ${errorMessage}`);
    }
  }

  private async correctDrift(target: SyncTarget, syncStatus: SyncStatus): Promise<void> {
    console.log(
      `[IxTime Sync] Attempting to correct drift for ${target.name} (drift: ${syncStatus.drift}ms)...`
    );

    try {
      if (target.type === "discord-bot") {
        // Send time override to Discord bot
        const response = await fetch(`${target.endpoint}/ixtime/override`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ixTimeMs: this.masterState!.currentIxTime,
            multiplier: this.masterState!.multiplier,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log(`[IxTime Sync] Drift corrected for ${target.name}:`, result.message);
      }
    } catch (error) {
      console.error(`[IxTime Sync] Failed to correct drift for ${target.name}:`, error);
    }
  }

  // Public API methods
  public getMasterState(): MasterTimeState | null {
    return this.masterState;
  }

  public getSyncTargets(): SyncTarget[] {
    return Array.from(this.syncTargets.values());
  }

  public getSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  public getSyncStatus(targetId: string): SyncStatus | null {
    return this.syncStatuses.get(targetId) || null;
  }

  public async forceSyncTarget(targetId: string): Promise<SyncStatus | null> {
    const target = this.syncTargets.get(targetId);
    if (!target) return null;

    await this.syncTarget(targetId);
    return this.getSyncStatus(targetId);
  }

  public async forceSyncAll(): Promise<void> {
    await this.updateMasterState();
    await this.syncAllTargets();
  }

  public getHealthSummary(): {
    healthy: number;
    unhealthy: number;
    total: number;
    criticalIssues: string[];
  } {
    const targets = Array.from(this.syncTargets.values());
    const healthy = targets.filter((t) => t.isHealthy).length;
    const unhealthy = targets.filter((t) => !t.isHealthy).length;
    const criticalIssues: string[] = [];

    // Check for critical issues
    for (const status of this.syncStatuses.values()) {
      if (
        status.status === "error" ||
        Math.abs(status.drift) > IxTimeSyncManager.DRIFT_CRITICAL_THRESHOLD
      ) {
        const target = this.syncTargets.get(status.target);
        if (target && target.priority === "critical") {
          criticalIssues.push(
            `${target.name}: ${status.status === "error" ? "Connection failed" : `Critical drift: ${status.drift}ms`}`
          );
        }
      }
    }

    return {
      healthy,
      unhealthy,
      total: targets.length,
      criticalIssues,
    };
  }

  public async runComprehensiveSync(): Promise<{
    success: boolean;
    results: Array<{
      target: string;
      status: "success" | "warning" | "error";
      message: string;
      drift?: number;
    }>;
    overallHealth: "excellent" | "good" | "warning" | "critical";
  }> {
    await this.updateMasterState();
    await this.forceSyncAll();

    const results: Array<{
      target: string;
      status: "success" | "warning" | "error";
      message: string;
      drift?: number;
    }> = [];

    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const [targetId, target] of this.syncTargets) {
      const syncStatus = this.getSyncStatus(targetId);

      if (!syncStatus) {
        results.push({
          target: target.name,
          status: "error",
          message: "No sync status available",
        });
        errorCount++;
        continue;
      }

      if (syncStatus.status === "error") {
        results.push({
          target: target.name,
          status: "error",
          message: target.lastError || "Sync failed",
          drift: syncStatus.drift,
        });
        errorCount++;
      } else if (Math.abs(syncStatus.drift) > IxTimeSyncManager.DRIFT_WARNING_THRESHOLD) {
        results.push({
          target: target.name,
          status: "warning",
          message: `Drift detected: ${syncStatus.drift}ms`,
          drift: syncStatus.drift,
        });
        warningCount++;
      } else {
        results.push({
          target: target.name,
          status: "success",
          message: `Synced (drift: ${syncStatus.drift}ms)`,
          drift: syncStatus.drift,
        });
        successCount++;
      }
    }

    const total = results.length;
    let overallHealth: "excellent" | "good" | "warning" | "critical";

    if (errorCount === 0 && warningCount === 0) {
      overallHealth = "excellent";
    } else if (errorCount === 0 && warningCount / total < 0.2) {
      overallHealth = "good";
    } else if (errorCount / total < 0.1) {
      overallHealth = "warning";
    } else {
      overallHealth = "critical";
    }

    return {
      success: errorCount === 0,
      results,
      overallHealth,
    };
  }
}
