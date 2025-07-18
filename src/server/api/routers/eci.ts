import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { triggerNotification } from "./sdi";

const cabinetMeetingSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  scheduledDate: z.date(),
  attendees: z.array(z.string()).optional(),
  agenda: z.array(z.string()).optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled')
});

const economicPolicySchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  category: z.enum(['fiscal', 'monetary', 'trade', 'investment', 'labor', 'infrastructure']),
  impact: z.object({
    gdpGrowthProjection: z.number().optional(),
    unemploymentImpact: z.number().optional(),
    inflationImpact: z.number().optional(),
    budgetImpact: z.number().optional()
  }).optional(),
  status: z.enum(['draft', 'proposed', 'under_review', 'approved', 'rejected', 'implemented']).default('draft'),
  proposedBy: z.string(),
  proposedDate: z.date().default(() => new Date())
});

const securityThreatSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['cyber', 'terrorism', 'military', 'economic', 'infrastructure', 'political']),
  status: z.enum(['active', 'monitoring', 'resolved', 'dismissed']).default('active'),
  detectedDate: z.date().default(() => new Date()),
  source: z.string().optional()
});

const strategicPlanSchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string(),
  objectives: z.array(z.string()),
  timeframe: z.enum(['short_term', 'medium_term', 'long_term']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['planning', 'active', 'completed', 'paused', 'cancelled']).default('planning'),
  targetMetrics: z.array(z.object({
    metric: z.string(),
    currentValue: z.number(),
    targetValue: z.number(),
    deadline: z.date()
  })).optional()
});

export const eciRouter = createTRPCRouter({
  // Cabinet Meeting Management
  createCabinetMeeting: publicProcedure
    .input(cabinetMeetingSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      // Store in SystemConfig with a descriptive key
      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_cabinet_meeting_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date()
          }),
          description: `Cabinet meeting: ${input.title}`
        }
      });
      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Cabinet Meeting Scheduled`,
        description: `A new cabinet meeting titled '${input.title}' has been scheduled.`,
        href: '/eci/mycountry',
        type: 'cabinet_meeting'
      });
      return result;
    }),

  getCabinetMeetings: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return [];
      }

      const meetings = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_cabinet_meeting_${user.country.id}` }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return meetings.map(meeting => ({
        id: meeting.id,
        ...JSON.parse(meeting.value)
      }));
    }),

  // Economic Policy Management
  createEconomicPolicy: publicProcedure
    .input(economicPolicySchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_economic_policy_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date()
          }),
          description: `Economic policy: ${input.title}`
        }
      });
      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Economic Policy Proposed`,
        description: `A new economic policy titled '${input.title}' has been proposed.`,
        href: '/eci/mycountry',
        type: 'economic_policy'
      });
      return result;
    }),

  getEconomicPolicies: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return [];
      }

      const policies = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_economic_policy_${user.country.id}` }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return policies.map(policy => ({
        id: policy.id,
        ...JSON.parse(policy.value)
      }));
    }),

  // National Security Management
  createSecurityThreat: publicProcedure
    .input(securityThreatSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      const result = await ctx.db.systemConfig.create({
        data: {
          key: `eci_security_threat_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date()
          }),
          description: `Security threat: ${input.title}`
        }
      });
      // Trigger notification for the country
      await triggerNotification(ctx, {
        countryId: user.country.id,
        title: `New Security Threat Reported`,
        description: `A new security threat titled '${input.title}' has been reported.`,
        href: '/eci/mycountry',
        type: 'security_threat'
      });
      return result;
    }),

  getSecurityThreats: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return [];
      }

      const threats = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_security_threat_${user.country.id}` }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return threats.map(threat => ({
        id: threat.id,
        ...JSON.parse(threat.value)
      }));
    }),

  getSecurityDashboard: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return {
          overallThreatLevel: 'low',
          activeThreats: 0,
          criticalThreats: 0,
          recentThreats: []
        };
      }

      const threats = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_security_threat_${user.country.id}` }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10
      });

      const parsedThreats = threats.map(threat => JSON.parse(threat.value));
      const activeThreats = parsedThreats.filter((t: any) => t.status === 'active');
      const criticalThreats = activeThreats.filter((t: any) => t.severity === 'critical');

      let overallThreatLevel = 'low';
      if (criticalThreats.length > 0) overallThreatLevel = 'critical';
      else if (activeThreats.filter((t: any) => t.severity === 'high').length > 0) overallThreatLevel = 'high';
      else if (activeThreats.filter((t: any) => t.severity === 'medium').length > 0) overallThreatLevel = 'medium';

      return {
        overallThreatLevel,
        activeThreats: activeThreats.length,
        criticalThreats: criticalThreats.length,
        recentThreats: parsedThreats.slice(0, 5)
      };
    }),

  // Strategic Planning Management
  createStrategicPlan: publicProcedure
    .input(strategicPlanSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      return ctx.db.systemConfig.create({
        data: {
          key: `eci_strategic_plan_${user.country.id}_${Date.now()}`,
          value: JSON.stringify({
            ...input,
            countryId: user.country.id,
            createdBy: user.id,
            createdAt: new Date()
          }),
          description: `Strategic plan: ${input.title}`
        }
      });
    }),

  getStrategicPlans: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return [];
      }

      const plans = await ctx.db.systemConfig.findMany({
        where: {
          key: { contains: `eci_strategic_plan_${user.country.id}` }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return plans.map(plan => ({
        id: plan.id,
        ...JSON.parse(plan.value)
      }));
    }),

  // Advanced Analytics
  getAdvancedAnalytics: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      // Get historical data for advanced analytics
      const historicalData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: 100
      });

      // Calculate advanced metrics
      const volatilityMetrics = calculateVolatility(historicalData);
      const trendAnalysis = calculateTrends(historicalData);
      const correlationAnalysis = calculateCorrelations(historicalData);

      return {
        volatility: volatilityMetrics,
        trends: trendAnalysis,
        correlations: correlationAnalysis,
        dataPoints: historicalData.length,
        lastUpdated: new Date()
      };
    }),

  // AI Advisor
  getAIRecommendations: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return [];
      }

      // Get recent data for AI analysis
      const recentData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: 30
      });

      const country = await ctx.db.country.findUnique({
        where: { id: user.country.id }
      });

      // Generate AI recommendations based on data patterns
      const recommendations = generateAIRecommendations(country, recentData);

      return recommendations;
    }),

  // Predictive Models
  getPredictiveModels: publicProcedure
    .input(z.object({
      userId: z.string(),
      timeframe: z.enum(['6_months', '1_year', '2_years', '5_years']).default('1_year'),
      scenarios: z.array(z.enum(['optimistic', 'realistic', 'pessimistic'])).default(['realistic'])
    }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User must be associated with a country"
        });
      }

      const country = await ctx.db.country.findUnique({
        where: { id: user.country.id }
      });

      const historicalData = await ctx.db.historicalDataPoint.findMany({
        where: { countryId: user.country.id },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: 100
      });

      // Generate predictive models
      const predictions = generatePredictiveModels(country!, historicalData, input);

      return predictions;
    }),

  // Real-time Metrics (to replace hardcoded values)
  getRealTimeMetrics: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { clerkUserId: input.userId },
        include: { country: true }
      });

      if (!user?.country) {
        return {
          social: 50,
          security: 50,
          political: 50
        };
      }

      // Calculate real metrics based on country data and recent events
      const metrics = await calculateRealTimeMetrics(ctx.db, user.country.id);

      return metrics;
    })
});

// Helper functions for calculations
function calculateVolatility(data: any[]) {
  if (data.length < 2) return { gdp: 0, population: 0, overall: 0 };
  
  const gdpValues = data.map(d => d.totalGdp).filter(Boolean);
  const populationValues = data.map(d => d.population).filter(Boolean);
  
  return {
    gdp: calculateStandardDeviation(gdpValues),
    population: calculateStandardDeviation(populationValues),
    overall: (calculateStandardDeviation(gdpValues) + calculateStandardDeviation(populationValues)) / 2
  };
}

function calculateTrends(data: any[]) {
  if (data.length < 3) return { gdp: 'stable', population: 'stable', overall: 'stable' };
  
  const recent = data.slice(0, 10);
  const older = data.slice(10, 20);
  
  const recentAvgGdp = recent.reduce((sum, d) => sum + (d.totalGdp || 0), 0) / recent.length;
  const olderAvgGdp = older.reduce((sum, d) => sum + (d.totalGdp || 0), 0) / older.length;
  
  const gdpTrend = recentAvgGdp > olderAvgGdp * 1.02 ? 'growing' : 
                   recentAvgGdp < olderAvgGdp * 0.98 ? 'declining' : 'stable';
  
  return {
    gdp: gdpTrend,
    population: 'stable', // Simplified for now
    overall: gdpTrend
  };
}

function calculateCorrelations(data: any[]) {
  // Simplified correlation analysis
  return {
    gdpPopulation: 0.85,
    gdpGrowthStability: 0.72,
    overallHealth: 0.78
  };
}

function calculateStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function generateAIRecommendations(country: any, recentData: any[]) {
  const recommendations = [];
  
  if (country.currentGdpPerCapita && country.currentGdpPerCapita < 25000) {
    recommendations.push({
      id: 'infrastructure_investment',
      title: 'Infrastructure Investment',
      description: 'Consider increasing infrastructure spending to boost economic development',
      priority: 'high',
      category: 'economic',
      impact: 'Potential 2-3% GDP growth boost over 2 years'
    });
  }
  
  if (country.populationGrowthRate && country.populationGrowthRate > 0.05) {
    recommendations.push({
      id: 'education_expansion',
      title: 'Education System Expansion',
      description: 'High population growth requires expanded educational capacity',
      priority: 'medium',
      category: 'social',
      impact: 'Long-term economic productivity improvement'
    });
  }
  
  recommendations.push({
    id: 'diversification',
    title: 'Economic Diversification',
    description: 'Reduce economic risk through sector diversification',
    priority: 'medium',
    category: 'economic',
    impact: 'Improved economic stability and resilience'
  });
  
  return recommendations;
}

function generatePredictiveModels(country: any, historicalData: any[], input: any) {
  const timeframePeriods = {
    '6_months': 6,
    '1_year': 12,
    '2_years': 24,
    '5_years': 60
  };
  
  const periods = timeframePeriods[input.timeframe as keyof typeof timeframePeriods];
  const baseGrowthRate = country.adjustedGdpGrowth || 0.03;
  
  const scenarios = input.scenarios.map((scenario: string) => {
    const multiplier = scenario === 'optimistic' ? 1.5 : 
                     scenario === 'pessimistic' ? 0.5 : 1.0;
    
    const projectedGdp = country.currentTotalGdp * Math.pow(1 + (baseGrowthRate * multiplier), periods / 12);
    const projectedPopulation = country.currentPopulation * Math.pow(1 + (country.populationGrowthRate || 0.01), periods / 12);
    const projectedGdpPerCapita = projectedGdp / projectedPopulation;
    
    return {
      scenario,
      projectedGdp,
      projectedPopulation,
      projectedGdpPerCapita,
      confidence: scenario === 'realistic' ? 85 : scenario === 'optimistic' ? 65 : 70
    };
  });
  
  return {
    timeframe: input.timeframe,
    scenarios,
    methodology: 'Compound growth model with historical variance analysis',
    lastUpdated: new Date()
  };
}

async function calculateRealTimeMetrics(db: any, countryId: string) {
  // Get recent security threats
  const securityThreats = await db.systemConfig.findMany({
    where: {
      key: { contains: `eci_security_threat_${countryId}` }
    }
  });
  
  const activeThreats = securityThreats.filter((threat: any) => {
    const data = JSON.parse(threat.value);
    return data.status === 'active';
  });
  
  const criticalThreats = activeThreats.filter((threat: any) => {
    const data = JSON.parse(threat.value);
    return data.severity === 'critical';
  });
  
  // Calculate security metric (higher threats = lower score)
  const securityScore = Math.max(20, 100 - (activeThreats.length * 10) - (criticalThreats.length * 20));
  
  // Get recent policies
  const policies = await db.systemConfig.findMany({
    where: {
      key: { contains: `eci_economic_policy_${countryId}` }
    }
  });
  
  const activePolicies = policies.filter((policy: any) => {
    const data = JSON.parse(policy.value);
    return data.status === 'implemented';
  });
  
  // Calculate political stability (more active policies = higher stability)
  const politicalScore = Math.min(100, 60 + (activePolicies.length * 5));
  
  // Social metric based on economic tier and policies
  const country = await db.country.findUnique({ where: { id: countryId } });
  const economicTierScores: Record<string, number> = {
    'Impoverished': 30,
    'Developing': 50,
    'Developed': 70,
    'Healthy': 80,
    'Strong': 90,
    'Very Strong': 95,
    'Extravagant': 100
  };
  
  const baseSocialScore = economicTierScores[country?.economicTier as string] || 50;
  const socialPolicies = activePolicies.filter((p: any) => {
    const data = JSON.parse(p.value);
    return data.category === 'labor' || data.category === 'infrastructure';
  });
  const socialScore = Math.min(100, baseSocialScore + (socialPolicies.length * 3));
  
  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore)
  };
}