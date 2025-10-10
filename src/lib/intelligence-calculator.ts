/**
 * Intelligence Calculator Service
 * Calculates and stores intelligence briefings, alerts, and recommendations in the database
 */

import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";
import { generateIntelligenceReport } from "~/lib/intelligence-engine";
import { transformApiDataToVitalityIntelligence } from "~/app/mycountry/utils/liveDataTransformers";
import type { Category, BriefingType, Priority, Urgency, Difficulty, Trend } from "@prisma/client";

interface CalculateIntelligenceOptions {
  countryId?: string;
  forceRecalculate?: boolean;
}

// Helper to convert string to enum
function mapBriefingType(type: string): BriefingType {
  const mapping: Record<string, BriefingType> = {
    'hot_issue': 'HOT_ISSUE',
    'opportunity': 'OPPORTUNITY',
    'risk_mitigation': 'RISK_MITIGATION',
    'strategic_initiative': 'STRATEGIC_INITIATIVE'
  };
  return mapping[type] || 'STRATEGIC_INITIATIVE';
}

function mapPriority(priority: string): Priority {
  const mapping: Record<string, Priority> = {
    'critical': 'CRITICAL',
    'high': 'HIGH',
    'medium': 'MEDIUM',
    'low': 'LOW'
  };
  return mapping[priority] || 'MEDIUM';
}

function mapUrgency(urgency: string): Urgency {
  const mapping: Record<string, Urgency> = {
    'immediate': 'IMMEDIATE',
    'this_week': 'THIS_WEEK',
    'this_month': 'THIS_MONTH',
    'this_quarter': 'THIS_QUARTER'
  };
  return mapping[urgency] || 'THIS_MONTH';
}

function mapCategory(category: string): Category {
  const mapping: Record<string, Category> = {
    'economic': 'ECONOMIC',
    'population': 'SOCIAL',
    'diplomatic': 'DIPLOMATIC',
    'governance': 'GOVERNANCE'
  };
  return mapping[category] || 'GOVERNANCE';
}

function mapDifficulty(difficulty: string): Difficulty {
  const mapping: Record<string, Difficulty> = {
    'minor': 'MINOR',
    'moderate': 'MODERATE',
    'major': 'MAJOR',
    'transformational': 'TRANSFORMATIONAL'
  };
  return mapping[difficulty] || 'MODERATE';
}

function mapTrend(trend: string): Trend {
  const mapping: Record<string, Trend> = {
    'up': 'UP',
    'down': 'DOWN',
    'stable': 'STABLE'
  };
  return mapping[trend] || 'STABLE';
}

// Helper to get quarter info from IxTime
function getQuarterInfo(): string {
  const currentIxTime = IxTime.getCurrentIxTime();
  const ixDate = new Date(currentIxTime);
  const month = ixDate.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1; // 1-4
  const year = ixDate.getFullYear();
  return `Q${quarter} ${year}`;
}

/**
 * Calculate intelligence for a single country
 */
async function calculateCountryIntelligence(countryId: string) {
  console.log(`[Intelligence] Calculating intelligence for country ${countryId}`);

  // Fetch country data
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: {
      dmInputs: {
        where: { isActive: true },
        orderBy: { ixTimeTimestamp: 'desc' }
      }
    }
  });

  if (!country) {
    console.error(`[Intelligence] Country ${countryId} not found`);
    return;
  }

  const now = Date.now();
  const currentIxTime = IxTime.getCurrentIxTime();

  // ===== GENERATE INTELLIGENCE REPORT =====
  try {
    // Fetch REAL historical data from database
    const historicalRecords = await db.historicalDataPoint.findMany({
      where: { countryId },
      orderBy: { ixTimeTimestamp: 'desc' },
      take: 12
    });

    // Use actual historical data, or fall back to current values if no history exists
    const gdpHistory = historicalRecords.length > 0
      ? historicalRecords.map(h => h.gdpPerCapita).reverse()
      : [country.currentGdpPerCapita];

    const populationHistory = historicalRecords.length > 0
      ? historicalRecords.map(h => h.population).reverse()
      : [country.currentPopulation];

    const unemploymentHistory = historicalRecords.length > 0
      ? historicalRecords.map(h => country.unemploymentRate || 5.0).reverse()
      : [country.unemploymentRate || 5.0];

    // Calculate REAL peer averages from database
    const peerCountries = await db.country.findMany({
      where: {
        economicTier: country.economicTier,
        id: { not: countryId }
      },
      select: {
        currentGdpPerCapita: true,
        currentPopulation: true,
        unemploymentRate: true
      },
      take: 10
    });

    const peerAverages = peerCountries.length > 0 ? {
      gdpPerCapita: peerCountries.reduce((sum, c) => sum + c.currentGdpPerCapita, 0) / peerCountries.length,
      population: peerCountries.reduce((sum, c) => sum + c.currentPopulation, 0) / peerCountries.length,
      unemployment: peerCountries.reduce((sum, c) => sum + (c.unemploymentRate || 5.0), 0) / peerCountries.length
    } : {
      gdpPerCapita: country.currentGdpPerCapita,
      population: country.currentPopulation,
      unemployment: country.unemploymentRate || 5.0
    };

    const advancedIntelligenceReport = generateIntelligenceReport(
      country as any,
      { gdpHistory, populationHistory, unemploymentHistory },
      peerAverages
    );

    // ===== GENERATE VITALITY INTELLIGENCE =====
    const apiCountryData = {
      ...country,
      currentTotalGdp: country.currentTotalGdp || (country.currentPopulation * country.currentGdpPerCapita),
      lastCalculated: typeof country.lastCalculated === 'number' ? country.lastCalculated : country.lastCalculated.getTime(),
      baselineDate: typeof country.baselineDate === 'number' ? country.baselineDate : country.baselineDate.getTime()
    };

    const vitalityIntelligence = transformApiDataToVitalityIntelligence(apiCountryData as any);

    // ===== STORE VITALITY SNAPSHOTS =====
    for (const vitality of vitalityIntelligence) {
      await db.vitalitySnapshot.create({
        data: {
          countryId,
          area: mapCategory(vitality.area),
          score: vitality.score,
          trend: mapTrend(vitality.trend),
          changeValue: vitality.change.value,
          changePeriod: vitality.change.period,
          keyMetrics: JSON.stringify(vitality.keyMetrics),
          peerAverage: vitality.comparisons.peerAverage,
          regionalAverage: vitality.comparisons.regionalAverage,
          historicalBest: vitality.comparisons.historicalBest,
          rank: vitality.comparisons.rank,
          totalCountries: vitality.comparisons.totalCountries,
          criticalAlertsCount: vitality.criticalAlerts.length,
          ixTime: currentIxTime
        }
      });
    }

    // ===== DEACTIVATE OLD BRIEFINGS =====
    await db.intelligenceBriefing.updateMany({
      where: {
        countryId,
        isActive: true
      },
      data: {
        isActive: false
      }
    });

    // ===== CREATE BRIEFINGS FROM ADVANCED INTELLIGENCE =====
    if (advancedIntelligenceReport) {
      for (const alert of advancedIntelligenceReport.alerts) {
        const urgency = alert.severity === 'critical' ? 'immediate' :
                       alert.severity === 'high' ? 'this_week' :
                       alert.severity === 'medium' ? 'this_month' : 'this_quarter';

        const briefingType = alert.type === 'opportunity' ? 'opportunity' :
                            alert.type === 'anomaly' || alert.type === 'threshold' ? 'hot_issue' :
                            alert.type === 'risk' ? 'risk_mitigation' : 'strategic_initiative';

        const timeframe = urgency === 'immediate' ? 'Immediate' :
                         urgency === 'this_week' ? '1 week' :
                         urgency === 'this_month' ? '1 month' : getQuarterInfo();

        // Create briefing
        const briefing = await db.intelligenceBriefing.create({
          data: {
            countryId,
            title: alert.title,
            description: alert.description,
            type: mapBriefingType(briefingType),
            priority: mapPriority(alert.severity === 'critical' || alert.severity === 'high' ? alert.severity : 'medium'),
            area: mapCategory(alert.category),
            confidence: alert.confidence,
            urgency: mapUrgency(urgency),
            impactMagnitude: JSON.stringify({
              magnitude: alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'medium',
              scope: alert.factors,
              timeframe
            }),
            evidence: JSON.stringify({
              metrics: [
                `Current: ${alert.metrics.current.toFixed(2)}`,
                `Expected: ${alert.metrics.expected.toFixed(2)}`,
                `Deviation: ${alert.metrics.deviation.toFixed(2)}%`,
                `Z-Score: ${alert.metrics.zScore.toFixed(2)}`
              ],
              trends: [`Detected via ${alert.type} analysis`],
              comparisons: alert.factors.map(f => `Factor: ${f}`)
            }),
            generatedAt: new Date(alert.detected),
            expiresAt: new Date(alert.detected + (urgency === 'immediate' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000))
          }
        });

        // Create associated alert
        await db.intelligenceAlert.create({
          data: {
            briefingId: briefing.id,
            countryId,
            title: alert.title,
            description: alert.description,
            severity: mapPriority(alert.severity),
            category: mapCategory(alert.category),
            alertType: alert.type,
            currentValue: alert.metrics.current,
            expectedValue: alert.metrics.expected,
            deviation: alert.metrics.deviation,
            zScore: alert.metrics.zScore,
            factors: JSON.stringify(alert.factors),
            confidence: alert.confidence,
            detectedAt: new Date(alert.detected)
          }
        });

        // Create recommendations
        for (const rec of alert.recommendations) {
          await db.intelligenceRecommendation.create({
            data: {
              briefingId: briefing.id,
              countryId,
              title: rec,
              description: `Recommendation based on ${alert.type} detection`,
              category: mapCategory(alert.category),
              urgency: alert.severity === 'critical' ? 'urgent' : 'important',
              difficulty: mapDifficulty(alert.severity === 'critical' ? 'major' : 'moderate'),
              estimatedDuration: urgency === 'immediate' ? '1-2 weeks' : '1-2 months',
              estimatedCost: alert.severity === 'critical' ? 'High' : 'Medium',
              estimatedBenefit: `${Math.abs(alert.metrics.deviation / 2).toFixed(2)}% improvement`,
              prerequisites: JSON.stringify([]),
              risks: JSON.stringify([`Potential ${alert.severity} impact if not implemented correctly`]),
              successProbability: Math.min(95, alert.confidence + 10),
              economicImpact: alert.category === 'economic' ? alert.metrics.deviation / 2 : 0,
              socialImpact: alert.category === 'population' ? alert.metrics.deviation / 3 : 0,
              diplomaticImpact: alert.category === 'diplomatic' ? alert.metrics.deviation / 3 : 0
            }
          });
        }
      }
    }

    // ===== CREATE BRIEFINGS FROM VITALITY INTELLIGENCE =====
    for (const vitality of vitalityIntelligence) {
      // Hot Issues from critical alerts
      if (vitality.criticalAlerts.length > 0) {
        const briefing = await db.intelligenceBriefing.create({
          data: {
            countryId,
            title: `Critical ${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Issues`,
            description: `${vitality.criticalAlerts.length} critical alert${vitality.criticalAlerts.length !== 1 ? 's' : ''} requiring immediate action`,
            type: 'HOT_ISSUE',
            priority: 'CRITICAL',
            area: mapCategory(vitality.area),
            confidence: 95,
            urgency: 'IMMEDIATE',
            impactMagnitude: JSON.stringify({
              magnitude: 'critical',
              scope: [vitality.area, 'overall stability'],
              timeframe: 'immediate'
            }),
            evidence: JSON.stringify({
              metrics: vitality.keyMetrics.slice(0, 3).map(m => `${m.label}: ${m.value}${m.unit || ''}`),
              trends: [`Score: ${vitality.score}/100 (${vitality.trend})`],
              comparisons: [`Rank: #${vitality.comparisons.rank}/${vitality.comparisons.totalCountries}`]
            })
          }
        });

        // Create recommendations
        for (const rec of vitality.recommendations.filter(r => r.urgency === 'urgent').slice(0, 2)) {
          await db.intelligenceRecommendation.create({
            data: {
              briefingId: briefing.id,
              countryId,
              title: rec.title,
              description: rec.description,
              category: mapCategory(rec.category),
              urgency: rec.urgency,
              difficulty: mapDifficulty(rec.difficulty),
              estimatedDuration: rec.estimatedDuration,
              estimatedCost: rec.estimatedCost,
              estimatedBenefit: rec.estimatedBenefit,
              prerequisites: JSON.stringify(rec.prerequisites),
              risks: JSON.stringify(rec.risks),
              successProbability: rec.successProbability,
              economicImpact: rec.impact.economic || 0,
              socialImpact: rec.impact.social || 0,
              diplomaticImpact: rec.impact.diplomatic || 0
            }
          });
        }
      }

      // Opportunities from strong performance
      if (vitality.score > 75 && vitality.trend === 'up') {
        const topRecommendations = vitality.recommendations
          .filter(r => r.urgency === 'important')
          .sort((a, b) => b.successProbability - a.successProbability)
          .slice(0, 2);

        if (topRecommendations.length > 0) {
          const briefing = await db.intelligenceBriefing.create({
            data: {
              countryId,
              title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Growth Opportunity`,
              description: `Strong performance and positive trends create favorable conditions for strategic advancement`,
              type: 'OPPORTUNITY',
              priority: 'HIGH',
              area: mapCategory(vitality.area),
              confidence: 85,
              urgency: 'THIS_WEEK',
              impactMagnitude: JSON.stringify({
                magnitude: 'high',
                scope: [vitality.area, 'regional standing'],
                timeframe: '3-6 months'
              }),
              evidence: JSON.stringify({
                metrics: vitality.keyMetrics.slice(0, 2).map(m => `${m.label}: ${m.value}${m.unit || ''} (${m.trend})`),
                trends: [`Score improving: ${vitality.change.value > 0 ? '+' : ''}${vitality.change.value.toFixed(2)}% points`],
                comparisons: [`Above peer average: ${vitality.comparisons.peerAverage.toFixed(2)}`]
              })
            }
          });

          // Create recommendations
          for (const rec of topRecommendations) {
            await db.intelligenceRecommendation.create({
              data: {
                briefingId: briefing.id,
                countryId,
                title: rec.title,
                description: rec.description,
                category: mapCategory(rec.category),
                urgency: rec.urgency,
                difficulty: mapDifficulty(rec.difficulty),
                estimatedDuration: rec.estimatedDuration,
                estimatedCost: rec.estimatedCost,
                estimatedBenefit: rec.estimatedBenefit,
                prerequisites: JSON.stringify(rec.prerequisites),
                risks: JSON.stringify(rec.risks),
                successProbability: rec.successProbability,
                economicImpact: rec.impact.economic || 0,
                socialImpact: rec.impact.social || 0,
                diplomaticImpact: rec.impact.diplomatic || 0
              }
            });
          }
        }
      }

      // Risk Mitigation for declining areas
      if (vitality.score < 60 && vitality.trend === 'down') {
        const briefing = await db.intelligenceBriefing.create({
          data: {
            countryId,
            title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Risk Assessment`,
            description: `Declining performance indicators suggest preventive measures are needed`,
            type: 'RISK_MITIGATION',
            priority: 'HIGH',
            area: mapCategory(vitality.area),
            confidence: 80,
            urgency: 'THIS_WEEK',
            impactMagnitude: JSON.stringify({
              magnitude: 'medium',
              scope: [vitality.area],
              timeframe: '1-3 months'
            }),
            evidence: JSON.stringify({
              metrics: vitality.keyMetrics.filter(m => m.trend === 'down').map(m => `${m.label}: ${m.value}${m.unit || ''} (declining)`),
              trends: [`Score declining: ${vitality.change.value.toFixed(2)} points`],
              comparisons: [`Below peer average: ${vitality.comparisons.peerAverage.toFixed(2)}`]
            })
          }
        });

        // Create recommendations
        for (const rec of vitality.recommendations.filter(r => r.difficulty !== 'major').slice(0, 2)) {
          await db.intelligenceRecommendation.create({
            data: {
              briefingId: briefing.id,
              countryId,
              title: rec.title,
              description: rec.description,
              category: mapCategory(rec.category),
              urgency: rec.urgency,
              difficulty: mapDifficulty(rec.difficulty),
              estimatedDuration: rec.estimatedDuration,
              estimatedCost: rec.estimatedCost,
              estimatedBenefit: rec.estimatedBenefit,
              prerequisites: JSON.stringify(rec.prerequisites),
              risks: JSON.stringify(rec.risks),
              successProbability: rec.successProbability,
              economicImpact: rec.impact.economic || 0,
              socialImpact: rec.impact.social || 0,
              diplomaticImpact: rec.impact.diplomatic || 0
            }
          });
        }
      }
    }

    console.log(`[Intelligence] Successfully calculated intelligence for country ${countryId}`);
  } catch (error) {
    console.error(`[Intelligence] Error calculating intelligence for country ${countryId}:`, error);
    throw error;
  }
}

/**
 * Calculate intelligence for all countries or a specific country
 */
export async function calculateIntelligence(options: CalculateIntelligenceOptions = {}) {
  const { countryId, forceRecalculate = false } = options;

  try {
    if (countryId) {
      // Calculate for specific country
      await calculateCountryIntelligence(countryId);
    } else {
      // Calculate for all countries
      const countries = await db.country.findMany({
        select: { id: true, name: true }
      });

      console.log(`[Intelligence] Calculating intelligence for ${countries.length} countries`);

      for (const country of countries) {
        try {
          await calculateCountryIntelligence(country.id);
        } catch (error) {
          console.error(`[Intelligence] Failed to calculate intelligence for ${country.name}:`, error);
          // Continue with other countries even if one fails
        }
      }

      console.log(`[Intelligence] Finished calculating intelligence for all countries`);
    }
  } catch (error) {
    console.error('[Intelligence] Error in calculateIntelligence:', error);
    throw error;
  }
}
