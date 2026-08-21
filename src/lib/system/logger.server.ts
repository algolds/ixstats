import "server-only";
import { db } from "~/server/db";
import { discordWebhook } from "../discord/webhook";
import {
  registerLogSinkProvider,
  logger,
  LogLevel,
  LogCategory,
  type LogEntry,
} from "./logger";

registerLogSinkProvider({
  persistLogs: async (entries: LogEntry[]) => {
    try {
      await db.systemLog.createMany({
        data: entries.map((entry) => ({
          level: LogLevel[entry.level],
          category: entry.category,
          message: entry.message,
          userId: entry.userId || null,
          countryId: entry.countryId || null,
          requestId: entry.requestId || null,
          traceId: entry.traceId || null,
          duration: entry.duration || null,
          errorName: entry.error?.name || null,
          errorMessage: entry.error?.message || null,
          errorStack: entry.error?.stack || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          component: entry.component || null,
          ip: entry.ip || null,
          userAgent: entry.userAgent ? entry.userAgent.slice(0, 500) : null,
          endpoint: entry.endpoint || null,
          method: entry.method || null,
          timestamp: entry.timestamp,
        })),
      });
    } catch (error) {
      console.error("[Logger] Database persistence failed:", error);
    }
  },
  sendToDiscord: async (entry: LogEntry) => {
    if (!discordWebhook) return;

    const levelName = LogLevel[entry.level];
    const emoji =
      entry.level === LogLevel.CRITICAL
        ? "🚨"
        : entry.level === LogLevel.ERROR
          ? "❌"
          : "⚠️";

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Category", value: entry.category, inline: true },
      { name: "Level", value: levelName, inline: true },
      { name: "Timestamp", value: entry.timestamp.toISOString(), inline: true },
    ];

    if (entry.userId) fields.push({ name: "User ID", value: entry.userId, inline: true });
    if (entry.countryId) fields.push({ name: "Country ID", value: entry.countryId, inline: true });
    if (entry.requestId) fields.push({ name: "Request ID", value: entry.requestId, inline: true });
    if (entry.duration)
      fields.push({ name: "Duration", value: `${entry.duration}ms`, inline: true });

    if (entry.error) {
      fields.push({
        name: "Error",
        value: `${entry.error.name}: ${entry.error.message}`.slice(0, 1024),
        inline: false,
      });

      if (entry.error.stack) {
        fields.push({
          name: "Stack Trace",
          value: entry.error.stack.slice(0, 1024),
          inline: false,
        });
      }
    }

    const color = entry.level === LogLevel.CRITICAL ? 0xff0000 : 0xff6600;

    await discordWebhook.send({
      embeds: [
        {
          title: `${emoji} ${levelName}: ${entry.message}`,
          description: entry.component ? `Component: ${entry.component}` : undefined,
          color,
          fields,
          timestamp: entry.timestamp.toISOString(),
          footer: {
            text: `IxStats ${process.env.NODE_ENV || "unknown"} environment`,
          },
        },
      ],
    });
  },
});

export { logger, LogLevel, LogCategory };
export type { LogEntry };
