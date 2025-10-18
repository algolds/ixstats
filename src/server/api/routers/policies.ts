// src/server/api/routers/policies.ts
// Policy management and tracking system

import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { ActivityHooks } from "~/lib/activity-hooks";
import { notificationAPI } from "~/lib/notification-api";

export const policiesRouter = createTRPCRouter({
  // ==================== POLICY CRUD ====================

  createPolicy: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      userId: z.string(),
      name: z.string().min(1).max(200),
      description: z.string(),
      policyType: z.enum(['economic', 'social', 'diplomatic', 'infrastructure', 'governance']),
      category: z.string(),
      effectiveDate: z.date().optional(),
      expiryDate: z.date().optional(),
      targetMetrics: z.string().optional(),
      implementationCost: z.number().optional(),
      maintenanceCost: z.number().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium')
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.policy.create({
        data: {
          ...input,
          status: 'draft'
        }
      });
    }),

  getPolicies: publicProcedure
    .input(z.object({
      countryId: z.string(),
      category: z.enum(['economic', 'social', 'defense', 'education', 'healthcare', 'infrastructure', 'environment', 'trade', 'other']).optional(),
      status: z.enum(['draft', 'active', 'suspended', 'expired', 'repealed']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };
      if (input.category) where.category = input.category;
      if (input.status) where.status = input.status;

      return await ctx.db.policy.findMany({
        where,
        orderBy: [
          { priority: 'asc' },
          { effectiveDate: 'desc' }
        ]
      });
    }),

  getPolicy: publicProcedure
    .input(z.object({
      id: z.string()
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.policy.findUnique({
        where: { id: input.id },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: 'desc' }
          }
        }
      });
    }),

  updatePolicy: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['economic', 'social', 'defense', 'education', 'healthcare', 'infrastructure', 'environment', 'trade', 'other']).optional(),
      status: z.enum(['draft', 'active', 'suspended', 'expired', 'repealed']).optional(),
      expirationDate: z.date().optional(),
      targetMetric: z.string().optional(),
      targetValue: z.number().optional(),
      cost: z.number().optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.policy.update({
        where: { id },
        data
      });
    }),

  deletePolicy: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.policy.delete({
        where: { id: input.id }
      });
    }),

  activatePolicy: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: 'active',
          effectiveDate: new Date()
        }
      });

      // Get user for activity feed
      const user = await ctx.db.user.findFirst({
        where: { countryId: policy.countryId },
        select: { clerkUserId: true }
      });

      // Generate activity for policy activation (non-blocking)
      if (policy.category === 'economic') {
        await ActivityHooks.Economic.onTaxPolicyChange(
          policy.countryId,
          policy.category,
          policy.name,
          0, // Population affected - could be calculated
          user?.clerkUserId
        ).catch(err => console.error('Failed to create policy activity:', err));
      }

      // 🔔 Notify country about policy activation
      try {
        const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
          'critical': 'high',
          'high': 'high',
          'medium': 'medium',
          'low': 'low'
        };

        await notificationAPI.create({
          title: '📜 Policy Activated',
          message: `"${policy.name}" has been activated and is now in effect`,
          countryId: policy.countryId,
          category: 'policy',
          priority: priorityMap[policy.priority] || 'medium',
          type: 'success',
          href: '/mycountry/policies',
          source: 'policy-system',
          actionable: false,
          metadata: { policyId: policy.id, policyType: policy.policyType },
        });
      } catch (error) {
        console.error('[Policies] Failed to send policy activation notification:', error);
      }

      return policy;
    }),

  suspendPolicy: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: 'suspended'
        }
      });

      // 🔔 Notify country about policy suspension
      try {
        await notificationAPI.create({
          title: '⚠️ Policy Suspended',
          message: `"${policy.name}" has been suspended${input.reason ? `: ${input.reason}` : ''}`,
          countryId: policy.countryId,
          category: 'policy',
          priority: 'medium',
          type: 'warning',
          href: '/mycountry/policies',
          source: 'policy-system',
          actionable: true,
          metadata: { policyId: policy.id, reason: input.reason },
        });
      } catch (error) {
        console.error('[Policies] Failed to send policy suspension notification:', error);
      }

      return policy;
    }),

  repealPolicy: protectedProcedure
    .input(z.object({
      id: z.string(),
      reason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          status: 'repealed',
          expiryDate: new Date()
        }
      });

      // 🔔 Notify country about policy repeal
      try {
        await notificationAPI.create({
          title: '❌ Policy Repealed',
          message: `"${policy.name}" has been repealed and is no longer in effect${input.reason ? `: ${input.reason}` : ''}`,
          countryId: policy.countryId,
          category: 'policy',
          priority: 'high',
          type: 'error',
          href: '/mycountry/policies',
          source: 'policy-system',
          actionable: false,
          metadata: { policyId: policy.id, reason: input.reason },
        });
      } catch (error) {
        console.error('[Policies] Failed to send policy repeal notification:', error);
      }

      return policy;
    }),

  // ==================== POLICY EFFECT LOGS ====================

  logPolicyEffect: protectedProcedure
    .input(z.object({
      policyId: z.string(),
      metricName: z.string(),
      previousValue: z.number(),
      newValue: z.number(),
      changePercentage: z.number(),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.policyEffectLog.create({
        data: {
          policyId: input.policyId,
          appliedIxTime: Date.now() / 1000, // Convert to seconds
          effectType: 'periodic',
          actualEffect: JSON.stringify({
            metricName: input.metricName,
            previousValue: input.previousValue,
            newValue: input.newValue,
            changePercentage: input.changePercentage
          }),
          notes: input.notes
        }
      });
    }),

  getPolicyEffects: publicProcedure
    .input(z.object({
      policyId: z.string(),
      limit: z.number().min(1).max(100).default(50)
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.policyEffectLog.findMany({
        where: { policyId: input.policyId },
        orderBy: { appliedAt: 'desc' },
        take: input.limit
      });
    }),

  getPolicyEffectiveness: publicProcedure
    .input(z.object({
      policyId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.policyId },
        include: {
          policyEffectLog: {
            orderBy: { appliedAt: 'desc' }
          }
        }
      });

      if (!policy) {
        throw new Error('Policy not found');
      }

      // Parse effect logs to calculate effectiveness
      const effectLogs = policy.policyEffectLog.map(log => {
        try {
          return JSON.parse(log.actualEffect || '{}');
        } catch {
          return {};
        }
      });

      // Calculate effectiveness metrics
      const totalEffects = effectLogs.length;
      const positiveEffects = effectLogs.filter((e: any) => (e.changePercentage || 0) > 0).length;
      const negativeEffects = effectLogs.filter((e: any) => (e.changePercentage || 0) < 0).length;

      const averageChange = effectLogs.length > 0
        ? effectLogs.reduce((sum: number, e: any) => sum + (e.changePercentage || 0), 0) / effectLogs.length
        : 0;

      const recentEffects = effectLogs.slice(0, 10);
      const recentAverageChange = recentEffects.length > 0
        ? recentEffects.reduce((sum: number, e: any) => sum + (e.changePercentage || 0), 0) / recentEffects.length
        : 0;

      // Parse targetMetrics if it exists
      const targetMetrics = policy.targetMetrics ? JSON.parse(policy.targetMetrics) : null;
      const targetMet = targetMetrics
        ? recentEffects.some((e: any) =>
            targetMetrics[e.metricName] &&
            e.newValue >= targetMetrics[e.metricName]
          )
        : null;

      return {
        policy,
        effectiveness: {
          totalEffects,
          positiveEffects,
          negativeEffects,
          averageChange,
          recentAverageChange,
          targetMet,
          trend: recentAverageChange > averageChange ? 'improving' :
                 recentAverageChange < averageChange ? 'declining' : 'stable'
        }
      };
    }),

  // ==================== ACTIVITY SCHEDULES ====================

  scheduleActivity: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      policyId: z.string().optional(),
      activityType: z.enum(['meeting', 'review', 'implementation', 'assessment', 'other']),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      scheduledDate: z.date(),
      duration: z.number().optional(),
      participants: z.string().optional(),
      location: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Get userId from context - use clerk user id
      const userId = ctx.user?.clerkUserId;
      if (!userId) {
        throw new Error('Not authenticated');
      }

      return await ctx.db.activitySchedule.create({
        data: {
          countryId: input.countryId,
          userId: userId,
          activityType: input.activityType,
          title: input.title,
          description: input.description,
          scheduledDate: input.scheduledDate,
          duration: input.duration,
          status: 'scheduled',
          relatedIds: input.policyId ? JSON.stringify({ policyId: input.policyId }) : undefined,
          tags: input.participants ? JSON.stringify([input.participants]) : undefined,
          category: input.location
        }
      });
    }),

  getScheduledActivities: publicProcedure
    .input(z.object({
      countryId: z.string(),
      policyId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };
      if (input.policyId) where.policyId = input.policyId;
      if (input.status) where.status = input.status;
      if (input.startDate || input.endDate) {
        where.scheduledDate = {};
        if (input.startDate) where.scheduledDate.gte = input.startDate;
        if (input.endDate) where.scheduledDate.lte = input.endDate;
      }

      return await ctx.db.activitySchedule.findMany({
        where,
        orderBy: { scheduledDate: 'asc' }
      });
    }),

  updateActivity: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      scheduledDate: z.date().optional(),
      duration: z.number().optional(),
      status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
      participants: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.activitySchedule.update({
        where: { id },
        data
      });
    }),

  deleteActivity: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.activitySchedule.delete({
        where: { id: input.id }
      });
    }),

  // ==================== QUICK ACTION TEMPLATES ====================

  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().min(1),
      category: z.enum(['economic', 'social', 'defense', 'diplomatic', 'administrative', 'other']),
      actionType: z.enum(['policy', 'meeting', 'decision', 'communication', 'other']),
      defaultSettings: z.string().optional(), // JSON string of template data
      requiredFields: z.string().optional(), // JSON array of required field names
      estimatedDuration: z.string().optional(),
      recommendedFor: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.quickActionTemplate.create({
        data: input
      });
    }),

  getTemplates: publicProcedure
    .input(z.object({
      category: z.enum(['economic', 'social', 'defense', 'diplomatic', 'administrative', 'other']).optional(),
      actionType: z.enum(['policy', 'meeting', 'decision', 'communication', 'other']).optional()
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.category) where.category = input.category;
      if (input.actionType) where.actionType = input.actionType;

      return await ctx.db.quickActionTemplate.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      });
    }),

  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['economic', 'social', 'defense', 'diplomatic', 'administrative', 'other']).optional(),
      actionType: z.enum(['policy', 'meeting', 'decision', 'communication', 'other']).optional(),
      defaultSettings: z.string().optional(),
      requiredFields: z.string().optional(),
      estimatedDuration: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return await ctx.db.quickActionTemplate.update({
        where: { id },
        data
      });
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({
      id: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.quickActionTemplate.delete({
        where: { id: input.id }
      });
    }),

  // ==================== ENHANCED POLICY INTEGRATION ====================

  // Save policy selections from builder
  savePolicySelections: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      policySelections: z.array(z.object({
        name: z.string(),
        description: z.string(),
        policyType: z.string(),
        category: z.string(),
        relatedGovernmentComponents: z.array(z.string()).optional(),
        relatedEconomicComponents: z.array(z.string()).optional(),
        relatedTaxComponents: z.array(z.string()).optional(),
        gdpEffect: z.number().default(0),
        employmentEffect: z.number().default(0),
        inflationEffect: z.number().default(0),
        taxRevenueEffect: z.number().default(0),
        implementationCost: z.number().default(0),
        maintenanceCost: z.number().default(0),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      
      for (const policyData of input.policySelections) {
        const policy = await ctx.db.policy.create({
          data: {
            countryId: input.countryId,
            userId: ctx.auth.userId,
            name: policyData.name,
            description: policyData.description,
            policyType: policyData.policyType,
            category: policyData.category,
            relatedGovernmentComponents: policyData.relatedGovernmentComponents 
              ? JSON.stringify(policyData.relatedGovernmentComponents) 
              : null,
            relatedEconomicComponents: policyData.relatedEconomicComponents 
              ? JSON.stringify(policyData.relatedEconomicComponents) 
              : null,
            relatedTaxComponents: policyData.relatedTaxComponents 
              ? JSON.stringify(policyData.relatedTaxComponents) 
              : null,
            gdpEffect: policyData.gdpEffect,
            employmentEffect: policyData.employmentEffect,
            inflationEffect: policyData.inflationEffect,
            taxRevenueEffect: policyData.taxRevenueEffect,
            implementationCost: policyData.implementationCost,
            maintenanceCost: policyData.maintenanceCost,
            status: 'draft',
            priority: 'medium',
          },
        });
        results.push(policy);
      }

      return results;
    }),

  // Calculate real-time policy effects
  calculatePolicyEffects: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const policies = await ctx.db.policy.findMany({
        where: { 
          countryId: input.countryId, 
          status: 'active' 
        },
      });

      const effects = {
        totalGdpEffect: 0,
        totalEmploymentEffect: 0,
        totalInflationEffect: 0,
        totalTaxRevenueEffect: 0,
        totalImplementationCost: 0,
        totalMaintenanceCost: 0,
        policyCount: policies.length,
        calculatedEffects: {} as Record<string, any>,
      };

      for (const policy of policies) {
        effects.totalGdpEffect += policy.gdpEffect;
        effects.totalEmploymentEffect += policy.employmentEffect;
        effects.totalInflationEffect += policy.inflationEffect;
        effects.totalTaxRevenueEffect += policy.taxRevenueEffect;
        effects.totalImplementationCost += policy.implementationCost;
        effects.totalMaintenanceCost += policy.maintenanceCost;

        // Calculate real-time effects based on country data
        const calculatedEffects = await calculateRealTimePolicyEffects(policy, input.countryId, ctx.db);
        effects.calculatedEffects[policy.id] = calculatedEffects;
      }

      return effects;
    }),

  // Get policies by selected atomic components
  getPoliciesByComponents: publicProcedure
    .input(z.object({
      countryId: z.string(),
      governmentComponents: z.array(z.string()).optional(),
      economicComponents: z.array(z.string()).optional(),
      taxComponents: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { countryId: input.countryId };

      // Filter policies based on component relationships
      if (input.governmentComponents?.length || input.economicComponents?.length || input.taxComponents?.length) {
        where.OR = [];

        if (input.governmentComponents?.length) {
          where.OR.push({
            relatedGovernmentComponents: {
              not: null,
            },
          });
        }

        if (input.economicComponents?.length) {
          where.OR.push({
            relatedEconomicComponents: {
              not: null,
            },
          });
        }

        if (input.taxComponents?.length) {
          where.OR.push({
            relatedTaxComponents: {
              not: null,
            },
          });
        }
      }

      return await ctx.db.policy.findMany({
        where,
        orderBy: { priority: 'asc' },
      });
    }),

  // Recalculate all policy effects
  recalculateAllPolicyEffects: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const policies = await ctx.db.policy.findMany({
        where: { 
          countryId: input.countryId, 
          status: 'active' 
        },
      });

      const results = [];

      for (const policy of policies) {
        // Calculate new effects based on current country state
        const newEffects = await calculateRealTimePolicyEffects(policy, input.countryId, ctx.db);
        
        // Update policy with calculated effects
        const updated = await ctx.db.policy.update({
          where: { id: policy.id },
          data: {
            calculatedEffects: JSON.stringify(newEffects),
            lastRecalculated: new Date(),
          },
        });

        results.push(updated);
      }

      return results;
    }),
});

// Helper function to calculate real-time policy effects
async function calculateRealTimePolicyEffects(policy: any, countryId: string, db: any) {
  // Get current country data
  const country = await db.country.findUnique({
    where: { id: countryId },
  });

  if (!country) {
    return {};
  }

  // Calculate effects based on current country metrics
  const effects = {
    gdpMultiplier: 1 + (policy.gdpEffect / 100),
    employmentMultiplier: 1 + (policy.employmentEffect / 100),
    inflationMultiplier: 1 + (policy.inflationEffect / 100),
    taxRevenueMultiplier: 1 + (policy.taxRevenueEffect / 100),
    calculatedAt: new Date().toISOString(),
    baseValues: {
      currentGdp: country.currentTotalGdp,
      currentPopulation: country.currentPopulation,
      currentTaxRevenue: country.taxRevenueGDPPercent,
    },
  };

  return effects;
}
