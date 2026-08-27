// src/server/api/routers/admin/bot.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "~/server/api/trpc";
import { IxTime } from "~/lib/ixtime";
import type { AdminPageBotStatusView } from "~/types/ixstats";

export const adminBotRouter = createTRPCRouter({
  // Get bot status with health check
  getBotStatus: adminProcedure.query(async ({ ctx: _ctx }) => {
    try {
      const [botHealth, ixTimeStatus] = await Promise.all([
        IxTime.checkBotHealth(),
        IxTime.getStatus(),
      ]);

      const { botStatus: originalBotStatus, ...ixTimeStatusWithoutBot } = ixTimeStatus;

      const botStatus: AdminPageBotStatusView = {
        ...ixTimeStatusWithoutBot,
        botHealth,
        botStatus: originalBotStatus
          ? {
              ...originalBotStatus,
              botUser: originalBotStatus.botUser || undefined,
              realWorldTime: Date.now(),
              gameYear: IxTime.getCurrentGameYear(),
            }
          : null,
      };

      return botStatus;
    } catch (error) {
      console.error("Failed to get bot status:", error);
      // Return offline status if bot check fails
      return {
        currentRealTime: new Date().toISOString(),
        currentIxTime: new Date(IxTime.getCurrentIxTime()).toISOString(),
        formattedIxTime: IxTime.formatIxTime(IxTime.getCurrentIxTime(), true),
        multiplier: IxTime.getTimeMultiplier(),
        isPaused: IxTime.isPaused(),
        hasTimeOverride: false,
        botStatus: null,
        botHealth: {
          available: false,
          message: "Bot connection failed",
        },
      } as AdminPageBotStatusView;
    }
  }),

  // Get system configuration (includes all economic control parameters)

  // Save system configuration (all economic control parameters)

  // Set custom time via bot or local override

  // Bot control operations
  syncBot: adminProcedure.mutation(async ({ ctx: _ctx }) => {
    try {
      const result = await IxTime.syncWithBot();
      return result;
    } catch (error) {
      console.error("Failed to sync bot:", error);
      throw new Error("Failed to sync with Discord bot", { cause: error });
    }
  }),

  pauseBot: adminProcedure.mutation(async ({ ctx: _ctx }) => {
    try {
      const result = await IxTime.pauseBotTime();
      return result;
    } catch (error) {
      console.error("Failed to pause bot:", error);
      throw new Error("Failed to pause bot time", { cause: error });
    }
  }),

  resumeBot: adminProcedure.mutation(async ({ ctx: _ctx }) => {
    try {
      const result = await IxTime.resumeBotTime();
      return result;
    } catch (error) {
      console.error("Failed to resume bot:", error);
      throw new Error("Failed to resume bot time", { cause: error });
    }
  }),

  clearBotOverrides: adminProcedure.mutation(async ({ ctx: _ctx }) => {
    try {
      const result = await IxTime.clearBotOverrides();
      return result;
    } catch (error) {
      console.error("Failed to clear bot overrides:", error);
      throw new Error("Failed to clear bot overrides", { cause: error });
    }
  }),

  getBotProcesses: adminProcedure.query(async () => {
    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execPromise = promisify(exec);

      const { stdout } = await execPromise("pm2 jlist");
      const pm2List = JSON.parse(stdout);

      const whitelist = ["ixwiki-discord-bot", "ixstats-ixtwitter"];
      const result = whitelist.map((name) => {
        const proc = pm2List.find((p: any) => p.name === name);
        if (!proc) {
          return {
            name,
            status: "offline",
            cpu: 0,
            memory: 0,
            restarts: 0,
            uptime: 0,
          };
        }
        return {
          name,
          status: proc.pm2_env?.status || "offline",
          cpu: proc.monit?.cpu || 0,
          memory: proc.monit?.memory || 0,
          restarts: proc.pm2_env?.restart_time || 0,
          uptime: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : 0,
        };
      });

      return result;
    } catch (error) {
      console.error("Failed to get bot processes:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get bot processes",
      });
    }
  }),

  controlBotProcess: adminProcedure
    .input(
      z.object({
        processName: z.enum(["ixwiki-discord-bot", "ixstats-ixtwitter"]),
        action: z.enum(["start", "stop", "restart"]),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execPromise = promisify(exec);

        const cmd = `pm2 ${input.action} ${input.processName}`;
        await execPromise(cmd);

        return {
          success: true,
          message: `Process ${input.processName} ${input.action}ed successfully`,
        };
      } catch (error) {
        console.error(`Failed to ${input.action} bot process ${input.processName}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ${input.action} process: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getBotProcessLogs: adminProcedure
    .input(
      z.object({
        processName: z.enum(["ixwiki-discord-bot", "ixstats-ixtwitter"]),
        logType: z.enum(["out", "err"]),
      })
    )
    .query(async ({ input }) => {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execPromise = promisify(exec);

        const { stdout: jlistStdout } = await execPromise("pm2 jlist");
        const pm2List = JSON.parse(jlistStdout);
        const proc = pm2List.find((p: any) => p.name === input.processName);

        if (!proc) {
          throw new Error(`Process ${input.processName} not found in PM2`);
        }

        const logPath =
          input.logType === "out" ? proc.pm2_env?.pm_out_log_path : proc.pm2_env?.pm_err_log_path;
        if (!logPath) {
          throw new Error("Log path not configured in PM2");
        }

        const fs = await import("fs");
        if (!fs.existsSync(logPath)) {
          return [];
        }

        const content = fs.readFileSync(logPath, "utf-8");
        const lines = content.split("\n").filter(Boolean);
        return lines.slice(-50);
      } catch (error) {
        console.error(`Failed to read logs for ${input.processName}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to read process logs: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  getBotCommands: adminProcedure.query(async () => {
    try {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      const response = await fetch(`${botUrl}/bot/commands`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Bot API returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.commands || [];
    } catch (error) {
      console.error("Failed to fetch bot commands:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch bot commands: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  getBotRoles: adminProcedure.query(async () => {
    try {
      const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
      const response = await fetch(`${botUrl}/bot/roles`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`Bot API returned HTTP ${response.status}`);
      }
      const data = await response.json();
      return data.roles || [];
    } catch (error) {
      console.error("Failed to fetch bot roles:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to fetch bot roles: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),

  simulateBotCommand: adminProcedure
    .input(
      z.object({
        commandName: z.string(),
        subcommand: z.string().optional(),
        options: z.record(z.string(), z.any()).optional(),
        user: z
          .object({
            username: z.string().optional(),
            displayName: z.string().optional(),
            isAdmin: z.boolean().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const botUrl = process.env.IXTIME_BOT_URL || "http://localhost:3001";
        const response = await fetch(`${botUrl}/bot/commands/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          throw new Error(`Bot API returned HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Failed to simulate bot command:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to simulate bot command: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  // Sync with Discord bot
  syncWithBot: adminProcedure.mutation(async () => {
    try {
      const result = await IxTime.syncWithBot();
      return result;
    } catch (error) {
      console.error("Failed to sync with bot:", error);
      throw new Error("Failed to sync with Discord bot", { cause: error });
    }
  }),
});
