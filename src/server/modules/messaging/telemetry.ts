/**
 * Privacy-Safe Messaging Telemetry (Plan 163)
 *
 * Records surface usage for deprecation tracking and health telemetry.
 *
 * CRITICAL PRIVACY INVARIANT:
 * NEVER records message content, subjects, attachments, participant IDs,
 * conversation IDs, message IDs, or user auth tokens.
 */

import type { TelemetryPayload, TelemetryLogger } from "./contracts";

class ConsoleTelemetryLogger implements TelemetryLogger {
  logEvent(payload: TelemetryPayload): void {
    // Structured minimal logging
    const { surface, procedure, authenticated, success, durationMs } = payload;
    if (process.env.NODE_ENV !== "test" || process.env.DEBUG_TELEMETRY === "true") {
      console.log(
        JSON.stringify({
          type: "messaging_telemetry",
          surface,
          procedure,
          authenticated,
          success,
          durationMs: durationMs ?? 0,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

export const defaultTelemetryLogger: TelemetryLogger = new ConsoleTelemetryLogger();

/**
 * Record a messaging operation event safely.
 */
export function recordMessagingTelemetry(
  payload: TelemetryPayload,
  logger: TelemetryLogger = defaultTelemetryLogger
): void {
  try {
    // Sanitization filter — ensure no extra keys leak into payload
    const safePayload: TelemetryPayload = {
      surface: payload.surface,
      procedure: payload.procedure,
      authenticated: Boolean(payload.authenticated),
      success: Boolean(payload.success),
      durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
    };

    logger.logEvent(safePayload);
  } catch (err) {
    // Telemetry failure must never disrupt request execution
    console.warn("[MessagingTelemetry] Failed to record event:", err);
  }
}
