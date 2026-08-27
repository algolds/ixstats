/**
 * Quick Actions Decisions Router (Plan 163 / Plan 191)
 *
 * Handles cabinet meeting decisions, action item assignments,
 * policy enactment from decisions, and CountryEventSpine consequence execution.
 */

import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { CountryEventSpine } from "~/lib/activity";
import { applyPolicyEffect } from "~/lib/policies";

export const quickActionsDecisionsRouter = createTRPCRouter({
  /**
   * Create a meeting decision
   */
  createDecision: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        agendaItemId: z.string().optional(),
        title: z.string(),
        description: z.string(),
        decisionType: z.enum([
          "policy_approval",
          "budget_allocation",
          "appointment",
          "directive",
          "resolution",
          "other",
        ]),
        impact: z.enum(["high", "medium", "low"]).optional(),
        createPolicy: z.boolean().default(false),
        policyData: z
          .object({
            name: z.string(),
            policyType: z.enum([
              "economic",
              "social",
              "diplomatic",
              "infrastructure",
              "governance",
            ]),
            category: z.string(),
            gdpEffect: z.number().default(0),
            employmentEffect: z.number().default(0),
            inflationEffect: z.number().default(0),
            taxRevenueEffect: z.number().default(0),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.cabinetMeeting.findUnique({
        where: { id: input.meetingId },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Meeting not found",
        });
      }

      // Create the decision
      const decision = await ctx.db.meetingDecision.create({
        data: {
          meetingId: input.meetingId,
          agendaItemId: input.agendaItemId ?? null,
          title: input.title,
          description: input.description,
          decisionType: input.decisionType,
          impact: input.impact ?? null,
          implementationStatus: "pending",
        },
      });

      // If creating a policy from this decision
      let policy = null;
      if (input.createPolicy && input.policyData) {
        const currentIxTime = IxTime.getCurrentIxTime();

        policy = await ctx.db.policy.create({
          data: {
            countryId: meeting.countryId,
            userId: meeting.userId,
            name: input.policyData.name,
            description: input.description,
            policyType: input.policyData.policyType,
            category: input.policyData.category,
            status: "proposed",
            priority: "medium",
            proposedDate: new Date(),
            proposedIxTime: currentIxTime,
            gdpEffect: input.policyData.gdpEffect,
            employmentEffect: input.policyData.employmentEffect,
            inflationEffect: input.policyData.inflationEffect,
            taxRevenueEffect: input.policyData.taxRevenueEffect,
          },
        });

        // Link policy to decision
        await ctx.db.meetingDecision.update({
          where: { id: decision.id },
          data: { relatedPolicyId: policy.id },
        });
      }

      return {
        decision,
        policy,
        success: true,
        message: "Decision recorded successfully",
      };
    }),

  /**
   * Create action items from a meeting
   */
  createActionItems: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
        items: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            assignedTo: z.string().optional(),
            dueDate: z.date().optional(),
            priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
            category: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actionItems = await Promise.all(
        input.items.map((item) => {
          const dueIxTime = item.dueDate ? IxTime.convertToIxTime(item.dueDate.getTime()) : null;

          return ctx.db.meetingActionItem.create({
            data: {
              meetingId: input.meetingId,
              title: item.title,
              description: item.description ?? null,
              assignedTo: item.assignedTo ?? null,
              dueDate: item.dueDate ?? null,
              dueIxTime,
              priority: item.priority,
              category: item.category ?? null,
              tags: item.tags ? JSON.stringify(item.tags) : null,
              status: "pending",
            },
          });
        })
      );

      return {
        actionItems,
        success: true,
        message: `${actionItems.length} action items created`,
      };
    }),

  /**
   * Implement a cabinet decision and apply systemic consequences
   */
  implementDecision: protectedProcedure
    .input(
      z.object({
        decisionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const decision = await ctx.db.meetingDecision.findUnique({
        where: { id: input.decisionId },
        include: { meeting: true },
      });

      if (!decision) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Decision not found",
        });
      }

      if (decision.implementationStatus === "implemented") {
        return { success: true, message: "Decision already implemented" };
      }

      // Parse estimatedEffect (consequences JSON)
      let consequences: any[] = [];
      if (decision.estimatedEffect) {
        try {
          consequences = JSON.parse(decision.estimatedEffect);
        } catch (e) {
          console.error("[Meetings] Failed to parse estimatedEffect JSON:", e);
        }
      }

      // Apply consequences via spine
      let applied = [];
      if (consequences.length > 0) {
        applied = await CountryEventSpine.recordCountryEvent({
          db: ctx.db,
          countryId: decision.meeting.countryId,
          sourceType: "decision",
          sourceId: decision.id,
          description: `Implemented cabinet decision: "${decision.title}"`,
          consequences: consequences.map((c: any) => ({
            targetModel: c.targetModel,
            targetField: c.targetField,
            operation: c.operation || "add",
            value: c.value,
            effectType: c.effectType,
            durationDays: c.durationDays,
          })),
        });
      } else {
        // Record a trace in ledger even if no consequences are present
        await CountryEventSpine.recordCountryEvent({
          db: ctx.db,
          countryId: decision.meeting.countryId,
          sourceType: "decision",
          sourceId: decision.id,
          description: `Implemented cabinet decision: "${decision.title}"`,
        });
      }

      // Update implementationStatus to "implemented"
      const updatedDecision = await ctx.db.meetingDecision.update({
        where: { id: decision.id },
        data: {
          implementationStatus: "implemented",
        },
      });

      // If there is a related policy, we can activate it
      let activatedPolicy = null;
      if (decision.relatedPolicyId) {
        const policy = await ctx.db.policy.findUnique({
          where: { id: decision.relatedPolicyId },
        });

        if (policy && policy.status !== "active") {
          // Check budget
          const structure = await ctx.db.governmentStructure.findUnique({
            where: { countryId: policy.countryId },
          });

          if (structure && structure.totalBudget >= policy.implementationCost) {
            // Deduct budget
            if (policy.implementationCost > 0) {
              await ctx.db.governmentStructure.update({
                where: { countryId: policy.countryId },
                data: { totalBudget: { decrement: policy.implementationCost } },
              });

              // Log budget deduction consequence via Event Spine
              await CountryEventSpine.recordCountryEvent({
                db: ctx.db,
                countryId: policy.countryId,
                sourceType: "policy",
                sourceId: policy.id,
                description: `Enacted policy "${policy.name}" via decision: Cost of ${policy.implementationCost} deducted from treasury`,
                consequences: [
                  {
                    targetModel: "GovernmentStructure",
                    targetField: "totalBudget",
                    operation: "subtract",
                    value: policy.implementationCost,
                  },
                ],
              });
            }

            activatedPolicy = await ctx.db.policy.update({
              where: { id: policy.id },
              data: {
                status: "active",
                effectiveDate: new Date(),
              },
            });

            // Make the policy real in the simulation
            await applyPolicyEffect(ctx.db, activatedPolicy).catch((err) =>
              console.error("[Meetings] Failed to apply policy effect on decision resolve:", err)
            );
          }
        }
      }

      return {
        success: true,
        decision: updatedDecision,
        policy: activatedPolicy,
        appliedConsequencesCount: applied.length,
      };
    }),
});
