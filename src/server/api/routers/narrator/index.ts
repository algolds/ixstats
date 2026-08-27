import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { getFlavorText } from "~/lib/narrator/flavorization";
import { DEFAULT_FLAVOR_SYSTEM_PROMPT } from "~/lib/narrator/constants";
import { buildCanonContext, formatCanonContext } from "~/lib/narrator/canon-context";
import { queryLLM } from "~/lib/narrator/client";

export const narratorRouter = createTRPCRouter({
  getFlavorText: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(["issue", "policy", "decision"]),
        title: z.string(),
        description: z.string(),
        countryId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check global system configuration toggle
        const globalSetting = await ctx.db.systemConfig.findUnique({
          where: { key: "narrator:flavor:enabled" },
        });

        if (globalSetting?.value === "false") {
          return { flavorText: "" };
        }

        const flavorText = await getFlavorText({
          id: input.id,
          type: input.type,
          title: input.title,
          description: input.description,
          countryId: input.countryId,
          db: ctx.db as any,
        });

        return { flavorText };
      } catch (error) {
        console.error("[narrator-router] Failed to get flavor text:", error);
        return { flavorText: "" };
      }
    }),

  getNarratorSettings: adminProcedure.query(async ({ ctx }) => {
    try {
      const configs = await ctx.db.systemConfig.findMany({
        where: {
          key: {
            in: [
              "narrator:flavor:enabled",
              "narrator:llm:provider",
              "narrator:llm:apiKey",
              "narrator:llm:apiUrl",
              "narrator:llm:modelName",
              "narrator:llm:temperature",
              "narrator:llm:systemPrompt",
              "narrator:llm:reasoning",
            ],
          },
        },
      });

      return {
        enabled: configs.find((c) => c.key === "narrator:flavor:enabled")?.value !== "false",
        provider: configs.find((c) => c.key === "narrator:llm:provider")?.value || "",
        apiKey: configs.find((c) => c.key === "narrator:llm:apiKey")?.value || "",
        apiUrl: configs.find((c) => c.key === "narrator:llm:apiUrl")?.value || "",
        modelName: configs.find((c) => c.key === "narrator:llm:modelName")?.value || "",
        temperature: configs.find((c) => c.key === "narrator:llm:temperature")?.value
          ? parseFloat(configs.find((c) => c.key === "narrator:llm:temperature")!.value)
          : 0.7,
        systemPrompt: configs.find((c) => c.key === "narrator:llm:systemPrompt")?.value || "",
        reasoning: configs.find((c) => c.key === "narrator:llm:reasoning")?.value === "true",
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to load narrator settings",
      });
    }
  }),

  saveNarratorSettings: adminProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        provider: z.string().optional(),
        apiKey: z.string().optional(),
        apiUrl: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.number().optional(),
        systemPrompt: z.string().optional(),
        reasoning: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const keys = [
          { key: "narrator:flavor:enabled", value: String(input.enabled) },
          { key: "narrator:llm:provider", value: input.provider || "" },
          { key: "narrator:llm:apiKey", value: input.apiKey || "" },
          { key: "narrator:llm:apiUrl", value: input.apiUrl || "" },
          { key: "narrator:llm:modelName", value: input.modelName || "" },
          {
            key: "narrator:llm:temperature",
            value: input.temperature !== undefined ? String(input.temperature) : "",
          },
          { key: "narrator:llm:systemPrompt", value: input.systemPrompt || "" },
          { key: "narrator:llm:reasoning", value: String(input.reasoning === true) },
        ];

        for (const item of keys) {
          await ctx.db.systemConfig.upsert({
            where: { key: item.key },
            update: { value: item.value },
            create: {
              key: item.key,
              value: item.value,
              description: "AI Narrator configuration key",
            },
          });
        }

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to save narrator settings",
        });
      }
    }),

  getPlaygroundEvents: adminProcedure
    .input(
      z.object({
        countryId: z.string(),
        type: z.enum(["issue", "policy", "decision"]),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (input.type === "issue") {
          const issues = await ctx.db.nationalIssue.findMany({
            where: { countryId: input.countryId },
            select: { id: true, title: true, description: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
          return issues.map((x) => ({ id: x.id, title: x.title, description: x.description }));
        } else if (input.type === "policy") {
          const policies = await ctx.db.policy.findMany({
            where: { countryId: input.countryId },
            select: { id: true, name: true, description: true },
            orderBy: { effectiveDate: "desc" },
            take: 50,
          });
          return policies.map((x) => ({
            id: x.id,
            title: x.name,
            description: x.description || "",
          }));
        } else {
          // decision type
          const decisions = await ctx.db.meetingDecision.findMany({
            where: { meeting: { countryId: input.countryId } },
            select: { id: true, title: true, description: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
          return decisions.map((x) => ({ id: x.id, title: x.title, description: x.description }));
        }
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch playground events",
        });
      }
    }),

  testFlavorize: adminProcedure
    .input(
      z.object({
        type: z.enum(["issue", "policy", "decision"]),
        title: z.string(),
        description: z.string(),
        countryId: z.string().optional(),
        customSystemPrompt: z.string().optional(),
        sandboxMode: z.boolean().default(false),
        sandboxMetricsJson: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Live country → real canon context (mirrors production). Sandbox mode
        // keeps the manual JSON path so admins can probe hypothetical states.
        let canonContext = "";
        if (input.sandboxMode && input.sandboxMetricsJson) {
          let metrics: any;
          try {
            metrics = JSON.parse(input.sandboxMetricsJson);
          } catch {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid JSON format in sandbox metrics",
            });
          }
          const approval = metrics.approval ?? metrics.publicApproval ?? 50;
          const stability =
            metrics.stability ?? metrics.stabilityScore ?? metrics.politicalStability ?? 50;
          canonContext = `[Canon Context — the ONLY facts you may reference]
Nation: ${metrics.name || "the nation"}
Leader: ${metrics.leader || "the sovereign"}
Government: ${metrics.governmentType || "government"}
Public approval: ${approval}%
Political stability: ${stability}%`;
        } else if (input.countryId) {
          const canon = await buildCanonContext(ctx.db as any, input.countryId);
          if (canon) canonContext = formatCanonContext(canon);
        }

        const userPrompt = `
${canonContext}

[Event Details]
Event Type: ${input.type.toUpperCase()}
Title: ${input.title}
Details: ${input.description}

Rewrite this event into an immersive Paradox Interactive-style narrative introduction. Adapt the mood and tone to the canon facts above (tense or chaotic if stability or approval is low; prosperous or grand if stability is high and the economy is strong). Where it fits naturally, reference the nation's real recent history or relationships from the Canon Context for continuity.
Reference ONLY facts from the [Canon Context]. Do not invent leaders, places, wars, or lore. Limit the narrative to 2-3 immersive sentences (approx. 50-70 words).
`;

        // Resolve system prompt: override > saved config > default
        let systemPrompt = input.customSystemPrompt || "";
        if (!systemPrompt) {
          const systemConfig = await ctx.db.systemConfig.findUnique({
            where: { key: "narrator:llm:systemPrompt" },
          });
          systemPrompt = systemConfig?.value || DEFAULT_FLAVOR_SYSTEM_PROMPT;
        }

        // Query the LLM directly (bypassing cache)
        const generated = await queryLLM(systemPrompt, userPrompt);
        if (!generated) {
          return { flavorText: "" };
        }

        // Clean quotes
        let cleaned = generated.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          cleaned = cleaned.substring(1, cleaned.length - 1).trim();
        }

        return { flavorText: cleaned };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to test flavorizer",
        });
      }
    }),

  getCacheStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const where = {
        service: "custom",
        identifier: {
          startsWith: "flavor:",
        },
      };

      const [total, agg] = await Promise.all([
        ctx.db.externalApiCache.count({ where }),
        ctx.db.externalApiCache.aggregate({
          where,
          _avg: { hitCount: true },
          _sum: { hitCount: true },
        }),
      ]);

      return {
        total,
        averageHitCount: Math.round((agg._avg.hitCount ?? 0) * 10) / 10,
        totalHits: agg._sum.hitCount ?? 0,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch cache statistics",
      });
    }
  }),

  clearCache: adminProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ctx.db.externalApiCache.deleteMany({
        where: {
          service: "custom",
          identifier: {
            startsWith: "flavor:",
          },
        },
      });

      return { success: true, count: result.count };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to clear narrator cache",
      });
    }
  }),
});

export type NarratorRouter = typeof narratorRouter;
