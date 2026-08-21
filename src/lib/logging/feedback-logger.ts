/**
 * Feedback Logger System
 *
 * Persists all user feedback submissions to disk under logs/feedback:
 * - logs/feedback/feedback.jsonl (Structured machine-readable log)
 * - logs/feedback/feedback-YYYY-MM-DD.log (Daily chronological human-readable log)
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface FeedbackLogEntry {
  timestamp: string;
  userId: string;
  username?: string;
  countryId?: string | null;
  feedbackType: string;
  message: string;
  url: string;
  userAgent: string;
  logsCount?: number;
  logs?: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export class FeedbackLogger {
  private static readonly LOG_DIR = join(process.cwd(), "logs", "feedback");
  private static initialized = false;

  private static ensureLogDir(): void {
    if (this.initialized) return;
    try {
      if (!existsSync(this.LOG_DIR)) {
        mkdirSync(this.LOG_DIR, { recursive: true });
      }
      this.initialized = true;
    } catch (err) {
      console.error("[FeedbackLogger] Failed to create feedback log directory:", err);
    }
  }

  public static logFeedback(entry: FeedbackLogEntry): void {
    try {
      this.ensureLogDir();

      const timestamp = entry.timestamp || new Date().toISOString();
      const dateStr = timestamp.split("T")[0]!;

      // 1. JSON Lines entry
      const jsonlFile = join(this.LOG_DIR, "feedback.jsonl");
      const jsonLine = JSON.stringify({ ...entry, timestamp }) + "\n";
      appendFileSync(jsonlFile, jsonLine, "utf8");

      // 2. Daily human-readable log file
      const dailyLogFile = join(this.LOG_DIR, `feedback-${dateStr}.log`);
      const textEntry =
        `[${timestamp}] [${entry.feedbackType.toUpperCase()}] User: ${entry.username || entry.userId} (${entry.userId})\n` +
        `  URL: ${entry.url}\n` +
        `  User-Agent: ${entry.userAgent}\n` +
        `  Message: ${entry.message}\n` +
        (entry.logs && entry.logs.length > 0
          ? `  Attached Logs (${entry.logs.length}):\n` +
            entry.logs
              .slice(-10)
              .map((l) => `    [${l.timestamp}] [${l.type}] ${l.message}`)
              .join("\n") +
            "\n"
          : "") +
        `--------------------------------------------------------------------------------\n`;

      appendFileSync(dailyLogFile, textEntry, "utf8");
    } catch (err) {
      console.error("[FeedbackLogger] Error saving feedback to log files:", err);
    }
  }
}
