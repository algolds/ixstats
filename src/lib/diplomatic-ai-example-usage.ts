/**
 * Diplomatic Response AI - Usage Examples
 *
 * This file demonstrates how to integrate the DiplomaticResponseAI
 * into your tRPC routers and React components.
 */

import { DiplomaticResponseAI, type WorldState } from './diplomatic-response-ai';
import type { DiplomaticChoice } from './diplomatic-choice-tracker';

// ==================== tRPC ROUTER INTEGRATION ====================

/**
 * Example tRPC procedure for generating diplomatic events
 *
 * Add this to: src/server/api/routers/diplomatic.ts
 */
export const exampleTRPCProcedure = {
  // GET diplomatic events for a country
  generateEvents: {
    input: { countryId: 'string' },
    async handler(ctx: any, input: any) {
      const { countryId } = input;

      // 1. Fetch country data
      const country = await ctx.db.country.findUnique({
        where: { id: countryId },
        include: {
          embassiesHosting: true,
          embassiesGuest: true,
        },
      });

      if (!country) {
        throw new Error('Country not found');
      }

      // 2. Fetch all embassies (both hosting and guest)
      const allEmbassies = [
        ...country.embassiesHosting.map((e: any) => ({
          ...e,
          role: 'host' as const,
          country: e.guestCountryId,
          countryId: e.guestCountryId,
        })),
        ...country.embassiesGuest.map((e: any) => ({
          ...e,
          role: 'guest' as const,
          country: e.hostCountryId,
          countryId: e.hostCountryId,
        })),
      ].filter((e) => e.status === 'active');

      // 3. Fetch diplomatic relationships
      const relationships = await ctx.db.diplomaticRelation.findMany({
        where: {
          OR: [{ country1: countryId }, { country2: countryId }],
        },
      });

      // Transform to RelationshipState format
      const relationshipStates = relationships.map((r: { country1: string; country2: string; relationship: string; strength: number; treaties?: string; tradeVolume?: number; culturalExchange?: string; recentActivity?: string }) => ({
        targetCountry: r.country1 === countryId ? r.country2 : r.country1,
        targetCountryId: r.country1 === countryId ? r.country2 : r.country1,
        relationship: r.relationship as any,
        strength: r.strength,
        treaties: r.treaties ? JSON.parse(r.treaties) : [],
        tradeVolume: r.tradeVolume,
        culturalExchange: r.culturalExchange,
        recentActivity: r.recentActivity,
      }));

      // 4. Fetch recent diplomatic actions
      // You would implement this based on your action tracking system
      const recentActions: DiplomaticChoice[] = await fetchRecentActions(
        ctx.db,
        countryId
      );

      // 5. Fetch active treaties
      const treaties = await ctx.db.treaty.findMany({
        where: {
          parties: {
            contains: countryId,
          },
          status: 'active',
        },
      });

      const treatyStates = treaties.map((t: { id: string; name: string; type: string; parties?: string; status: string; terms: string }) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        parties: JSON.parse(t.parties || '[]'),
        status: t.status,
        terms: t.terms,
      }));

      // 6. Calculate total trade volume
      const totalTradeVolume = relationshipStates.reduce(
        (sum: number, r: { tradeVolume?: number }) => sum + (r.tradeVolume || 0),
        0
      );

      // 7. Build world state
      const worldState: WorldState = {
        countryId: country.id,
        countryName: country.name,
        embassies: allEmbassies.map((e: any) => ({
          id: e.id,
          country: e.country,
          countryId: e.countryId,
          level: e.level || 1,
          strength: e.influence || 50,
          status: e.status,
          specialization: e.specialization,
          establishedAt: e.establishedAt.toISOString(),
        })),
        relationships: relationshipStates,
        recentActions,
        economicData: {
          currentGdp: country.currentTotalGdp,
          gdpGrowth: country.actualGdpGrowth,
          economicTier: country.economicTier,
          tradeBalance: country.tradeBalance,
          totalTradeVolume,
        },
        diplomaticReputation: country.diplomaticReputation,
        activeTreaties: treatyStates,
      };

      // 8. Generate diplomatic events
      const events = DiplomaticResponseAI.analyzeWorldState(worldState);

      // 9. Store events in database
      const storedEvents = await Promise.all(
        events.map((event) =>
          ctx.db.diplomaticEvent.create({
            data: {
              country1Id: event.toCountryId,
              country2Id: event.fromCountryId,
              eventType: event.type,
              title: event.title,
              description: event.description,
              severity: event.severity,
              status: 'active',
              metadata: JSON.stringify({
                longDescription: event.longDescription,
                responseOptions: event.responseOptions,
                potentialConsequences: event.potentialConsequences,
                triggers: event.triggers,
                urgency: event.urgency,
                aiConfidence: event.aiConfidence,
                contextualRelevance: event.contextualRelevance,
                priority: event.priority,
              }),
              createdAt: new Date(event.generatedAt),
            },
          })
        )
      );

      return {
        events,
        storedEvents,
        worldState, // For debugging
      };
    },
  },
};

/**
 * Helper function to fetch recent diplomatic actions
 * Implement based on your action tracking system
 */
async function fetchRecentActions(
  db: any,
  countryId: string
): Promise<DiplomaticChoice[]> {
  // Option 1: If you store DiplomaticChoice in database
  // const actions = await db.diplomaticChoice.findMany({
  //   where: { countryId },
  //   orderBy: { timestamp: 'desc' },
  //   take: 20,
  // });

  // Option 2: Reconstruct from diplomatic events
  const diplomaticEvents = await db.diplomaticEvent.findMany({
    where: {
      OR: [{ country1Id: countryId }, { country2Id: countryId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Transform to DiplomaticChoice format
  return diplomaticEvents.map((event: any) => ({
    id: event.id,
    countryId: event.country1Id,
    type: mapEventTypeToChoiceType(event.eventType),
    targetCountry: event.country2Id,
    targetCountryId: event.country2Id,
    details: JSON.parse(event.metadata || '{}'),
    timestamp: event.createdAt.toISOString(),
    ixTimeTimestamp: event.ixTimeTimestamp || Date.now(),
  }));
}

/**
 * Map DiplomaticEvent types to DiplomaticChoice types
 */
function mapEventTypeToChoiceType(eventType: string): DiplomaticChoice['type'] {
  const mapping: Record<string, DiplomaticChoice['type']> = {
    embassy_established: 'establish_embassy',
    embassy_upgraded: 'upgrade_embassy',
    embassy_closed: 'close_embassy',
    treaty: 'sign_treaty',
    alliance: 'alliance_formation',
    trade_agreement: 'trade_agreement',
    cultural_exchange: 'cultural_exchange',
    // Add more mappings as needed
  };

  return mapping[eventType] || 'diplomatic_message';
}

// ==================== REACT COMPONENT INTEGRATION ====================

/**
 * Example React component for displaying diplomatic events
 *
 * Usage in: src/app/mycountry/intelligence/_components/DiplomaticEventsPanel.tsx
 */
export const exampleReactComponent = `
'use client';

import { useState } from 'react';
import { api } from '@/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DiplomaticEventsPanel({ countryId }: { countryId: string }) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Fetch diplomatic events
  const { data, isLoading, refetch } = api.diplomatic.generateEvents.useQuery({
    countryId,
  });

  // Respond to event mutation
  const respondToEvent = api.diplomatic.respondToEvent.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedEvent(null);
    },
  });

  if (isLoading) {
    return <div>Loading diplomatic situation...</div>;
  }

  const events = data?.events || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Diplomatic Events</h2>
        <Button onClick={() => refetch()}>
          Refresh Situation
        </Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No diplomatic events at this time. The world is calm.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event: any) => (
            <Card key={event.id} className="border-l-4" style={{
              borderLeftColor: getSeverityColor(event.severity)
            }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{event.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      From: {event.fromCountry}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityVariant(event.priority)}>
                      {event.priority}
                    </Badge>
                    <Badge variant="outline">
                      Urgency: {event.urgency}/100
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p>{event.description}</p>

                {selectedEvent?.id === event.id && (
                  <div className="space-y-4 border-t pt-4">
                    <p className="text-sm">{event.longDescription}</p>

                    <div className="space-y-2">
                      <h4 className="font-semibold">Response Options:</h4>
                      {event.responseOptions.map((option: any) => (
                        <Card
                          key={option.id}
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => {
                            respondToEvent.mutate({
                              eventId: event.id,
                              responseId: option.id,
                            });
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h5 className="font-semibold">{option.label}</h5>
                                <p className="text-sm text-muted-foreground">
                                  {option.description}
                                </p>
                                <p className="text-sm italic">
                                  Expected: {option.expectedOutcome}
                                </p>
                              </div>

                              <div className="space-y-1 text-right text-sm">
                                <div className={option.relationshipImpact > 0 ? 'text-green-600' : 'text-red-600'}>
                                  Relations: {option.relationshipImpact > 0 ? '+' : ''}{option.relationshipImpact}
                                </div>
                                <div className={option.economicImpact > 0 ? 'text-green-600' : 'text-red-600'}>
                                  Economic: {option.economicImpact.toLocaleString()}
                                </div>
                                <div className={option.reputationImpact > 0 ? 'text-green-600' : 'text-red-600'}>
                                  Reputation: {option.reputationImpact > 0 ? '+' : ''}{option.reputationImpact}
                                </div>
                              </div>
                            </div>

                            {option.risks.length > 0 && (
                              <div className="mt-2 border-t pt-2">
                                <p className="text-xs font-semibold text-red-600">Risks:</p>
                                <ul className="text-xs text-muted-foreground">
                                  {option.risks.map((risk: string, idx: number) => (
                                    <li key={idx}>• {risk}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {option.benefits.length > 0 && (
                              <div className="mt-2 border-t pt-2">
                                <p className="text-xs font-semibold text-green-600">Benefits:</p>
                                <ul className="text-xs text-muted-foreground">
                                  {option.benefits.map((benefit: string, idx: number) => (
                                    <li key={idx}>• {benefit}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={() => setSelectedEvent(
                    selectedEvent?.id === event.id ? null : event
                  )}
                >
                  {selectedEvent?.id === event.id ? 'Hide Details' : 'View Details & Respond'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function getSeverityColor(severity: string) {
  const colors: Record<string, string> = {
    critical: '#ef4444',
    warning: '#f59e0b',
    positive: '#10b981',
    info: '#3b82f6',
  };
  return colors[severity] || '#6b7280';
}

function getPriorityVariant(priority: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  const variants: Record<string, any> = {
    urgent: 'destructive',
    high: 'default',
    medium: 'secondary',
    low: 'outline',
  };
  return variants[priority] || 'outline';
}
`;

// ==================== SCHEDULED EVENT GENERATION ====================

/**
 * Example cron job for periodic event generation
 *
 * Run this every 12 hours (24 IxTime hours at 2x speed)
 */
export async function scheduledEventGeneration(db: any) {
  console.log('[DiplomaticAI] Starting scheduled event generation...');

  // Get all active countries with embassies
  const activeCountries = await db.country.findMany({
    where: {
      OR: [
        { embassiesHosting: { some: { status: 'active' } } },
        { embassiesGuest: { some: { status: 'active' } } },
      ],
    },
    include: {
      embassiesHosting: { where: { status: 'active' } },
      embassiesGuest: { where: { status: 'active' } },
    },
  });

  console.log(`[DiplomaticAI] Processing ${activeCountries.length} countries...`);

  for (const country of activeCountries) {
    try {
      // Build world state for country
      const worldState = await buildWorldStateForCountry(db, country);

      // Generate events
      const events = DiplomaticResponseAI.analyzeWorldState(worldState);

      // Store new events
      for (const event of events) {
        await db.diplomaticEvent.create({
          data: {
            country1Id: event.toCountryId,
            country2Id: event.fromCountryId,
            eventType: event.type,
            title: event.title,
            description: event.description,
            severity: event.severity,
            status: 'active',
            metadata: JSON.stringify({
              longDescription: event.longDescription,
              responseOptions: event.responseOptions,
              potentialConsequences: event.potentialConsequences,
              triggers: event.triggers,
              urgency: event.urgency,
              aiConfidence: event.aiConfidence,
              contextualRelevance: event.contextualRelevance,
              priority: event.priority,
            }),
          },
        });
      }

      console.log(
        `[DiplomaticAI] Generated ${events.length} events for ${country.name}`
      );
    } catch (error) {
      console.error(
        `[DiplomaticAI] Error generating events for ${country.name}:`,
        error
      );
    }
  }

  console.log('[DiplomaticAI] Scheduled event generation complete');
}

/**
 * Build world state for a country
 */
async function buildWorldStateForCountry(db: any, country: any): Promise<WorldState> {
  // Fetch relationships
  const relationships = await db.diplomaticRelation.findMany({
    where: {
      OR: [{ country1: country.id }, { country2: country.id }],
    },
  });

  // Fetch recent actions
  const recentActions = await fetchRecentActions(db, country.id);

  // Fetch treaties
  const treaties = await db.treaty.findMany({
    where: {
      parties: { contains: country.id },
      status: 'active',
    },
  });

  // Calculate trade volume
  const totalTradeVolume = relationships.reduce(
    (sum: number, r: any) => sum + (r.tradeVolume || 0),
    0
  );

  return {
    countryId: country.id,
    countryName: country.name,
    embassies: [
      ...country.embassiesHosting.map((e: any) => ({
        id: e.id,
        country: e.guestCountryId,
        countryId: e.guestCountryId,
        level: e.level || 1,
        strength: e.influence || 50,
        status: e.status,
        specialization: e.specialization,
        establishedAt: e.establishedAt.toISOString(),
      })),
      ...country.embassiesGuest.map((e: any) => ({
        id: e.id,
        country: e.hostCountryId,
        countryId: e.hostCountryId,
        level: e.level || 1,
        strength: e.influence || 50,
        status: e.status,
        specialization: e.specialization,
        establishedAt: e.establishedAt.toISOString(),
      })),
    ],
    relationships: relationships.map((r: any) => ({
      targetCountry: r.country1 === country.id ? r.country2 : r.country1,
      targetCountryId: r.country1 === country.id ? r.country2 : r.country1,
      relationship: r.relationship,
      strength: r.strength,
      treaties: r.treaties ? JSON.parse(r.treaties) : [],
      tradeVolume: r.tradeVolume,
      culturalExchange: r.culturalExchange,
      recentActivity: r.recentActivity,
    })),
    recentActions,
    economicData: {
      currentGdp: country.currentTotalGdp,
      gdpGrowth: country.actualGdpGrowth,
      economicTier: country.economicTier,
      tradeBalance: country.tradeBalance,
      totalTradeVolume,
    },
    diplomaticReputation: country.diplomaticReputation,
    activeTreaties: treaties.map((t: any) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      parties: JSON.parse(t.parties || '[]'),
      status: t.status,
      terms: t.terms,
    })),
  };
}

// ==================== TESTING UTILITIES ====================

/**
 * Test data generator for development/testing
 */
export function generateTestWorldState(): WorldState {
  return {
    countryId: 'test_country_123',
    countryName: 'Test Country',
    embassies: [
      {
        id: 'embassy_1',
        country: 'Pelaxia',
        countryId: 'pelaxia_id',
        level: 3,
        strength: 75,
        status: 'active',
        specialization: 'cultural',
        establishedAt: new Date().toISOString(),
      },
      {
        id: 'embassy_2',
        country: 'Burgundie',
        countryId: 'burgundie_id',
        level: 2,
        strength: 60,
        status: 'active',
        establishedAt: new Date().toISOString(),
      },
    ],
    relationships: [
      {
        targetCountry: 'Pelaxia',
        targetCountryId: 'pelaxia_id',
        relationship: 'friendly',
        strength: 78,
        treaties: ['Trade Agreement'],
        tradeVolume: 1500000,
        culturalExchange: 'Medium',
      },
      {
        targetCountry: 'Burgundie',
        targetCountryId: 'burgundie_id',
        relationship: 'cooperative',
        strength: 65,
        treaties: [],
        tradeVolume: 800000,
      },
      {
        targetCountry: 'Urcea',
        targetCountryId: 'urcea_id',
        relationship: 'strained',
        strength: 28,
        treaties: [],
        tradeVolume: 200000,
      },
    ],
    recentActions: [
      {
        id: 'action_1',
        countryId: 'test_country_123',
        type: 'establish_embassy',
        targetCountry: 'Pelaxia',
        targetCountryId: 'pelaxia_id',
        details: {},
        timestamp: new Date().toISOString(),
        ixTimeTimestamp: Date.now(),
      },
    ],
    economicData: {
      currentGdp: 5000000000,
      gdpGrowth: 3.2,
      economicTier: 'developed',
      tradeBalance: -50000000,
      totalTradeVolume: 2500000,
    },
    diplomaticReputation: 'Cooperative',
    activeTreaties: [
      {
        id: 'treaty_1',
        name: 'Pelaxia-Test Trade Agreement',
        type: 'Trade Agreement',
        parties: ['test_country_123', 'pelaxia_id'],
        status: 'active',
      },
    ],
  };
}
