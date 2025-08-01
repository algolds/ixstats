"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy,
  Star,
  Medal,
  Award,
  Crown,
  Target,
  TrendingUp,
  Users,
  Globe,
  Building2,
  ChevronRight,
  Sparkles,
  MapPin,
  BarChart3,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

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

interface AchievementsRankingsProps {
  achievements: Achievement[];
  rankings: RankingData[];
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

function getRankingIcon(category: RankingData['global']['category']) {
  switch (category) {
    case 'GDP':
      return TrendingUp;
    case 'Population':
      return Users;
    case 'Quality of Life':
      return Star;
    case 'Innovation':
      return Target;
  }
}

function getRankingColor(position: number, total: number) {
  const percentile = (total - position + 1) / total;
  if (percentile >= 0.9) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20';
  if (percentile >= 0.75) return 'text-green-600 bg-green-50 dark:bg-green-950/20';
  if (percentile >= 0.5) return 'text-blue-600 bg-blue-50 dark:bg-blue-950/20';
  return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
}

export function AchievementsRankings({
  achievements,
  rankings,
  className = ''
}: AchievementsRankingsProps) {
  const [selectedTab, setSelectedTab] = useState('achievements');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={className}
    >
      <Card className="glass-hierarchy-child">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <span>Excellence & Recognition</span>
            </div>
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            National achievements and international standings
          </p>
        </CardHeader>
        
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="achievements" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <span className="hidden sm:inline">Achievements</span>
                <span className="sm:hidden">Awards</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {achievements.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="rankings" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Rankings</span>
                <span className="sm:hidden">Ranks</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {rankings.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <TabsContent value="achievements" className="mt-0">
                <motion.div
                  key="achievements"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      National Achievements
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {achievements.filter(a => a.rarity === 'legendary' || a.rarity === 'epic').length} Elite
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {achievements.slice(0, 6).map((achievement, index) => {
                      const Icon = getAchievementIcon(achievement.category);
                      return (
                        <motion.div
                          key={achievement?.id ? `achievement-${achievement.id}` : `achievement-fallback-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                          className="glass-hierarchy-interactive p-4 rounded-lg cursor-pointer group"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-lg ${getAchievementRarityColor(achievement.rarity)} group-hover:scale-110 transition-transform`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-sm group-hover:text-purple-600 transition-colors">
                                  {achievement.title}
                                </h4>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {achievement.rarity}
                                </Badge>
                              </div>
                              
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {achievement.description}
                              </p>
                              
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(achievement.achievedAt).toLocaleDateString()}
                                </span>
                                <Badge variant="secondary" className="text-xs capitalize px-2 py-0">
                                  {achievement.category}
                                </Badge>
                              </div>
                            </div>
                            
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 transition-colors" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {achievements.length > 6 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm">
                        View All Achievements ({achievements.length})
                      </Button>
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              <TabsContent value="rankings" className="mt-0">
                <motion.div
                  key="rankings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-600" />
                      International Rankings
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {rankings.filter(r => r.global.position <= 10).length} Top 10
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {rankings.map((ranking, index) => {
                      const Icon = getRankingIcon(ranking.global.category);
                      const percentile = (ranking.global.total - ranking.global.position + 1) / ranking.global.total;
                      
                      return (
                        <motion.div
                          key={ranking?.global?.category ? `ranking-${ranking.global.category}-${index}` : `ranking-fallback-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-hierarchy-interactive p-4 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-blue-600" />
                              <div>
                                <h4 className="font-semibold text-sm">{ranking.global.category}</h4>
                                <p className="text-xs text-muted-foreground">Global Rankings</p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className={`text-2xl font-bold px-3 py-1 rounded-lg ${getRankingColor(ranking.global.position, ranking.global.total)}`}>
                                #{ranking.global.position}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                of {ranking.global.total}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                            <div className="text-center">
                              <div className="text-sm font-semibold text-blue-600">
                                #{ranking.regional.position}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {ranking.regional.region}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-semibold text-purple-600">
                                #{ranking.tier.position}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {ranking.tier.tier}
                              </div>
                            </div>
                          </div>

                          {/* Percentile Bar */}
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Percentile</span>
                              <span>{(percentile * 100).toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <motion.div
                                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentile * 100}%` }}
                                transition={{ duration: 1, delay: index * 0.2 }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              </TabsContent>
            </AnimatePresence>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AchievementsRankings;