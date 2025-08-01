"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Eye,
  Calendar,
  Trophy,
  TrendingUp,
  Users,
  Globe,
  Building2,
  MapPin,
  Flag,
  BarChart3,
  Sparkles,
  Crown,
  Shield,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { ActivityRings, createDefaultActivityRings } from './components/ActivityRings';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { HolographicNationCard } from './components/HolographicNationCard';
import { AchievementsRankings } from './components/AchievementsRankings';
import { useFlag } from '~/hooks/useFlag';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'economic' | 'diplomatic' | 'social' | 'governance';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  achievedAt: number;
  progress?: number;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  achievedAt: number;
  impact: string;
  category: 'population' | 'economic' | 'diplomatic' | 'governance';
}

interface RankingData {
  global: {
    position: number;
    total: number;
    category: 'GDP' | 'Population' | 'Quality of Life' | 'Innovation';
  };
  regional: {
    position: number;
    total: number;
    region: string;
  };
  tier: {
    position: number;
    total: number;
    tier: string;
  };
}

interface CountryStats {
  id: string;
  name: string;
  region: string;
  continent: string;
  capital?: string;
  founded?: string;
  governmentType?: string;
  flag?: string;
  
  // Core metrics
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  
  // Calculated vitality scores
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
  
  // Growth and trends
  populationGrowthRate: number;
  realGDPGrowthRate: number;
  adjustedGdpGrowth: number;
  
  // Geographic
  landArea?: number;
  populationDensity?: number;
  
  // Timestamps
  lastCalculated: number;
  baselineDate: number;
}

interface PublicMyCountryPageProps {
  country: CountryStats;
  achievements: Achievement[];
  milestones: Milestone[];
  rankings: RankingData[];
  isOwner?: boolean;
  onPrivateAccess?: () => void;
  className?: string;
}

function getAchievementRarityColor(rarity: Achievement['rarity']) {
  switch (rarity) {
    case 'legendary':
      return 'bg-gradient-to-r from-purple-600 to-pink-600 text-white';
    case 'epic':
      return 'bg-gradient-to-r from-blue-600 to-purple-600 text-white';
    case 'rare':
      return 'bg-gradient-to-r from-green-600 to-blue-600 text-white';
    case 'common':
      return 'bg-gradient-to-r from-gray-600 to-gray-700 text-white';
  }
}

function getAchievementIcon(category: Achievement['category']) {
  switch (category) {
    case 'economic':
      return TrendingUp;
    case 'diplomatic':
      return Globe;
    case 'social':
      return Users;
    case 'governance':
      return Building2;
  }
}

function getMilestoneIcon(category: Milestone['category']) {
  switch (category) {
    case 'population':
      return Users;
    case 'economic':
      return TrendingUp;
    case 'diplomatic':
      return Globe;
    case 'governance':
      return Building2;
  }
}

export function PublicMyCountryPage({
  country,
  achievements,
  milestones,
  rankings,
  isOwner = false,
  onPrivateAccess,
  className = '',
}: PublicMyCountryPageProps) {
  // Load country flag
  const { flagUrl, isLoading: flagLoading } = useFlag(country.name);
  // Create activity rings data
  const activityRingsData = createDefaultActivityRings({
    economicVitality: country.economicVitality,
    populationWellbeing: country.populationWellbeing,
    diplomaticStanding: country.diplomaticStanding,
    governmentalEfficiency: country.governmentalEfficiency,
    economicMetrics: {
      gdpPerCapita: `$${(country.currentGdpPerCapita / 1000).toFixed(0)}k`,
      growthRate: `${(country.realGDPGrowthRate * 100).toFixed(1)}%`,
      tier: country.economicTier,
    },
    populationMetrics: {
      population: `${(country.currentPopulation / 1000000).toFixed(1)}M`,
      growthRate: `${(country.populationGrowthRate * 100).toFixed(1)}%`,
      tier: country.populationTier,
    },
    diplomaticMetrics: {
      allies: '12',
      reputation: 'Rising',
      treaties: '8',
    },
    governmentMetrics: {
      approval: '72%',
      efficiency: 'High',
      stability: 'Stable',
    },
  });

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Holographic Nation Card Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <HolographicNationCard
          country={country}
          flagUrl={flagUrl}
          flagColors={['#3B82F6', '#10B981', '#F59E0B']} // Default colors, can be extracted from flag
          isOwner={isOwner}
          className="mb-8"
        />

        {isOwner && (
          <div className="flex justify-center mt-6">
            <Button 
              onClick={onPrivateAccess}
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white glass-hierarchy-interactive"
            >
              <Crown className="h-4 w-4 mr-2" />
              Access Executive Dashboard
            </Button>
          </div>
        )}
      </motion.div>



      {/* Combined Achievements & Rankings Section */}
      <AchievementsRankings 
        achievements={achievements}
        rankings={rankings}
      />

      {/* Timeline Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              National Timeline
            </CardTitle>
            <p className="text-muted-foreground">
              Key milestones in {country.name}'s development
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {milestones.slice(0, 5).map((milestone, index) => {
                const Icon = getMilestoneIcon(milestone.category);
                return (
                  <div key={milestone.id ? `milestone-${milestone.id}` : `milestone-fallback-${index}`} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-950/20 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-green-600" />
                      </div>
                      {index < milestones.length - 1 && (
                        <div className="w-px h-8 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{milestone.title}</h4>
                        <Badge variant="outline" className="text-xs capitalize">
                          {milestone.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {milestone.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{new Date(milestone.achievedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-green-600">{milestone.impact}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>


      {/* Call to Action for Visitors */}
      {!isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <Card className="glass-hierarchy-parent bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardContent className="p-8">
              <Eye className="h-12 w-12 mx-auto text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Interested in Nation Building?</h3>
              <p className="text-muted-foreground mb-6">
                Create your own country profile and compete on the global stage
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="default">
                  Start Your Nation
                </Button>
                <Button variant="outline">
                  Browse More Countries
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

export default PublicMyCountryPage;