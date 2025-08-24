"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Progress } from "~/components/ui/progress";

// Icons
import { 
  User, 
  Crown, 
  Trophy, 
  Users, 
  Eye, 
  Star, 
  Zap,
  Globe,
  MessageSquare,
  Settings,
  MapPin,
  Calendar,
  TrendingUp,
  Award,
  Target,
  Activity,
  Heart,
  UserPlus,
  Flag,
  Briefcase
} from "lucide-react";

// Components
import { PublicVitalityRings } from "~/components/countries/PublicVitalityRings";

// Utils
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";
import { useFlag } from "~/hooks/useUnifiedFlags";

interface SocialMetrics {
  followers: number;
  following: number;
  profileViews: number;
  influence: number;
  achievements: number;
  socialRank: number;
  engagementRate: number;
  streakDays: number;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  countryName?: string;
  countryFlag?: string;
  lastOnline: Date;
  mutualConnections: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  earnedAt: Date;
  category: 'economic' | 'diplomatic' | 'social' | 'growth' | 'milestone';
}

interface SocialUserProfileProps {
  userProfile?: {
    id: string;
    countryId?: string;
    displayName?: string;
    bio?: string;
    joinedAt?: Date;
    lastActive?: Date;
  };
  className?: string;
}

export function SocialUserProfile({ userProfile, className }: SocialUserProfileProps) {
  const { user } = useUser();
  const [showFriends, setShowFriends] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  
  // Fetch user country data
  const { data: userCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get country flag
  const { flagUrl } = useFlag(userCountry?.name);

  // Get social data from API
  const { data: socialData } = api.users.getSocialData.useQuery(
    { userId: userProfile?.id || '' },
    { enabled: !!userProfile?.id }
  );

  // Calculate social metrics from real data only
  const socialMetrics: SocialMetrics = {
    followers: socialData?.friends?.length || 0,
    following: socialData?.followingCountries?.length || 0,
    profileViews: 0, // Not tracked, keep at 0
    influence: socialData?.influence || 0,
    achievements: socialData?.achievements || 0,
    socialRank: 0, // Remove fake ranks
    engagementRate: 0, // Not calculated from real data yet
    streakDays: 0 // Not tracked yet
  };

  // Real friends data only - no placeholders
  const friends: Friend[] = [];

  // Real achievements data only - no placeholders
  const achievements: Achievement[] = [];

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'legendary': return 'text-orange-500 bg-orange-500/10';
      case 'epic': return 'text-purple-500 bg-purple-500/10';
      case 'rare': return 'text-blue-500 bg-blue-500/10';
      case 'uncommon': return 'text-green-500 bg-green-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const formatLastOnline = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 5) return 'Online now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getInfluenceLevel = (influence: number) => {
    if (influence >= 90) return { label: 'Legendary', color: 'text-orange-500', icon: Crown };
    if (influence >= 75) return { label: 'Elite', color: 'text-purple-500', icon: Star };
    if (influence >= 60) return { label: 'Rising', color: 'text-blue-500', icon: TrendingUp };
    if (influence >= 40) return { label: 'Active', color: 'text-green-500', icon: Activity };
    return { label: 'Emerging', color: 'text-gray-500', icon: User };
  };

  const influenceLevel = getInfluenceLevel(socialMetrics.influence);
  const InfluenceIcon = influenceLevel.icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Profile Card */}
      <Card className="glass-hierarchy-parent overflow-hidden">
        <CardContent className="p-6">
          {/* Profile Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-4">
              <Avatar className="h-20 w-20 border-2 border-white/10">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              
              {/* Country Flag Badge */}
              {flagUrl && (
                <div className="absolute -bottom-1 -right-1 w-8 h-6 rounded-sm overflow-hidden border-2 border-background shadow-lg">
                  <img src={flagUrl} alt="Country flag" className="w-full h-full object-cover" />
                </div>
              )}
              
              {/* Online Status */}
              <div className="absolute top-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
            </div>

            {/* User Info */}
            <div className="mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-foreground">
                  {user?.firstName || 'User'}
                </h2>
                <Badge className={cn("flex items-center gap-1 text-xs px-2 py-1", influenceLevel.color)}>
                  <InfluenceIcon className="h-3 w-3" />
                  {influenceLevel.label}
                </Badge>
              </div>
              
              {userCountry && (
                <div className="text-muted-foreground mb-3">
                  Leader of{' '}
                  <Link
                    href={createUrl(`/countries/${userCountry.id}`)}
                    className="text-foreground hover:text-primary transition-colors font-medium"
                  >
                    {userCountry.name}
                  </Link>
                </div>
              )}
            </div>

            {/* Meta Info */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {userProfile?.joinedAt ? `Joined ${userProfile.joinedAt.toLocaleDateString()}` : 'Joined recently'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Social Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {socialMetrics.followers}
              </div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {socialMetrics.following}
              </div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground mb-1">
                {socialMetrics.achievements}
              </div>
              <div className="text-sm text-muted-foreground">Achievements</div>
            </div>
          </div>

          
          {/* Influence Progress */}
          <div className="mt-4 p-3 glass-hierarchy-child rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Influence Level</span>
              <span className="text-sm text-muted-foreground">{socialMetrics.influence}/100</span>
            </div>
            <Progress value={socialMetrics.influence} className="mb-2 h-2" />
            {/* Remove placeholder streak info */}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFriends(!showFriends)}
              className="flex-1"
            >
              <Users className="h-4 w-4 mr-2" />
              Friends
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowAchievements(!showAchievements)}
              className="flex-1"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Achievements
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Friends Expanded View */}
      <AnimatePresence>
        {showFriends && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-500" />
                  Friends & Connections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-4 p-3 glass-hierarchy-interactive rounded-lg">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={friend.avatar} />
                        <AvatarFallback>{friend.name[0]}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-foreground">{friend.name}</h4>
                          {friend.countryName && (
                            <Badge variant="outline" className="text-xs">
                              {friend.countryName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatLastOnline(friend.lastOnline)} • {friend.mutualConnections} mutual connections
                        </p>
                      </div>

                      <Button variant="outline" size="sm">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button variant="outline" className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Find More Friends
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievements Expanded View */}
      <AnimatePresence>
        {showAchievements && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Recent Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {achievements.map((achievement) => (
                    <div 
                      key={achievement.id} 
                      className={cn(
                        "p-4 rounded-lg border-2 glass-hierarchy-interactive",
                        getRarityColor(achievement.rarity)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-semibold text-foreground">
                              {achievement.title}
                            </h5>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs capitalize", getRarityColor(achievement.rarity))}
                            >
                              {achievement.rarity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {achievement.description}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Earned {achievement.earnedAt.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4">
                  <Award className="h-4 w-4 mr-2" />
                  View All Achievements
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Country Vitality Rings */}
      {userCountry && (
        <PublicVitalityRings
          country={{
            name: userCountry.name,
            currentGdpPerCapita: userCountry.calculatedStats?.currentGdpPerCapita || 0,
            currentTotalGdp: userCountry.calculatedStats?.currentTotalGdp || 0,
            currentPopulation: userCountry.calculatedStats?.currentPopulation || 0,
            populationGrowthRate: userCountry.populationGrowthRate || 0,
            adjustedGdpGrowth: userCountry.adjustedGdpGrowth || 0,
            economicTier: userCountry.calculatedStats?.economicTier || 'Unknown',
            populationTier: userCountry.calculatedStats?.populationTier || 'Unknown',
            populationDensity: userCountry.calculatedStats?.populationDensity || 0,
            landArea: userCountry.landArea || 0,
            continent: userCountry.continent || null,
            region: userCountry.region || null,
          }}
          className="w-full"
        />
      )}
    </div>
  );
}