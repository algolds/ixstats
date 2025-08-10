"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Eye,
  Calendar,
  TrendingUp,
  Users,
  Globe,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { AchievementsRankings } from './components/AchievementsRankings';
import { ExecutiveCommandCenter } from './components/ExecutiveCommandCenter';
import { NationalPerformanceCommandCenter } from './components/NationalPerformanceCommandCenter';
import { IntelligenceBriefings } from './components/IntelligenceBriefings';
import { ForwardLookingIntelligence } from './components/ForwardLookingIntelligence';
import { transformApiDataToExecutiveIntelligence } from './utils/liveDataTransformers';
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
  leader?: string;
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
  intelligenceFeed?: any[]; // Real intelligence items from API
  isOwner?: boolean;
  onPrivateAccess?: () => void;
  className?: string;
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
  intelligenceFeed = [],
  isOwner = false,
  onPrivateAccess,
  className = '',
}: PublicMyCountryPageProps) {
  // Load country flag
  const { flagUrl } = useFlag(country.name);
  // Transform existing data to new intelligence format
  const countryWithRequiredFields = { 
    ...country, 
    leader: country.leader || 'Unknown Leader',
    flag: country.flag || flagUrl || '/placeholder-flag.png'
  };
  // Transform real API data to intelligence format (no more mock data!)
  const executiveIntelligence = transformApiDataToExecutiveIntelligence(
    countryWithRequiredFields, 
    intelligenceFeed || [], // Use real intelligence feed from API
    undefined // TODO: Add previous country data from historical API
  );
  const vitalityIntelligence = executiveIntelligence.vitalityIntelligence;
  
  // Debug log to check data structure
  console.log('Executive Intelligence:', {
    alertsCount: executiveIntelligence.criticalAlerts.length,
    insightsCount: executiveIntelligence.trendingInsights.length,
    actionsCount: executiveIntelligence.urgentActions.length,
    vitalityAreas: vitalityIntelligence.map(v => ({
      area: v.area,
      recommendationsCount: v.recommendations.length,
      alertsCount: v.criticalAlerts.length
    }))
  });


  return (
    <div className={`w-full ${className}`}>
      {/* Executive Command Center - Enhanced Nation Overview */}
      <ExecutiveCommandCenter
        intelligence={executiveIntelligence}
        country={{
          name: country.name,
          flag: flagUrl || '/placeholder-flag.png',
          leader: countryWithRequiredFields.leader
        }}
        isOwner={isOwner}
        onPrivateAccess={onPrivateAccess}
        onActionClick={(action) => {
          console.log('Action clicked:', action.title);
          // Handle action clicks - could open modal, navigate, etc.
        }}
        onAlertClick={(alert) => {
          console.log('Alert clicked:', alert.title);
          // Handle alert clicks - could show details, navigate, etc.
        }}
        className="mb-12"
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
        
        {/* Left Column - Core Performance Metrics */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* National Performance Command Center - Enhanced Activity Analysis */}
          <NationalPerformanceCommandCenter
            vitalityData={vitalityIntelligence}
            onActionClick={(action) => {
              console.log('Performance action clicked:', action.title);
              // Handle performance action clicks
            }}
            onMetricClick={(metric, area) => {
              console.log('Metric clicked:', metric.label, 'in', area);
              // Handle metric drill-down
            }}
            compact={false}
          />

          {/* Intelligence Briefings - Enhanced Strategic Focus */}
          <IntelligenceBriefings
            vitalityData={vitalityIntelligence}
            onBriefingAction={(briefing) => {
              console.log('Briefing action clicked:', briefing.title);
              // Handle briefing actions
            }}
            compact={false}
          />
        </div>

        {/* Right Column - Intelligence & Timeline */}
        <div className="space-y-8">
          
          {/* Forward-Looking Intelligence */}
          <ForwardLookingIntelligence
            vitalityData={vitalityIntelligence}
            onInsightAction={(insight) => {
              console.log('Insight action clicked:', insight.title);
              // Handle predictive insight actions
            }}
            onMilestoneUpdate={(milestone) => {
              console.log('Milestone updated:', milestone.title);
              // Handle milestone updates
            }}
            compact={true}
          />
          
          {/* Achievements & Rankings */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <AchievementsRankings 
              achievements={achievements}
              rankings={rankings}
            />
          </motion.div>

          {/* National Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  Recent Milestones
                </CardTitle>
                <p className="text-muted-foreground">
                  Latest developments in {country.name}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {milestones.slice(0, 4).map((milestone, index) => {
                    const Icon = getMilestoneIcon(milestone.category);
                    return (
                      <div key={milestone.id ? `milestone-${milestone.id}` : `milestone-fallback-${index}`} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-950/20 flex items-center justify-center">
                            <Icon className="h-3 w-3 text-green-600" />
                          </div>
                          {index < Math.min(milestones.length, 4) - 1 && (
                            <div className="w-px h-6 bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-xs">{milestone.title}</h4>
                            <Badge variant="outline" className="text-xs capitalize px-1">
                              {milestone.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                            {milestone.description}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            {new Date(milestone.achievedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {milestones.length > 4 && (
                  <div className="text-center pt-4 border-t border-border mt-4">
                    <Button variant="outline" size="sm" className="text-xs">
                      View All Milestones ({milestones.length})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Call to Action for Visitors */}
      {!isOwner && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
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