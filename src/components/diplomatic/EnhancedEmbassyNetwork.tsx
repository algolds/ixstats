"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  Building2,
  TrendingUp,
  Users,
  Zap,
  Globe,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { InlineHelpIcon } from "~/components/ui/help-icon";

interface EnhancedEmbassyNetworkProps {
  countryId: string;
  countryName: string;
  isOwner: boolean;
}

interface AtomicSynergy {
  category: string;
  matchScore: number;
  sharedComponents: string[];
  benefits: {
    economic: number;
    diplomatic: number;
    cultural: number;
  };
}

export function EnhancedEmbassyNetwork({
  countryId,
  countryName,
  isOwner
}: EnhancedEmbassyNetworkProps) {
  const [selectedEmbassy, setSelectedEmbassy] = useState<string | null>(null);

  // Fetch embassies
  const { data: embassies, isLoading } = api.diplomatic.getEmbassies.useQuery({
    countryId
  });

  // Fetch atomic government components for synergy calculation
  const { data: myComponents } = api.atomicGovernment.getComponents.useQuery(
    { countryId },
    { enabled: isOwner }
  );

  // Calculate atomic synergies for each embassy
  const embassiesWithSynergies = useMemo(() => {
    if (!embassies) return [];

    return embassies.map((embassy) => {
      // For each embassy, calculate synergies based on shared atomic components
      const synergies = calculateAtomicSynergies(myComponents, embassy);

      return {
        ...embassy,
        synergies,
        totalSynergyScore: synergies.reduce((sum, s) => sum + s.matchScore, 0),
        economicBonus: synergies.reduce((sum, s) => sum + s.benefits.economic, 0),
        diplomaticBonus: synergies.reduce((sum, s) => sum + s.benefits.diplomatic, 0),
        culturalBonus: synergies.reduce((sum, s) => sum + s.benefits.cultural, 0)
      };
    });
  }, [embassies, myComponents]);

  // Calculate overall network power
  const networkMetrics = useMemo(() => {
    if (!embassiesWithSynergies.length) return null;

    const totalEmbassies = embassiesWithSynergies.length;
    const avgSynergyScore = embassiesWithSynergies.reduce((sum, e) => sum + e.totalSynergyScore, 0) / totalEmbassies;
    const totalEconomicBonus = embassiesWithSynergies.reduce((sum, e) => sum + e.economicBonus, 0);
    const totalDiplomaticBonus = embassiesWithSynergies.reduce((sum, e) => sum + e.diplomaticBonus, 0);
    const totalCulturalBonus = embassiesWithSynergies.reduce((sum, e) => sum + e.culturalBonus, 0);

    return {
      totalEmbassies,
      avgSynergyScore,
      totalEconomicBonus,
      totalDiplomaticBonus,
      totalCulturalBonus,
      networkPower: Math.round((totalEmbassies * 10) + (avgSynergyScore * 2))
    };
  }, [embassiesWithSynergies]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Loading embassy network...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Network Overview */}
      {networkMetrics && (
        <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Embassy Network Power
              <InlineHelpIcon
                title="Embassy Network"
                content="Your total diplomatic influence calculated from active embassies and atomic government synergies. Shared atomic components between nations amplify economic, diplomatic, and cultural benefits."
              />
            </CardTitle>
            <CardDescription>
              Your diplomatic network strength and atomic synergies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {networkMetrics.totalEmbassies}
                </div>
                <div className="text-xs text-muted-foreground">Active Embassies</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {networkMetrics.networkPower}
                </div>
                <div className="text-xs text-muted-foreground">Network Power</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {networkMetrics.avgSynergyScore.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Avg Synergy</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  +{networkMetrics.totalEconomicBonus.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Economic Bonus</div>
              </div>
            </div>

            {/* Bonus Breakdown */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Economic</span>
                  <span className="font-semibold text-green-600">+{networkMetrics.totalEconomicBonus.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, networkMetrics.totalEconomicBonus * 5)} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Diplomatic</span>
                  <span className="font-semibold text-blue-600">+{networkMetrics.totalDiplomaticBonus.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, networkMetrics.totalDiplomaticBonus * 5)} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cultural</span>
                  <span className="font-semibold text-purple-600">+{networkMetrics.totalCulturalBonus.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, networkMetrics.totalCulturalBonus * 5)} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Embassy List with Synergies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {embassiesWithSynergies.map((embassy) => (
          <Card
            key={embassy.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-lg",
              selectedEmbassy === embassy.id && "ring-2 ring-primary"
            )}
            onClick={() => setSelectedEmbassy(selectedEmbassy === embassy.id ? null : embassy.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {embassy.country}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {embassy.status} • Strength {embassy.strength}/100
                  </CardDescription>
                </div>
                <Badge variant={embassy.totalSynergyScore > 50 ? "default" : "secondary"}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  {embassy.totalSynergyScore.toFixed(0)}% Synergy
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Synergy Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Synergy Strength</span>
                  <span className="font-semibold">{embassy.totalSynergyScore.toFixed(0)}%</span>
                </div>
                <Progress value={embassy.totalSynergyScore} className="h-2" />
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-green-500/10 rounded-lg p-2 text-center">
                  <div className="text-green-600 dark:text-green-400 font-bold">
                    +{embassy.economicBonus.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Economic</div>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                  <div className="text-blue-600 dark:text-blue-400 font-bold">
                    +{embassy.diplomaticBonus.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Diplomatic</div>
                </div>
                <div className="bg-purple-500/10 rounded-lg p-2 text-center">
                  <div className="text-purple-600 dark:text-purple-400 font-bold">
                    +{embassy.culturalBonus.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Cultural</div>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedEmbassy === embassy.id && embassy.synergies.length > 0 && (
                <div className="pt-3 border-t space-y-2">
                  <div className="text-xs font-semibold flex items-center gap-2">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Active Synergies
                  </div>
                  {embassy.synergies.map((synergy, idx) => (
                    <div key={idx} className="bg-muted/50 rounded p-2 text-xs space-y-1">
                      <div className="font-semibold">{synergy.category}</div>
                      <div className="text-muted-foreground">
                        {synergy.sharedComponents.join(", ")}
                      </div>
                      <div className="flex items-center gap-2 text-xs pt-1">
                        <Badge variant="outline" className="text-xs">
                          {synergy.matchScore.toFixed(0)}% Match
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button */}
              {isOwner && (
                <Button variant="outline" size="sm" className="w-full">
                  <Users className="h-3 w-3 mr-2" />
                  View Shared Data
                  <ChevronRight className="h-3 w-3 ml-auto" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {embassiesWithSynergies.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No Embassies Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Establish embassies with other countries to unlock atomic synergies and diplomatic bonuses.
                </p>
              </div>
              {isOwner && (
                <Button>
                  <Building2 className="h-4 w-4 mr-2" />
                  Establish First Embassy
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to calculate atomic synergies between countries
function calculateAtomicSynergies(
  myComponents: Array<{ componentType: string; effectivenessScore: number }> | undefined,
  embassy: any
): AtomicSynergy[] {
  if (!myComponents || myComponents.length === 0) {
    return [];
  }

  const synergies: AtomicSynergy[] = [];

  // Group components by category for synergy calculation
  const componentCategories = {
    "Power Structure": ["CENTRALIZED_POWER", "FEDERAL_SYSTEM", "CONFEDERATE_SYSTEM", "UNITARY_SYSTEM"],
    "Decision Making": ["DEMOCRATIC_PROCESS", "AUTOCRATIC_PROCESS", "TECHNOCRATIC_PROCESS", "CONSENSUS_PROCESS", "OLIGARCHIC_PROCESS"],
    "Legitimacy": ["ELECTORAL_LEGITIMACY", "TRADITIONAL_LEGITIMACY", "PERFORMANCE_LEGITIMACY", "CHARISMATIC_LEGITIMACY", "RELIGIOUS_LEGITIMACY"],
    "Institutions": ["PROFESSIONAL_BUREAUCRACY", "MILITARY_ADMINISTRATION", "INDEPENDENT_JUDICIARY", "PARTISAN_INSTITUTIONS", "TECHNOCRATIC_AGENCIES"],
    "Control": ["RULE_OF_LAW", "SURVEILLANCE_SYSTEM", "PROPAGANDA_APPARATUS", "SECURITY_FORCES", "CIVIL_SOCIETY"]
  };

  // Calculate synergies for each category
  Object.entries(componentCategories).forEach(([categoryName, categoryComponents]) => {
    const myMatchingComponents = myComponents.filter(c =>
      categoryComponents.includes(c.componentType)
    );

    if (myMatchingComponents.length > 0) {
      // Calculate match score based on component effectiveness and embassy strength
      const avgEffectiveness = myMatchingComponents.reduce((sum, c) => sum + c.effectivenessScore, 0) / myMatchingComponents.length;
      const matchScore = Math.min(100, (avgEffectiveness + embassy.strength) / 2);

      if (matchScore > 30) {
        synergies.push({
          category: categoryName,
          matchScore,
          sharedComponents: myMatchingComponents.map(c =>
            c.componentType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
          ),
          benefits: {
            economic: matchScore * 0.04,
            diplomatic: matchScore * 0.06,
            cultural: matchScore * 0.03
          }
        });
      }
    }
  });

  return synergies;
}
