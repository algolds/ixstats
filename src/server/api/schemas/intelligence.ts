import { z } from "zod";

export const classificationSchema = z.enum([
  "PUBLIC",
  "RESTRICTED",
  "CONFIDENTIAL",
  "SECRET",
  "TOP_SECRET",
]);

export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]);

export const actionTypeSchema = z.enum([
  "infrastructure_boost",
  "security_review",
  "education_expansion",
  "trade_mission",
  "diplomatic_outreach",
  "economic_stimulus",
  "policy_implementation",
  "emergency_response",
  "schedule_meeting",
  "create_policy",
  "strategic_planning",
]);

export const cabinetMeetingSchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  scheduledDate: z
    .union([z.date(), z.string().datetime(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  attendees: z.array(z.string()).optional(),
  agenda: z.array(z.string()).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
});

export const quickActionSchema = z.object({
  countryId: z.string(),
  actionType: actionTypeSchema,
  parameters: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())])
    )
    .optional(),
  priority: prioritySchema.optional().default("NORMAL"),
  notes: z.string().optional(),
});

export const diplomaticMessageSchema = z.object({
  channelId: z.string(),
  fromCountryId: z.string(),
  fromCountryName: z.string(),
  toCountryId: z.string().optional(),
  toCountryName: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1),
  classification: classificationSchema.default("PUBLIC"),
  priority: prioritySchema.default("NORMAL"),
  encrypted: z.boolean().default(false),
});

export const securityThreatSchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  category: z.enum(["cyber", "terrorism", "military", "economic", "infrastructure", "political"]),
  status: z.enum(["active", "monitoring", "resolved", "dismissed"]).default("active"),
  detectedDate: z.date().default(() => new Date()),
  source: z.string().optional(),
});

export const strategicPlanSchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  objectives: z.array(z.string()),
  timeframe: z.enum(["short_term", "medium_term", "long_term"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["planning", "active", "completed", "paused", "cancelled"]).default("planning"),
  targetMetrics: z
    .array(
      z.object({
        metric: z.string(),
        currentValue: z.number(),
        targetValue: z.number(),
        deadline: z.date(),
      })
    )
    .optional(),
});

export const economicPolicySchema = z.object({
  countryId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  category: z.enum(["fiscal", "monetary", "trade", "investment", "labor", "infrastructure"]),
  impact: z
    .object({
      gdpGrowthProjection: z.number().optional(),
      unemploymentImpact: z.number().optional(),
      inflationImpact: z.number().optional(),
      budgetImpact: z.number().optional(),
    })
    .optional(),
  status: z
    .enum(["draft", "proposed", "under_review", "approved", "rejected", "implemented"])
    .default("draft"),
  proposedBy: z.string(),
  proposedDate: z.date().default(() => new Date()),
});
