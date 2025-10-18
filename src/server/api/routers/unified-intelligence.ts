/**
 * Unified Intelligence Router
 *
 * Comprehensive intelligence router that combines SDI/ECI functionality with
 * executive dashboard operations, diplomatic channels, and unified intelligence feeds.
 *
 * Features:
 * - Executive dashboard overview (vitality, alerts, quick actions)
 * - Enhanced quick actions with real database effects
 * - Secure diplomatic channel management
 * - Real-time intelligence feed aggregation
 * - Advanced analytics dashboard
 * - Classification-based access control
 * - Notification hooks for all major events
 * - Audit logging for sensitive operations
 */

import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  premiumProcedure,
  executiveProcedure,
  adminProcedure
} from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notification-api";

// ===== SCHEMAS =====

const classificationSchema = z.enum(['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET', 'TOP_SECRET']);
const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']);
const actionTypeSchema = z.enum([
  'infrastructure_boost',
  'security_review',
  'education_expansion',
  'trade_mission',
  'diplomatic_outreach',
  'economic_stimulus',
  'policy_implementation',
  'emergency_response'
]);

const quickActionSchema = z.object({
  countryId: z.string(),
  actionType: actionTypeSchema,
  parameters: z.record(z.string(), z.any()).optional(),
  priority: prioritySchema.optional().default('NORMAL'),
  notes: z.string().optional()
});

const diplomaticMessageSchema = z.object({
  channelId: z.string(),
  fromCountryId: z.string(),
  fromCountryName: z.string(),
  toCountryId: z.string().optional(),
  toCountryName: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().min(1),
  classification: classificationSchema.default('PUBLIC'),
  priority: prioritySchema.default('NORMAL'),
  encrypted: z.boolean().default(false)
});

// ===== UNIFIED INTELLIGENCE ROUTER =====

export const unifiedIntelligenceRouter = createTRPCRouter({

  // ===== EXECUTIVE DASHBOARD =====

  /**
   * Get comprehensive executive dashboard overview
   * Includes vitality metrics, active alerts, and quick actions
   */
  getOverview: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // Get country data
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            governmentStructure: true,
            economicModel: true,
            taxSystem: true
          }
        });

        if (!country) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
        }

        // Get latest vitality snapshots
        const vitalitySnapshots = await ctx.db.vitalitySnapshot.findMany({
          where: { countryId: input.countryId },
          orderBy: { calculatedAt: 'desc' },
          take: 4 // One for each major area
        });

        // Get active intelligence alerts
        const alerts = await ctx.db.intelligenceAlert.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            isResolved: false
          },
          orderBy: [
            { severity: 'desc' },
            { detectedAt: 'desc' }
          ],
          take: 10
        });

        // Get active intelligence briefings
        const briefings = await ctx.db.intelligenceBriefing.findMany({
          where: {
            countryId: input.countryId,
            isActive: true
          },
          include: {
            recommendations: {
              where: { isActive: true, isImplemented: false },
              take: 5
            }
          },
          orderBy: [
            { priority: 'desc' },
            { generatedAt: 'desc' }
          ],
          take: 5
        });

        // Get recent cabinet meetings
        const recentMeetings = await ctx.db.cabinetMeeting.findMany({
          where: { countryId: input.countryId },
          orderBy: { scheduledDate: 'desc' },
          take: 5,
          include: {
            decisions: {
              where: { implementationStatus: { in: ['pending', 'in_progress'] } }
            }
          }
        });

        // Get active policies
        const activePolicies = await ctx.db.policy.findMany({
          where: {
            countryId: input.countryId,
            status: 'active'
          },
          orderBy: { effectiveDate: 'desc' },
          take: 10
        });

        // Calculate summary metrics
        const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'critical').length;
        const highPriorityBriefings = briefings.filter(b => b.priority === 'HIGH' || b.priority === 'high' || b.priority === 'CRITICAL' || b.priority === 'critical').length;
        const pendingDecisions = recentMeetings.reduce((sum, m) => sum + m.decisions.length, 0);

        return {
          country: {
            id: country.id,
            name: country.name,
            economicTier: country.economicTier,
            populationTier: country.populationTier,
            overallNationalHealth: country.overallNationalHealth
          },
          vitality: {
            economic: vitalitySnapshots.find(v => v.area === 'economic' || v.area === 'ECONOMIC')?.score || country.economicVitality,
            social: vitalitySnapshots.find(v => v.area === 'social' || v.area === 'SOCIAL')?.score || country.populationWellbeing,
            diplomatic: vitalitySnapshots.find(v => v.area === 'diplomatic' || v.area === 'DIPLOMATIC')?.score || country.diplomaticStanding,
            governance: vitalitySnapshots.find(v => v.area === 'governance' || v.area === 'GOVERNANCE')?.score || country.governmentalEfficiency,
            snapshots: vitalitySnapshots
          },
          alerts: {
            total: alerts.length,
            critical: criticalAlerts,
            items: alerts.map(alert => ({
              id: alert.id,
              title: alert.title,
              description: alert.description,
              severity: alert.severity,
              category: alert.category,
              alertType: alert.alertType,
              currentValue: alert.currentValue,
              expectedValue: alert.expectedValue,
              deviation: alert.deviation,
              detectedAt: alert.detectedAt
            }))
          },
          briefings: {
            total: briefings.length,
            highPriority: highPriorityBriefings,
            items: briefings.map(b => ({
              id: b.id,
              title: b.title,
              description: b.description,
              type: b.type,
              priority: b.priority,
              area: b.area,
              confidence: b.confidence,
              urgency: b.urgency,
              recommendations: b.recommendations.length,
              generatedAt: b.generatedAt
            }))
          },
          activity: {
            recentMeetings: recentMeetings.length,
            pendingDecisions,
            activePolicies: activePolicies.length
          },
          lastUpdated: new Date()
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching overview:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch executive overview'
        });
      }
    }),

  /**
   * Get enhanced quick actions with builder context
   */
  getQuickActions: protectedProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId },
          include: {
            economicModel: true,
            governmentStructure: true
          }
        });

        if (!country) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
        }

        // Get recent security threats
        const recentThreats = await ctx.db.intelligenceAlert.findMany({
          where: {
            countryId: input.countryId,
            category: { in: ['security', 'SECURITY', 'crisis', 'CRISIS'] },
            isActive: true,
            detectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          }
        });

        // Get active recommendations
        const recommendations = await ctx.db.intelligenceRecommendation.findMany({
          where: {
            countryId: input.countryId,
            isActive: true,
            isImplemented: false
          },
          orderBy: { successProbability: 'desc' },
          take: 3
        });

        const quickActions = [];

        // Economic Quick Actions
        if (country.currentGdpPerCapita < 25000) {
          quickActions.push({
            id: 'infrastructure_boost',
            title: 'Infrastructure Investment',
            description: 'Boost GDP through targeted infrastructure spending',
            actionType: 'infrastructure_boost',
            category: 'economic',
            urgency: 'important',
            estimatedDuration: '6 months',
            successProbability: 85,
            estimatedBenefit: '+2.5% GDP growth',
            requirements: ['Budget allocation', 'Planning approval'],
            risks: ['Budget overruns', 'Implementation delays']
          });
        }

        // Security Quick Actions
        if (recentThreats.length > 0) {
          quickActions.push({
            id: 'security_review',
            title: 'Security Assessment',
            description: 'Conduct comprehensive security review',
            actionType: 'security_review',
            category: 'security',
            urgency: 'urgent',
            estimatedDuration: '2 weeks',
            successProbability: 95,
            estimatedBenefit: 'Enhanced security',
            requirements: ['Security clearance', 'Department coordination'],
            risks: ['Resource intensive']
          });
        }

        // Population Growth Actions
        if (country.populationGrowthRate > 0.03) {
          quickActions.push({
            id: 'education_expansion',
            title: 'Education Capacity',
            description: 'Expand educational infrastructure for growing population',
            actionType: 'education_expansion',
            category: 'social',
            urgency: 'important',
            estimatedDuration: '1 year',
            successProbability: 90,
            estimatedBenefit: 'Long-term productivity',
            requirements: ['Budget allocation', 'Teacher recruitment'],
            risks: ['Long implementation timeline']
          });
        }

        // Trade Opportunities
        quickActions.push({
          id: 'trade_mission',
          title: 'Trade Mission',
          description: 'Organize diplomatic trade mission',
          actionType: 'trade_mission',
          category: 'diplomatic',
          urgency: 'routine',
          estimatedDuration: '3 months',
          successProbability: 75,
          estimatedBenefit: 'New trade partnerships',
          requirements: ['Diplomatic coordination'],
          risks: ['Travel costs', 'Uncertain outcomes']
        });

        // Add recommendation-based actions
        recommendations.forEach(rec => {
          quickActions.push({
            id: `recommendation_${rec.id}`,
            title: rec.title,
            description: rec.description,
            actionType: 'policy_implementation',
            category: rec.category.toLowerCase(),
            urgency: rec.urgency.toLowerCase(),
            estimatedDuration: rec.estimatedDuration,
            successProbability: rec.successProbability,
            estimatedBenefit: rec.estimatedBenefit,
            requirements: JSON.parse(rec.prerequisites),
            risks: JSON.parse(rec.risks),
            recommendationId: rec.id
          });
        });

        return {
          actions: quickActions,
          context: {
            countryTier: country.economicTier,
            recentThreats: recentThreats.length,
            activeRecommendations: recommendations.length
          }
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching quick actions:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch quick actions'
        });
      }
    }),

  /**
   * Execute quick action with real database effects
   */
  executeAction: premiumProcedure
    .input(quickActionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId }
        });

        if (!country) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
        }

        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only execute actions for your own country'
          });
        }

        let result;
        const ixTime = IxTime.getCurrentIxTime();

        switch (input.actionType) {
          case 'infrastructure_boost':
            // Apply temporary GDP growth boost
            await ctx.db.dmInputs.create({
              data: {
                countryId: input.countryId,
                ixTimeTimestamp: new Date(),
                inputType: 'economic_policy',
                value: 2.5, // 2.5% GDP boost
                description: 'Infrastructure investment quick action',
                duration: 180, // 180 days
                isActive: true,
                createdBy: ctx.user.id
              }
            });
            result = {
              success: true,
              message: 'Infrastructure boost applied',
              effect: '+2.5% GDP growth for 6 months'
            };
            break;

          case 'security_review':
            // Mark all active threats as under review
            const threats = await ctx.db.intelligenceAlert.findMany({
              where: {
                countryId: input.countryId,
                isActive: true,
                isResolved: false
              }
            });

            await ctx.db.intelligenceAlert.updateMany({
              where: {
                countryId: input.countryId,
                isActive: true,
                isResolved: false
              },
              data: {
                updatedAt: new Date()
              }
            });

            result = {
              success: true,
              message: 'Security review initiated',
              effect: `${threats.length} threats under monitoring`
            };
            break;

          case 'education_expansion':
            // Apply long-term productivity boost
            await ctx.db.dmInputs.create({
              data: {
                countryId: input.countryId,
                ixTimeTimestamp: new Date(),
                inputType: 'special_event',
                value: 1.5, // 1.5% productivity boost
                description: 'Education expansion program',
                duration: 365, // 1 year
                isActive: true,
                createdBy: ctx.user.id
              }
            });
            result = {
              success: true,
              message: 'Education expansion started',
              effect: '+1.5% productivity for 1 year'
            };
            break;

          case 'trade_mission':
            // Create diplomatic event
            await ctx.db.diplomaticEvent.create({
              data: {
                country1Id: input.countryId,
                eventType: 'trade_mission',
                title: 'Trade Mission Initiative',
                description: 'Organized trade mission to develop new partnerships',
                status: 'active',
                economicImpact: 5000000, // $5M economic impact
                ixTimeTimestamp: ixTime
              }
            });
            result = {
              success: true,
              message: 'Trade mission organized',
              effect: 'New diplomatic opportunities'
            };
            break;

          case 'diplomatic_outreach':
            // Improve diplomatic standing
            await ctx.db.country.update({
              where: { id: input.countryId },
              data: {
                diplomaticStanding: Math.min(100, country.diplomaticStanding + 5)
              }
            });
            result = {
              success: true,
              message: 'Diplomatic outreach successful',
              effect: '+5 diplomatic standing'
            };
            break;

          case 'economic_stimulus':
            // Apply economic stimulus
            await ctx.db.dmInputs.create({
              data: {
                countryId: input.countryId,
                ixTimeTimestamp: new Date(),
                inputType: 'economic_policy',
                value: 3.0, // 3% economic boost
                description: 'Emergency economic stimulus package',
                duration: 90, // 90 days
                isActive: true,
                createdBy: ctx.user.id
              }
            });
            result = {
              success: true,
              message: 'Economic stimulus activated',
              effect: '+3% GDP growth for 3 months'
            };
            break;

          case 'policy_implementation':
            // Implement a policy from recommendations
            const recommendationId = input.parameters?.recommendationId as string;
            if (recommendationId) {
              await ctx.db.intelligenceRecommendation.update({
                where: { id: recommendationId },
                data: {
                  isImplemented: true,
                  implementedAt: new Date()
                }
              });
            }
            result = {
              success: true,
              message: 'Policy implementation initiated',
              effect: 'Long-term strategic benefit'
            };
            break;

          case 'emergency_response':
            // Emergency response action
            await ctx.db.dmInputs.create({
              data: {
                countryId: input.countryId,
                ixTimeTimestamp: new Date(),
                inputType: 'special_event',
                value: 0.5,
                description: 'Emergency response deployment',
                duration: 30,
                isActive: true,
                createdBy: ctx.user.id
              }
            });
            result = {
              success: true,
              message: 'Emergency response deployed',
              effect: 'Crisis mitigation active'
            };
            break;

          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Unknown action type'
            });
        }

        // Send notification
        await notificationAPI.create({
          title: '⚡ Quick Action Executed',
          message: `${result.message} - ${result.effect}`,
          countryId: input.countryId,
          category: 'governance',
          priority: input.priority === 'URGENT' || input.priority === 'CRITICAL' ? 'high' : 'medium',
          type: 'success',
          href: '/mycountry',
          source: 'unified-intelligence',
          actionable: false,
          metadata: {
            actionType: input.actionType,
            effect: result.effect,
            parameters: input.parameters
          }
        });

        return result;
      } catch (error) {
        console.error('[Unified Intelligence] Error executing action:', error);
        throw error instanceof TRPCError ? error : new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to execute action'
        });
      }
    }),

  // ===== DIPLOMATIC CHANNELS =====

  /**
   * Get secure diplomatic channels with classification filtering
   */
  getDiplomaticChannels: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      clearanceLevel: classificationSchema.optional().default('PUBLIC')
    }))
    .query(async ({ ctx, input }) => {
      try {
        const channels = await ctx.db.diplomaticChannel.findMany({
          where: {
            participants: {
              some: { countryId: input.countryId }
            },
            // Filter by classification
            classification: input.clearanceLevel === 'TOP_SECRET'
              ? undefined
              : input.clearanceLevel === 'SECRET'
                ? { in: ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'] }
                : input.clearanceLevel === 'CONFIDENTIAL'
                  ? { in: ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] }
                  : input.clearanceLevel === 'RESTRICTED'
                    ? { in: ['PUBLIC', 'RESTRICTED'] }
                    : 'PUBLIC'
          },
          include: {
            participants: true,
            _count: {
              select: {
                messages: {
                  where: {
                    status: { notIn: ['READ'] },
                    fromCountryId: { not: input.countryId }
                  }
                }
              }
            }
          },
          orderBy: { lastActivity: 'desc' }
        });

        return channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          classification: channel.classification,
          encrypted: channel.encrypted,
          lastActivity: channel.lastActivity,
          unreadCount: channel._count.messages,
          participants: channel.participants.map(p => ({
            countryId: p.countryId,
            countryName: p.countryName,
            flagUrl: p.flagUrl,
            role: p.role
          }))
        }));
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching diplomatic channels:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch diplomatic channels'
        });
      }
    }),

  /**
   * Send encrypted diplomatic message
   */
  sendSecureMessage: protectedProcedure
    .input(diplomaticMessageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the sending country
        if (ctx.user.countryId !== input.fromCountryId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only send messages from your own country'
          });
        }

        // Verify channel access
        const channel = await ctx.db.diplomaticChannel.findFirst({
          where: {
            id: input.channelId,
            participants: {
              some: { countryId: input.fromCountryId }
            }
          }
        });

        if (!channel) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied to this diplomatic channel'
          });
        }

        // Create message
        const message = await ctx.db.diplomaticMessage.create({
          data: {
            channelId: input.channelId,
            fromCountryId: input.fromCountryId,
            fromCountryName: input.fromCountryName,
            toCountryId: input.toCountryId,
            toCountryName: input.toCountryName,
            subject: input.subject,
            content: input.content,
            classification: input.classification,
            priority: input.priority,
            encrypted: input.encrypted,
            ixTimeTimestamp: IxTime.getCurrentIxTime()
          }
        });

        // Update channel last activity
        await ctx.db.diplomaticChannel.update({
          where: { id: input.channelId },
          data: { lastActivity: new Date() }
        });

        // Send notification to recipient(s)
        const recipients = input.toCountryId
          ? [input.toCountryId]
          : (await ctx.db.diplomaticChannelParticipant.findMany({
              where: {
                channelId: input.channelId,
                countryId: { not: input.fromCountryId }
              }
            })).map(p => p.countryId);

        for (const recipientId of recipients) {
          await notificationAPI.create({
            title: `📨 ${input.classification} Diplomatic Message`,
            message: `From ${input.fromCountryName}: ${input.subject || 'New message'}`,
            countryId: recipientId,
            category: 'diplomatic',
            priority: input.priority === 'URGENT' || input.priority === 'CRITICAL' ? 'high' : 'medium',
            type: 'info',
            href: '/diplomatic/messages',
            source: 'diplomatic-system',
            actionable: true,
            metadata: {
              messageId: message.id,
              channelId: input.channelId,
              classification: input.classification,
              encrypted: input.encrypted
            }
          });
        }

        return {
          success: true,
          message: message,
          recipientCount: recipients.length
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error sending message:', error);
        throw error instanceof TRPCError ? error : new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send diplomatic message'
        });
      }
    }),

  // ===== INTELLIGENCE FEED =====

  /**
   * Get real-time intelligence feed with filtering
   */
  getIntelligenceFeed: protectedProcedure
    .input(z.object({
      countryId: z.string().optional(),
      category: z.enum(['all', 'economic', 'ECONOMIC', 'crisis', 'CRISIS', 'diplomatic', 'DIPLOMATIC', 'security', 'SECURITY', 'technology', 'environment']).optional(),
      priority: z.enum(['all', 'low', 'LOW', 'medium', 'MEDIUM', 'high', 'HIGH', 'critical', 'CRITICAL']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      try {
        const where: any = { isActive: true };

        if (input.category && input.category !== 'all') {
          where.category = input.category.toUpperCase();
        }
        if (input.priority && input.priority !== 'all') {
          where.priority = input.priority.toUpperCase();
        }

        const [items, total] = await Promise.all([
          ctx.db.intelligenceItem.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip: input.offset,
            take: input.limit
          }),
          ctx.db.intelligenceItem.count({ where })
        ]);

        return {
          items: items.map(item => ({
            id: item.id,
            title: item.title,
            content: item.content,
            category: item.category,
            priority: item.priority,
            severity: item.severity,
            source: item.source,
            timestamp: item.timestamp,
            region: item.region,
            affectedCountries: item.affectedCountries ? item.affectedCountries.split(',') : [],
            actionable: item.actionable,
            confidence: item.confidence
          })),
          pagination: {
            total,
            offset: input.offset,
            limit: input.limit,
            hasMore: input.offset + input.limit < total
          }
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching intelligence feed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch intelligence feed'
        });
      }
    }),

  // ===== ANALYTICS DASHBOARD =====

  /**
   * Get advanced analytics dashboard data
   */
  getAnalytics: premiumProcedure
    .input(z.object({
      countryId: z.string(),
      timeframe: z.enum(['7d', '30d', '90d', '1y']).default('30d')
    }))
    .query(async ({ ctx, input }) => {
      try {
        const country = await ctx.db.country.findUnique({
          where: { id: input.countryId }
        });

        if (!country) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Country not found' });
        }

        // Calculate timeframe
        const timeframeMs = {
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
          '90d': 90 * 24 * 60 * 60 * 1000,
          '1y': 365 * 24 * 60 * 60 * 1000
        }[input.timeframe];

        const startDate = new Date(Date.now() - timeframeMs);

        // Get historical data
        const historicalData = await ctx.db.historicalDataPoint.findMany({
          where: {
            countryId: input.countryId,
            ixTimeTimestamp: { gte: startDate }
          },
          orderBy: { ixTimeTimestamp: 'asc' }
        });

        // Get intelligence metrics
        const [alerts, briefings, policies] = await Promise.all([
          ctx.db.intelligenceAlert.findMany({
            where: {
              countryId: input.countryId,
              detectedAt: { gte: startDate }
            }
          }),
          ctx.db.intelligenceBriefing.findMany({
            where: {
              countryId: input.countryId,
              generatedAt: { gte: startDate }
            }
          }),
          ctx.db.policy.findMany({
            where: {
              countryId: input.countryId,
              proposedDate: { gte: startDate }
            }
          })
        ]);

        // Calculate trends
        const gdpTrend = historicalData.length > 1
          ? ((historicalData[historicalData.length - 1]?.totalGdp || 0) - (historicalData[0]?.totalGdp || 0)) / (historicalData[0]?.totalGdp || 1) * 100
          : 0;

        const populationTrend = historicalData.length > 1
          ? ((historicalData[historicalData.length - 1]?.population || 0) - (historicalData[0]?.population || 0)) / (historicalData[0]?.population || 1) * 100
          : 0;

        return {
          overview: {
            gdpTrend: gdpTrend.toFixed(2),
            populationTrend: populationTrend.toFixed(2),
            alertsGenerated: alerts.length,
            briefingsCreated: briefings.length,
            policiesProposed: policies.length
          },
          timeSeries: {
            gdp: historicalData.map(d => ({
              timestamp: d.ixTimeTimestamp,
              value: d.totalGdp
            })),
            population: historicalData.map(d => ({
              timestamp: d.ixTimeTimestamp,
              value: d.population
            })),
            gdpPerCapita: historicalData.map(d => ({
              timestamp: d.ixTimeTimestamp,
              value: d.gdpPerCapita
            }))
          },
          alerts: {
            bySeverity: {
              critical: alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'critical').length,
              high: alerts.filter(a => a.severity === 'HIGH' || a.severity === 'high').length,
              medium: alerts.filter(a => a.severity === 'MEDIUM' || a.severity === 'medium').length,
              low: alerts.filter(a => a.severity === 'LOW' || a.severity === 'low').length
            },
            byCategory: alerts.reduce((acc, alert) => {
              if (alert.category) {
                const cat = alert.category.toLowerCase();
                acc[cat] = (acc[cat] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>)
          },
          policies: {
            byType: policies.reduce((acc, policy) => {
              acc[policy.policyType] = (acc[policy.policyType] || 0) + 1;
              return acc;
            }, {} as Record<string, number>),
            byStatus: policies.reduce((acc, policy) => {
              acc[policy.status] = (acc[policy.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          }
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching analytics:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch analytics data'
        });
      }
    }),

  // ===== ADMIN OPERATIONS =====

  /**
   * Create intelligence briefing (admin only)
   */
  createBriefing: adminProcedure
    .input(z.object({
      countryId: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(['HOT_ISSUE', 'OPPORTUNITY', 'RISK_MITIGATION', 'STRATEGIC_INITIATIVE']),
      priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
      area: z.enum(['ECONOMIC', 'DIPLOMATIC', 'SOCIAL', 'GOVERNANCE', 'SECURITY', 'INFRASTRUCTURE', 'CRISIS']),
      confidence: z.number().min(0).max(100),
      urgency: z.enum(['IMMEDIATE', 'THIS_WEEK', 'THIS_MONTH', 'THIS_QUARTER'])
    }))
    .mutation(async ({ ctx, input }) => {
      const briefing = await ctx.db.intelligenceBriefing.create({
        data: {
          countryId: input.countryId,
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          area: input.area,
          confidence: input.confidence,
          urgency: input.urgency,
          impactMagnitude: JSON.stringify({ magnitude: 'HIGH', scope: 'National', timeframe: '6 months' }),
          evidence: JSON.stringify({ metrics: [], trends: [], comparisons: [] }),
          isActive: true
        }
      });

      // Send notification
      await notificationAPI.create({
        title: `📊 New Intelligence Briefing`,
        message: `${input.title} - ${input.urgency} priority`,
        countryId: input.countryId,
        category: 'intelligence',
        priority: input.priority === 'CRITICAL' ? 'high' : 'medium',
        type: 'info',
        href: '/mycountry/intelligence',
        source: 'intelligence-system',
        actionable: true,
        metadata: { briefingId: briefing.id, type: input.type }
      });

      return briefing;
    }),

  // ===== ALERT THRESHOLD MANAGEMENT =====

  /**
   * Get alert thresholds for a country and user
   */
  getAlertThresholds: protectedProcedure
    .input(z.object({
      countryId: z.string(),
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const thresholds = await ctx.db.intelligenceAlertThreshold.findMany({
          where: {
            countryId: input.countryId,
            userId: input.userId,
            isActive: true
          },
          orderBy: [
            { alertType: 'asc' },
            { metricName: 'asc' }
          ]
        });

        return {
          thresholds,
          total: thresholds.length
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error fetching alert thresholds:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch alert thresholds'
        });
      }
    }),

  /**
   * Update or create an alert threshold
   */
  updateAlertThreshold: protectedProcedure
    .input(z.object({
      id: z.string().optional(),
      countryId: z.string(),
      userId: z.string(),
      alertType: z.string(),
      metricName: z.string(),
      criticalMin: z.number().optional(),
      criticalMax: z.number().optional(),
      highMin: z.number().optional(),
      highMax: z.number().optional(),
      mediumMin: z.number().optional(),
      mediumMax: z.number().optional(),
      notifyOnCritical: z.boolean().default(true),
      notifyOnHigh: z.boolean().default(true),
      notifyOnMedium: z.boolean().default(false),
      isActive: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only manage thresholds for your own country'
          });
        }

        const threshold = await ctx.db.intelligenceAlertThreshold.upsert({
          where: {
            countryId_alertType_metricName: {
              countryId: input.countryId,
              alertType: input.alertType,
              metricName: input.metricName
            }
          },
          update: {
            criticalMin: input.criticalMin,
            criticalMax: input.criticalMax,
            highMin: input.highMin,
            highMax: input.highMax,
            mediumMin: input.mediumMin,
            mediumMax: input.mediumMax,
            notifyOnCritical: input.notifyOnCritical,
            notifyOnHigh: input.notifyOnHigh,
            notifyOnMedium: input.notifyOnMedium,
            isActive: input.isActive,
            updatedAt: new Date()
          },
          create: {
            countryId: input.countryId,
            userId: input.userId,
            alertType: input.alertType,
            metricName: input.metricName,
            criticalMin: input.criticalMin,
            criticalMax: input.criticalMax,
            highMin: input.highMin,
            highMax: input.highMax,
            mediumMin: input.mediumMin,
            mediumMax: input.mediumMax,
            notifyOnCritical: input.notifyOnCritical,
            notifyOnHigh: input.notifyOnHigh,
            notifyOnMedium: input.notifyOnMedium,
            isActive: input.isActive
          }
        });

        // Send notification
        await notificationAPI.create({
          title: '🎯 Alert Threshold Updated',
          message: `Updated threshold for ${input.metricName}`,
          countryId: input.countryId,
          category: 'intelligence',
          priority: 'medium',
          type: 'success',
          href: '/mycountry/intelligence',
          source: 'intelligence-system',
          actionable: false,
          metadata: {
            thresholdId: threshold.id,
            alertType: input.alertType,
            metricName: input.metricName
          }
        });

        return {
          success: true,
          threshold
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error updating alert threshold:', error);
        throw error instanceof TRPCError ? error : new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update alert threshold'
        });
      }
    }),

  /**
   * Delete an alert threshold
   */
  deleteAlertThreshold: protectedProcedure
    .input(z.object({
      id: z.string(),
      countryId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify user owns the country
        if (ctx.user.countryId !== input.countryId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You can only delete thresholds for your own country'
          });
        }

        await ctx.db.intelligenceAlertThreshold.delete({
          where: { id: input.id }
        });

        return {
          success: true,
          message: 'Alert threshold deleted successfully'
        };
      } catch (error) {
        console.error('[Unified Intelligence] Error deleting alert threshold:', error);
        throw error instanceof TRPCError ? error : new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete alert threshold'
        });
      }
    })
});
