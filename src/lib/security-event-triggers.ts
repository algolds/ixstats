/**
 * Security Event Automatic Trigger System
 *
 * Monitors country conditions and automatically generates security events
 * when thresholds are crossed or conditions align for specific scenarios.
 *
 * Design Philosophy:
 * - Events trigger automatically based on real-time metrics
 * - Multiple trigger types: threshold, trend, cascade, random
 * - Prevents event spam with cooldowns and fatigue system
 * - Integrates with notification system for real-time alerts
 */

import type { PrismaClient } from "@prisma/client";
import {
  generateSecurityEvent,
  generateThreatActor,
  type SecurityEventContext,
  type SecurityEventType,
} from "./security-event-generator";
import { notificationAPI } from "./notification-api";

// ==================== TRIGGER CONFIGURATION ====================

/**
 * Global trigger configuration
 */
export const TRIGGER_CONFIG = {
  // Cooldown periods (in days)
  MIN_EVENT_COOLDOWN: 2, // Minimum days between any events
  CATEGORY_COOLDOWN: 7, // Minimum days between same category events
  CRITICAL_EVENT_COOLDOWN: 14, // Minimum days between critical/existential events

  // Event generation rates
  MAX_EVENTS_PER_30_DAYS: 5, // Maximum events in a 30-day period
  BASE_CHECK_PROBABILITY: 0.15, // Base chance of event check passing (15%)

  // Threshold multipliers
  CRISIS_THRESHOLD_MULTIPLIER: 3.0, // Events 3x more likely in crisis
  UNSTABLE_THRESHOLD_MULTIPLIER: 1.8,
  MODERATE_THRESHOLD_MULTIPLIER: 1.0,
  SECURE_THRESHOLD_MULTIPLIER: 0.5,
  FORTIFIED_THRESHOLD_MULTIPLIER: 0.2,
};

// ==================== TRIGGER TYPES ====================

/**
 * Threshold triggers: Fire when metrics cross specific values
 */
export interface ThresholdTrigger {
  type: "threshold";
  name: string;
  description: string;
  condition: (context: SecurityEventContext) => boolean;
  eventTypes: string[]; // Types of events this trigger can generate
  multiplier: number; // Probability multiplier (1.0 = normal, 2.0 = double chance)
}

/**
 * Trend triggers: Fire when metrics are changing rapidly
 */
export interface TrendTrigger {
  type: "trend";
  name: string;
  description: string;
  requiredTrend: "rapid_decline" | "gradual_decline" | "volatile";
  metricToTrack: string;
  eventTypes: string[];
  multiplier: number;
}

/**
 * Cascade triggers: Fire when multiple conditions align
 */
export interface CascadeTrigger {
  type: "cascade";
  name: string;
  description: string;
  conditions: Array<(context: SecurityEventContext) => boolean>;
  minConditionsMet: number; // How many conditions must be true
  eventTypes: string[];
  multiplier: number;
}

// ==================== THRESHOLD TRIGGERS ====================

export const THRESHOLD_TRIGGERS: ThresholdTrigger[] = [
  {
    type: "threshold",
    name: "Critical Instability",
    description: "Overall stability has fallen into crisis levels",
    condition: (ctx) => ctx.stability.stabilityScore < 30,
    eventTypes: ["terrorism", "insurgency", "civil_unrest"],
    multiplier: 3.0,
  },
  {
    type: "threshold",
    name: "Severe Crime Wave",
    description: "Crime rate has reached epidemic levels",
    condition: (ctx) => ctx.stability.crimeRate > 800 || ctx.stability.organizedCrimeLevel > 70,
    eventTypes: ["organized_crime"],
    multiplier: 2.5,
  },
  {
    type: "threshold",
    name: "High Riot Risk",
    description: "Civil unrest is imminent",
    condition: (ctx) => ctx.stability.riotRisk > 70,
    eventTypes: ["civil_unrest"],
    multiplier: 2.0,
  },
  {
    type: "threshold",
    name: "Ethnic Tensions Boiling",
    description: "Ethnic divisions reaching breaking point",
    condition: (ctx) => ctx.stability.ethnicTension > 75,
    eventTypes: ["insurgency", "terrorism", "civil_unrest"],
    multiplier: 2.2,
  },
  {
    type: "threshold",
    name: "Military Readiness Collapse",
    description: "Military forces unable to maintain security",
    condition: (ctx) => ctx.military.averageReadiness < 40,
    eventTypes: ["terrorism", "insurgency", "organized_crime", "border_incident"],
    multiplier: 1.8,
  },
  {
    type: "threshold",
    name: "Weak Border Security",
    description: "Borders are porous and poorly monitored",
    condition: (ctx) => ctx.military.borderSecurity < 50,
    eventTypes: ["border_incident", "espionage", "organized_crime"],
    multiplier: 1.6,
  },
  {
    type: "threshold",
    name: "Cyber Vulnerability",
    description: "Critical infrastructure is poorly protected",
    condition: (ctx) => ctx.military.cybersecurity < 45,
    eventTypes: ["cyber_attack"],
    multiplier: 1.9,
  },
  {
    type: "threshold",
    name: "Economic Desperation",
    description: "High unemployment and poverty fueling discontent",
    condition: (ctx) => ctx.economy.unemploymentRate > 20 && ctx.economy.povertyRate > 25,
    eventTypes: ["civil_unrest", "organized_crime", "terrorism"],
    multiplier: 1.7,
  },
  {
    type: "threshold",
    name: "Political Crisis",
    description: "Trust in government has collapsed",
    condition: (ctx) => ctx.stability.trustInGovernment < 30 || ctx.politics.politicalStability < 35,
    eventTypes: ["civil_unrest", "insurgency"],
    multiplier: 1.8,
  },
  {
    type: "threshold",
    name: "Extreme Polarization",
    description: "Society is deeply divided",
    condition: (ctx) => ctx.politics.polarization > 80,
    eventTypes: ["civil_unrest", "terrorism"],
    multiplier: 1.5,
  },
];

// ==================== CASCADE TRIGGERS ====================

export const CASCADE_TRIGGERS: CascadeTrigger[] = [
  {
    type: "cascade",
    name: "Perfect Storm",
    description: "Multiple crises converging simultaneously",
    conditions: [
      (ctx) => ctx.stability.stabilityScore < 40,
      (ctx) => ctx.economy.unemploymentRate > 15,
      (ctx) => ctx.military.averageReadiness < 60,
      (ctx) => ctx.politics.polarization > 70,
      (ctx) => ctx.stability.trustInGovernment < 40,
    ],
    minConditionsMet: 3,
    eventTypes: ["terrorism", "insurgency", "civil_unrest", "organized_crime"],
    multiplier: 4.0,
  },
  {
    type: "cascade",
    name: "Failed State Trajectory",
    description: "Country approaching state failure",
    conditions: [
      (ctx) => ctx.stability.stabilityScore < 25,
      (ctx) => ctx.military.averageReadiness < 50,
      (ctx) => ctx.stability.organizedCrimeLevel > 60,
      (ctx) => ctx.politics.politicalStability < 30,
    ],
    minConditionsMet: 3,
    eventTypes: ["insurgency", "organized_crime", "terrorism"],
    multiplier: 5.0,
  },
  {
    type: "cascade",
    name: "Security Vacuum",
    description: "Military unable to maintain control",
    conditions: [
      (ctx) => ctx.military.averageReadiness < 45,
      (ctx) => ctx.military.counterTerrorism < 50,
      (ctx) => ctx.stability.organizedCrimeLevel > 55,
    ],
    minConditionsMet: 2,
    eventTypes: ["organized_crime", "terrorism", "insurgency"],
    multiplier: 2.5,
  },
];

// ==================== EVENT COOLDOWN SYSTEM ====================

/**
 * Check if country is on cooldown for events
 */
export async function isOnCooldown(
  db: PrismaClient,
  countryId: string,
  eventType?: string
): Promise<boolean> {
  const now = new Date();

  // Check recent events
  const recentEvents = await db.securityEvent.findMany({
    where: {
      countryId,
      createdAt: {
        gte: new Date(now.getTime() - TRIGGER_CONFIG.MIN_EVENT_COOLDOWN * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Global cooldown: No events in last MIN_EVENT_COOLDOWN days
  if (recentEvents.length > 0) {
    const lastEvent = recentEvents[0]!;
    const hoursSinceLastEvent =
      (now.getTime() - lastEvent.createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastEvent < TRIGGER_CONFIG.MIN_EVENT_COOLDOWN * 24) {
      return true; // Still on cooldown
    }
  }

  // Category-specific cooldown
  if (eventType) {
    const categoryEvents = recentEvents.filter((e) => e.eventType === eventType);
    if (categoryEvents.length > 0) {
      const lastCategoryEvent = categoryEvents[0]!;
      const hoursSinceCategoryEvent =
        (now.getTime() - lastCategoryEvent.createdAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCategoryEvent < TRIGGER_CONFIG.CATEGORY_COOLDOWN * 24) {
        return true; // Still on cooldown for this category
      }
    }
  }

  // Check event frequency (max events per 30 days)
  const events30Days = await db.securityEvent.count({
    where: {
      countryId,
      createdAt: {
        gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (events30Days >= TRIGGER_CONFIG.MAX_EVENTS_PER_30_DAYS) {
    return true; // Too many events recently
  }

  return false;
}

// ==================== TRIGGER EVALUATION ====================

/**
 * Evaluate all triggers and determine if event should be generated
 */
export function evaluateTriggers(context: SecurityEventContext): {
  shouldGenerate: boolean;
  multiplier: number;
  triggeredBy: string[];
} {
  const triggeredThresholds: ThresholdTrigger[] = [];
  const triggeredCascades: CascadeTrigger[] = [];

  // Check threshold triggers
  for (const trigger of THRESHOLD_TRIGGERS) {
    if (trigger.condition(context)) {
      triggeredThresholds.push(trigger);
    }
  }

  // Check cascade triggers
  for (const trigger of CASCADE_TRIGGERS) {
    const conditionsMet = trigger.conditions.filter((cond) => cond(context)).length;
    if (conditionsMet >= trigger.minConditionsMet) {
      triggeredCascades.push(trigger);
    }
  }

  // Calculate combined multiplier
  const thresholdMultiplier =
    triggeredThresholds.length > 0
      ? Math.max(...triggeredThresholds.map((t) => t.multiplier))
      : 1.0;

  const cascadeMultiplier =
    triggeredCascades.length > 0 ? Math.max(...triggeredCascades.map((t) => t.multiplier)) : 1.0;

  const totalMultiplier = Math.max(thresholdMultiplier, cascadeMultiplier);

  // Base probability check
  const baseRoll = Math.random();
  const shouldGenerate =
    baseRoll < TRIGGER_CONFIG.BASE_CHECK_PROBABILITY * totalMultiplier;

  const triggeredNames = [
    ...triggeredThresholds.map((t) => t.name),
    ...triggeredCascades.map((t) => t.name),
  ];

  return {
    shouldGenerate,
    multiplier: totalMultiplier,
    triggeredBy: triggeredNames,
  };
}

// ==================== AUTOMATIC EVENT GENERATION ====================

/**
 * Main function: Check if event should be generated and create it
 */
export async function checkAndGenerateSecurityEvent(
  db: PrismaClient,
  context: SecurityEventContext
): Promise<{ created: boolean; event?: SecurityEventType; threatActor?: any } | null> {
  try {
    // Check cooldown
    const onCooldown = await isOnCooldown(db, context.countryId);
    if (onCooldown) {
      return { created: false };
    }

    // Evaluate triggers
    const { shouldGenerate, multiplier, triggeredBy } = evaluateTriggers(context);

    if (!shouldGenerate) {
      return { created: false };
    }

    // Generate event
    const event = generateSecurityEvent(context);
    if (!event) {
      return { created: false };
    }

    // Generate threat actor
    const threatActor = generateThreatActor(event, context);

    // Calculate casualties
    const casualties =
      Math.floor(
        Math.random() * (event.effects.casualtyRange[1] - event.effects.casualtyRange[0])
      ) + event.effects.casualtyRange[0];

    // Create event in database
    const createdEvent = await db.securityEvent.create({
      data: {
        countryId: context.countryId,
        title: event.name,
        eventType: event.type,
        description: event.description,
        severity: event.severity,
        casualties,
        economicImpact: event.effects.economicImpact,
        stabilityImpact: event.effects.stabilityImpact || 0,
        status: "active",
        triggerFactors: JSON.stringify(triggeredBy),
      },
    });

    // Send notification
    await notificationAPI.trigger({
      crisis: {
        type: event.type,
        severity: event.severity as "low" | "medium" | "high" | "critical",
        countryId: context.countryId,
        description: event.description,
      },
    });

    return {
      created: true,
      event,
      threatActor,
    };
  } catch (error) {
    console.error("[SecurityEventTriggers] Error generating event:", error);
    return null;
  }
}

/**
 * Batch check for multiple countries (can be run as cron job)
 */
export async function batchCheckSecurityEvents(
  db: PrismaClient,
  countryIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  for (const countryId of countryIds) {
    try {
      // Fetch context data for country
      const [securityAssessment, internalStability, country, militaryBranches] = await Promise.all([
        db.securityAssessment.findUnique({ where: { countryId } }),
        db.internalStabilityMetrics.findUnique({ where: { countryId } }),
        db.country.findUnique({
          where: { id: countryId },
        }),
        db.militaryBranch.findMany({
          where: { countryId, isActive: true },
        }),
      ]);

      if (!securityAssessment || !internalStability || !country) {
        continue;
      }

      // Calculate recent events
      const now = new Date();
      const events30Days = await db.securityEvent.count({
        where: {
          countryId,
          createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      const crises90Days = await db.securityEvent.count({
        where: {
          countryId,
          createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
          severity: { in: ["critical", "existential"] },
        },
      });

      const attacks90Days = await db.securityEvent.count({
        where: {
          countryId,
          createdAt: { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
          status: "active",
        },
      });

      // Build context
      const context: SecurityEventContext = {
        countryId,
        stability: {
          stabilityScore: internalStability.stabilityScore,
          crimeRate: internalStability.crimeRate,
          organizedCrimeLevel: internalStability.organizedCrimeLevel,
          riotRisk: internalStability.riotRisk,
          ethnicTension: internalStability.ethnicTension,
          protestFrequency: internalStability.protestFrequency,
          trustInGovernment: internalStability.trustInGovernment,
          socialCohesion: internalStability.socialCohesion,
        },
        military: {
          averageReadiness:
            militaryBranches.reduce((sum, b) => sum + b.readinessLevel, 0) /
              Math.max(militaryBranches.length, 1) || 50,
          militaryStrength: securityAssessment.militaryStrength,
          borderSecurity:
            typeof securityAssessment.borderSecurity === "number"
              ? securityAssessment.borderSecurity
              : 60,
          counterTerrorism: securityAssessment.counterTerrorism,
          cybersecurity: securityAssessment.cybersecurity,
        },
        economy: {
          gdpPerCapita: country.currentGdpPerCapita || 25000,
          unemploymentRate: country.unemploymentRate || 8,
          inequalityGini: country.incomeInequalityGini || 35,
          povertyRate: country.povertyRate || 15,
          economicGrowth: country.adjustedGdpGrowth || 2.5,
        },
        politics: {
          democracyLevel: 70, // TODO: Add democracyIndex to Country model
          politicalStability: country.politicalStability === "Stable" ? 65 : 50,
          corruption: 40, // TODO: Add corruptionIndex to Country model
          polarization: 50, // TODO: Add polarization to Country model
        },
        recentEvents: {
          securityEventsLast30Days: events30Days,
          majorCrisesLast90Days: crises90Days,
          successfulAttacksLast90Days: attacks90Days,
        },
      };

      // Check and generate
      const result = await checkAndGenerateSecurityEvent(db, context);
      results.set(countryId, result?.created || false);
    } catch (error) {
      console.error(`[SecurityEventTriggers] Error checking country ${countryId}:`, error);
      results.set(countryId, false);
    }
  }

  return results;
}
