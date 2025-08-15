"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Megaphone, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  BarChart3,
  Target,
  Zap,
  Eye,
  ArrowRight,
  Hash,
  Activity,
  PieChart,
  ThumbsUp,
  ThumbsDown,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface StrategicCommunicationsCardProps {
  userProfile?: {
    id: string;
    countryId?: string;
  };
  className?: string;
  isExpanded?: boolean;
  onToggleExpansion?: () => void;
}

export function StrategicCommunicationsCard({ 
  userProfile, 
  className,
  isExpanded = false,
  onToggleExpansion 
}: StrategicCommunicationsCardProps) {
  const [focusedCampaign, setFocusedCampaign] = useState<string | null>(null);

  // Fetch strategic communications data
  const { data: trendingTopics } = api.thinkpages.getTrendingTopics.useQuery(
    { limit: 10 },
    { enabled: !!userProfile?.countryId }
  );

  const { data: accountsData } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const { data: recentPosts } = api.thinkpages.getFeed.useQuery(
    { countryId: userProfile?.countryId || '', filter: 'recent' },
    { enabled: !!userProfile?.countryId }
  );

  // Mock data for strategic communications (replace with real API calls)
  const activeCampaigns = [
    { 
      id: 1, 
      name: "Economic Growth Narrative", 
      status: "active", 
      reach: 125000, 
      engagement: 78,
      sentiment: 82
    },
    { 
      id: 2, 
      name: "Diplomatic Unity Initiative", 
      status: "planning", 
      reach: 85000, 
      engagement: 65,
      sentiment: 75
    },
    { 
      id: 3, 
      name: "Innovation Leadership", 
      status: "monitoring", 
      reach: 200000, 
      engagement: 45,
      sentiment: 68
    },
  ];

  const publicOpinionMetrics = {
    overallApproval: 72,
    economicConfidence: 68,
    diplomaticTrust: 75,
    leadershipRating: 79
  };

  const narrativeCoordination = [
    { topic: "Economic Policy", accounts: 8, posts: 23, sentiment: "positive" },
    { topic: "Trade Relations", accounts: 5, posts: 15, sentiment: "neutral" },
    { topic: "Infrastructure", accounts: 12, posts: 31, sentiment: "positive" },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'planning': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
      case 'monitoring': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'crisis': return 'text-red-400 border-red-500/30 bg-red-500/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getSentimentColor = (sentiment: string | number) => {
    const value = typeof sentiment === 'string' ? 
      (sentiment === 'positive' ? 80 : sentiment === 'negative' ? 20 : 50) : sentiment;
    
    if (value >= 70) return 'text-green-400';
    if (value >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentIcon = (sentiment: string | number) => {
    const value = typeof sentiment === 'string' ? 
      (sentiment === 'positive' ? 80 : sentiment === 'negative' ? 20 : 50) : sentiment;
    
    if (value >= 70) return <ThumbsUp className="h-4 w-4" />;
    if (value >= 50) return <Activity className="h-4 w-4" />;
    return <ThumbsDown className="h-4 w-4" />;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <motion.div
      className={cn("lg:col-span-6", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <Card className="glass-hierarchy-parent h-full overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Megaphone className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-purple-400">
                  Strategic Communications
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Information Campaigns & Public Opinion
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Link href={createUrl("/thinkpages?view=analytics")}>
                <Button variant="outline" size="sm" className="group">
                  Analytics Center
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              {onToggleExpansion && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpansion}
                  className="p-2"
                >
                  {isExpanded ? "−" : "+"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Active Information Campaigns */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-400" />
              <h4 className="font-semibold text-sm">Information Campaigns</h4>
              <Badge variant="outline" className="text-xs">
                {activeCampaigns.filter(c => c.status === 'active').length} Active
              </Badge>
            </div>
            
            <div className="space-y-2">
              {activeCampaigns.slice(0, isExpanded ? activeCampaigns.length : 2).map((campaign) => (
                <div 
                  key={campaign.id} 
                  className="glass-hierarchy-child p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  onClick={() => setFocusedCampaign(focusedCampaign === `campaign-${campaign.id}` ? null : `campaign-${campaign.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("p-1 rounded border", getStatusColor(campaign.status))}>
                        <Zap className="h-3 w-3" />
                      </div>
                      <span className="font-medium text-sm">{campaign.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatNumber(campaign.reach)} reach
                      </Badge>
                      <div className={cn("flex items-center gap-1", getSentimentColor(campaign.sentiment))}>
                        {getSentimentIcon(campaign.sentiment)}
                        <span className="text-xs">{campaign.sentiment}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Engagement</div>
                      <Progress value={campaign.engagement} className="h-2" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Sentiment</div>
                      <Progress value={campaign.sentiment} className="h-2" />
                    </div>
                  </div>
                  
                  {focusedCampaign === `campaign-${campaign.id}` && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 pt-3 border-t border-white/10"
                    >
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <div className="text-sm font-bold">{formatNumber(campaign.reach)}</div>
                          <div className="text-xs text-muted-foreground">Total Reach</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{campaign.engagement}%</div>
                          <div className="text-xs text-muted-foreground">Engagement</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{campaign.sentiment}%</div>
                          <div className="text-xs text-muted-foreground">Positive</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Public Opinion Metrics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-green-400" />
              <h4 className="font-semibold text-sm">Public Opinion Metrics</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Overall Approval</span>
                  <span className={cn("text-sm font-bold", getSentimentColor(publicOpinionMetrics.overallApproval))}>
                    {publicOpinionMetrics.overallApproval}%
                  </span>
                </div>
                <Progress value={publicOpinionMetrics.overallApproval} className="h-2" />
              </div>
              
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Economic Confidence</span>
                  <span className={cn("text-sm font-bold", getSentimentColor(publicOpinionMetrics.economicConfidence))}>
                    {publicOpinionMetrics.economicConfidence}%
                  </span>
                </div>
                <Progress value={publicOpinionMetrics.economicConfidence} className="h-2" />
              </div>
              
              {isExpanded && (
                <>
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Diplomatic Trust</span>
                      <span className={cn("text-sm font-bold", getSentimentColor(publicOpinionMetrics.diplomaticTrust))}>
                        {publicOpinionMetrics.diplomaticTrust}%
                      </span>
                    </div>
                    <Progress value={publicOpinionMetrics.diplomaticTrust} className="h-2" />
                  </div>
                  
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Leadership Rating</span>
                      <span className={cn("text-sm font-bold", getSentimentColor(publicOpinionMetrics.leadershipRating))}>
                        {publicOpinionMetrics.leadershipRating}%
                      </span>
                    </div>
                    <Progress value={publicOpinionMetrics.leadershipRating} className="h-2" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Narrative Coordination */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-orange-400" />
              <h4 className="font-semibold text-sm">Narrative Coordination</h4>
              <Badge variant="outline" className="text-xs">
                {narrativeCoordination.reduce((sum, item) => sum + item.accounts, 0)} Accounts
              </Badge>
            </div>
            
            <div className="space-y-2">
              {narrativeCoordination.slice(0, isExpanded ? narrativeCoordination.length : 2).map((narrative, index) => (
                <div key={index} className="glass-hierarchy-child p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{narrative.topic}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {narrative.accounts} accounts
                      </Badge>
                      <div className={cn("flex items-center gap-1", getSentimentColor(narrative.sentiment))}>
                        {getSentimentIcon(narrative.sentiment)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {narrative.posts} posts coordinated
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Analysis */}
          {trendingTopics && trendingTopics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-yellow-400" />
                <h4 className="font-semibold text-sm">Trending Analysis</h4>
              </div>
              
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold text-green-400">
                      {trendingTopics.filter((topic: any) => topic.sentiment === 'positive').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Positive Trends</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-yellow-400">
                      {trendingTopics.filter((topic: any) => topic.sentiment === 'neutral').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Neutral Topics</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-red-400">
                      {trendingTopics.filter((topic: any) => topic.sentiment === 'negative').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Risk Areas</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="pt-2 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <Link href={createUrl("/thinkpages?view=campaigns")}>
                <Button variant="outline" size="sm" className="w-full">
                  <Target className="h-4 w-4 mr-2" />
                  Manage Campaigns
                </Button>
              </Link>
              
              <Link href={createUrl("/thinkpages?view=analytics")}>
                <Button variant="outline" size="sm" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}