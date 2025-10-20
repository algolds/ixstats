"use client";

import React, { useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Progress } from "~/components/ui/progress";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Crown,
  Star,
  TrendingUp,
  Shield,
  Zap,
  Globe,
  Building,
  Coins,
  Award,
  Target,
  ArrowRight,
} from "lucide-react";
import { formatPopulation } from "~/lib/chart-utils";

interface PopulationTierDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

interface TierData {
  tier: string;
  name: string;
  range: string;
  min: number;
  max: number;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  benefits: string[];
  challenges: string[];
  growthModifiers: {
    economic: string;
    population: string;
    development: string;
  };
}

interface CurrentTierInfo {
  current: TierData;
  next: TierData | undefined;
  previous: TierData | undefined;
  index: number;
  progressToNext: number;
  populationNeeded: number;
}

interface TierDistributionData {
  name: string;
  fullName: string;
  count: number;
  color: string;
}

interface ProcessedData {
  currentTierInfo: CurrentTierInfo | null;
  tierDistributionData: TierDistributionData[];
  currentPopulation: number;
  populationTierDistribution: Record<string, number>;
}

interface TierDistributionPayload {
  fullName: string;
}

export function PopulationTierDetailsModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: PopulationTierDetailsModalProps) {
  // Enhanced escape functionality
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const {
    data: economicData,
    isLoading: isEconomicLoading,
  } = api.countries.getEconomicData.useQuery(
    { countryId },
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const {
    data: globalStats,
    isLoading: isGlobalLoading,
  } = api.countries.getGlobalStats.useQuery(
    undefined,
    {
      enabled: isOpen,
      staleTime: 5 * 60 * 1000,
    }
  );

  const tierSystemData: TierData[] = useMemo(() => {
    const tiers = [
      {
        tier: "1",
        name: "Emerging",
        range: "0 - 9.99M",
        min: 0,
        max: 9_999_999,
        icon: "🏘️",
        color: "#ef4444",
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200",
        description: "Small emerging nations with developing infrastructure",
        benefits: [
          "Accelerated development programs",
          "International aid eligibility", 
          "Simplified governance structures",
          "Focus on basic infrastructure"
        ],
        challenges: [
          "Limited resources",
          "Vulnerability to external shocks",
          "Brain drain risks",
          "Infrastructure gaps"
        ],
        growthModifiers: {
          economic: "+15% base growth potential",
          population: "High growth rates (2-4%)",
          development: "Priority access to development funds"
        }
      },
      {
        tier: "2",
        name: "Small",
        range: "10 - 29.99M",
        min: 10_000_000,
        max: 29_999_999,
        icon: "🏙️",
        color: "#f97316",
        bgColor: "bg-orange-50 dark:bg-orange-950/20",
        borderColor: "border-orange-200",
        description: "Small to medium nations building economic foundations",
        benefits: [
          "Regional development partnerships",
          "Moderate bureaucratic overhead",
          "Flexible policy implementation",
          "Strong community cohesion"
        ],
        challenges: [
          "Market size limitations",
          "Skill shortage in specialized sectors",
          "Currency volatility",
          "Regional dependency"
        ],
        growthModifiers: {
          economic: "+10% growth bonus",
          population: "Stable growth (1.5-3%)",
          development: "Access to regional partnerships"
        }
      },
      {
        tier: "3",
        name: "Medium",
        range: "30 - 49.99M",
        min: 30_000_000,
        max: 49_999_999,
        icon: "🌆",
        color: "#eab308",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
        borderColor: "border-yellow-200",
        description: "Medium-sized nations with balanced growth potential",
        benefits: [
          "Balanced market size",
          "Diverse economic opportunities",
          "Regional influence",
          "Manageable governance complexity"
        ],
        challenges: [
          "Competition with larger economies",
          "Resource allocation challenges",
          "Infrastructure scaling needs",
          "Political fragmentation risks"
        ],
        growthModifiers: {
          economic: "+5% growth bonus",
          population: "Moderate growth (1-2.5%)",
          development: "Balanced development approach"
        }
      },
      {
        tier: "4",
        name: "Large",
        range: "50 - 79.99M",
        min: 50_000_000,
        max: 79_999_999,
        icon: "🏢",
        color: "#22c55e",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200",
        description: "Large nations with significant economic presence",
        benefits: [
          "Substantial domestic market",
          "Economic diversification potential",
          "Regional leadership opportunities",
          "Innovation ecosystems"
        ],
        challenges: [
          "Complex governance structures",
          "Regional inequality management",
          "Infrastructure maintenance costs",
          "Political coordination difficulties"
        ],
        growthModifiers: {
          economic: "Standard growth rates",
          population: "Stable growth (0.5-2%)",
          development: "Self-sufficient development"
        }
      },
      {
        tier: "5",
        name: "Major",
        range: "80 - 119.99M",
        min: 80_000_000,
        max: 119_999_999,
        icon: "🏬",
        color: "#3b82f6",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        borderColor: "border-blue-200",
        description: "Major powers with significant global influence",
        benefits: [
          "Large consumer markets",
          "Global supply chain integration",
          "Diplomatic influence",
          "Research and development hubs"
        ],
        challenges: [
          "Bureaucratic complexity",
          "Social inequality pressures",
          "Environmental impact management",
          "International obligations"
        ],
        growthModifiers: {
          economic: "-5% growth (maturity effects)",
          population: "Low growth (0.2-1.5%)",
          development: "Advanced development needs"
        }
      },
      {
        tier: "6",
        name: "Great Power",
        range: "120 - 349.99M",
        min: 120_000_000,
        max: 349_999_999,
        icon: "🌍",
        color: "#6366f1",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
        borderColor: "border-indigo-200",
        description: "Great powers with continental-scale influence",
        benefits: [
          "Massive economic scale",
          "Global market influence",
          "Technological leadership",
          "Cultural soft power"
        ],
        challenges: [
          "Governance at scale",
          "Regional disparities",
          "Resource coordination",
          "International responsibility"
        ],
        growthModifiers: {
          economic: "-10% growth (scale effects)",
          population: "Very low growth (0-1%)",
          development: "Innovation-driven development"
        }
      },
      {
        tier: "7",
        name: "Regional Hegemon",
        range: "350 - 499.99M",
        min: 350_000_000,
        max: 499_999_999,
        icon: "🌎",
        color: "#8b5cf6",
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
        borderColor: "border-purple-200",
        description: "Regional hegemons with vast territorial control",
        benefits: [
          "Continental market dominance",
          "Geopolitical leadership",
          "Resource abundance",
          "Strategic depth"
        ],
        challenges: [
          "Administrative complexity",
          "Cultural diversity management",
          "Infrastructure at scale",
          "Internal cohesion"
        ],
        growthModifiers: {
          economic: "-15% growth (diminishing returns)",
          population: "Minimal growth (0-0.8%)",
          development: "Efficiency optimization focus"
        }
      },
      {
        tier: "X",
        name: "Superpower",
        range: "500M+",
        min: 500_000_000,
        max: Infinity,
        icon: "🌏",
        color: "#ec4899",
        bgColor: "bg-pink-50 dark:bg-pink-950/20",
        borderColor: "border-pink-200",
        description: "Superpowers with global civilization-level influence",
        benefits: [
          "Global market control",
          "Civilization-level projects",
          "Ultimate strategic depth",
          "Cultural hegemon status"
        ],
        challenges: [
          "Unprecedented complexity",
          "Global responsibility",
          "Internal stability at scale",
          "Environmental stewardship"
        ],
        growthModifiers: {
          economic: "-20% growth (superpower constraints)",
          population: "Near-zero growth (0-0.5%)",
          development: "Sustainability and optimization"
        }
      }
    ];

    return tiers;
  }, []);

  const processedData: ProcessedData = useMemo(() => {
    if (!economicData || !globalStats) {
      return {
        currentTierInfo: null,
        tierDistributionData: [],
        currentPopulation: 0,
        populationTierDistribution: {} as Record<string, number>,
      };
    }

    const { currentPopulation } = economicData as any;
    const { populationTierDistribution } = globalStats as { populationTierDistribution: Record<string, number> };

    const currentTier = tierSystemData.find(tier => 
      currentPopulation >= tier.min && currentPopulation <= tier.max
    );

    const currentIndex = tierSystemData.findIndex(tier => tier === currentTier);
    const nextTier = tierSystemData[currentIndex + 1];
    const previousTier = tierSystemData[currentIndex - 1];

    const progressToNext = (currentTier && nextTier) ? 
      ((currentPopulation - currentTier.min) / (nextTier.min - currentTier.min)) * 100 : 100;

    const currentTierInfo: CurrentTierInfo | null = currentTier ? {
      current: currentTier,
      next: nextTier,
      previous: previousTier,
      index: currentIndex,
      progressToNext,
      populationNeeded: nextTier ? nextTier.min - currentPopulation : 0,
    } : null;

    const tierDistributionData: TierDistributionData[] = tierSystemData.map((tier) => ({
      name: `Tier ${tier.tier}`,
      fullName: tier.name,
      count: populationTierDistribution[tier.tier] ?? 0,
      color: tier.color,
    }));

    return {
      currentTierInfo,
      tierDistributionData,
      currentPopulation,
      populationTierDistribution,
    };
  }, [economicData, globalStats, tierSystemData]);

  const { currentTierInfo, tierDistributionData, currentPopulation } = processedData;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] max-h-[90vh] overflow-y-auto z-[13000] shadow-2xl border-2 border-white/10 backdrop-blur-xl bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Population Tier System - {countryName}
          </DialogTitle>
          <DialogDescription>
            Understanding population tiers, benefits, challenges, and advancement pathways
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Tier Status */}
          {isEconomicLoading ? (
            <Skeleton className="h-32" />
          ) : economicData && currentTierInfo?.current ? (
            <GlassCard variant="diplomatic" className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{currentTierInfo.current.icon}</div>
                  <div>
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      Tier {currentTierInfo.current.tier}: {currentTierInfo.current.name}
                      <Badge variant="default">Current</Badge>
                    </h3>
                    <p className="text-muted-foreground">{currentTierInfo.current.description}</p>
                    <p className="text-sm">
                      Population: {formatPopulation((economicData as any)?.currentPopulation || 0)} 
                      <span className="text-muted-foreground ml-2">({currentTierInfo.current.range})</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Tier Rank</div>
                  <div className="text-2xl font-bold" style={{ color: currentTierInfo.current.color }}>
                    {currentTierInfo.index + 1}/8
                  </div>
                </div>
              </div>

              {currentTierInfo.next && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress to Tier {currentTierInfo.next.tier}</span>
                    <span>{currentTierInfo.progressToNext.toFixed(1)}%</span>
                  </div>
                  <Progress value={currentTierInfo.progressToNext} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Need {formatPopulation(currentTierInfo.populationNeeded)} more people to advance
                  </div>
                </div>
              )}
            </GlassCard>
          ) : null}

          <Separator />

          {/* Current Tier Details */}
          {currentTierInfo?.current && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlassCard variant="social" className="p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Tier Benefits
                </h4>
                <div className="space-y-3">
                  {currentTierInfo.current.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h5 className="font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Growth Modifiers
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Economic:</span>
                      <span className="font-mono">{currentTierInfo.current.growthModifiers.economic}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Population:</span>
                      <span className="font-mono">{currentTierInfo.current.growthModifiers.population}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Development:</span>
                      <span className="font-mono">{currentTierInfo.current.growthModifiers.development}</span>
                    </div>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="economic" className="p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Tier Challenges
                </h4>
                <div className="space-y-3">
                  {currentTierInfo.current.challenges.map((challenge, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                      <span className="text-sm">{challenge}</span>
                    </div>
                  ))}
                </div>

                {currentTierInfo.next && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Next Tier: {currentTierInfo.next.name}
                    </h5>
                    <p className="text-sm text-muted-foreground mb-2">
                      {currentTierInfo.next.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-4 w-4" />
                      <span>Required: {formatPopulation(currentTierInfo.next.min)}+ population</span>
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          <Separator />

          {/* Complete Tier System Overview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Complete Tier System
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tierSystemData.map((tier) => (
                <GlassCard 
                  key={tier.tier}
                  variant="social" 
                  className={`p-4 transition-all ${
                    currentTierInfo?.current?.tier === tier.tier 
                      ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                      : 'hover:scale-105'
                  }`}
                >
                  <div className="text-center space-y-3">
                    <div className="text-3xl">{tier.icon}</div>
                    <div>
                      <h4 className="font-bold">Tier {tier.tier}</h4>
                      <p className="text-sm font-medium" style={{ color: tier.color }}>
                        {tier.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{tier.range}</p>
                    </div>
                    
                    {currentTierInfo?.current?.tier === tier.tier && (
                      <Badge variant="default" className="text-xs">Current</Badge>
                    )}
                    
                    {currentTierInfo?.next?.tier === tier.tier && (
                      <Badge variant="outline" className="text-xs">Next Goal</Badge>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Global Tier Distribution */}
          {!isGlobalLoading && tierDistributionData.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Global Tier Distribution
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GlassCard variant="diplomatic" className="p-6">
                    <h4 className="text-lg font-medium mb-4">Countries by Tier</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tierDistributionData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            label={({ name, count }) => count > 0 ? `${name}: ${count}` : ''}
                          >
                            {tierDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name, props) => [
                              `${value} countries`, 
                              (props as any)?.payload?.fullName || name
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </GlassCard>

                  <GlassCard variant="diplomatic" className="p-6">
                    <h4 className="text-lg font-medium mb-4">Distribution Breakdown</h4>
                    <div className="space-y-3">
                      {tierDistributionData.map((tier) => (
                        <div key={tier.name} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tier.color }}
                            />
                            <span className="text-sm font-medium">{tier.name}</span>
                          </div>
                          <div className="text-sm font-bold">{tier.count} countries</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 p-3 bg-muted/30 rounded">
                      <div className="text-sm text-muted-foreground">
                        Total countries in system: {tierDistributionData.reduce((sum, tier) => sum + tier.count, 0)}
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>
            </>
          )}

          {/* Strategic Implications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Strategic Implications
            </h3>
            
            <GlassCard variant="social" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <Building className="h-8 w-8 mx-auto mb-3 text-blue-500" />
                  <h4 className="font-semibold mb-2">Governance Complexity</h4>
                  <p className="text-sm text-muted-foreground">
                    Higher tiers require more sophisticated administrative structures and coordination mechanisms.
                  </p>
                </div>
                
                <div className="text-center">
                  <Coins className="h-8 w-8 mx-auto mb-3 text-green-500" />
                  <h4 className="font-semibold mb-2">Economic Scale</h4>
                  <p className="text-sm text-muted-foreground">
                    Larger populations enable greater market size but face diminishing returns on growth.
                  </p>
                </div>
                
                <div className="text-center">
                  <Award className="h-8 w-8 mx-auto mb-3 text-purple-500" />
                  <h4 className="font-semibant mb-2">Global Influence</h4>
                  <p className="text-sm text-muted-foreground">
                    Higher tiers gain increased diplomatic weight and responsibility in global affairs.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
