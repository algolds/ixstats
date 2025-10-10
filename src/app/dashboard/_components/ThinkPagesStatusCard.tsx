"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Clock,
  ChevronRight,
  Zap,
  Brain,
  BookOpen,
  Lightbulb
} from "lucide-react";

interface ThinkPagesStatusCardProps {
  userProfile?: any;
  className?: string;
  onCollapse?: () => void;
}

export function ThinkPagesStatusCard({ userProfile, className = "", onCollapse }: ThinkPagesStatusCardProps) {
  // TODO: Re-enable when thinkpages and activities routers are available
  // const { data: postsData } = api.thinkpages.getAllPosts.useQuery(
  //   { limit: 100 },
  //   { enabled: !!userProfile }
  // );

  // const { data: activitiesData } = api.activities.getUserActivities.useQuery(
  //   { userId: userProfile?.id || '', limit: 50 },
  //   { enabled: !!userProfile }
  // );

  // Use placeholder stats until APIs are available
  const thinkPagesStats = {
    userPosts: 0,
    totalViews: 0,
    activeProjects: 0,
    weeklyGrowth: 0,
    lastActivity: "No recent activity",
    reputation: 100,
    collaborations: 0
  };

  function getRelativeTime(date: Date | string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "just now";
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  }

  return (
    <div className={className}>
      <Card className="glass-hierarchy-child h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Brain className="h-5 w-5 text-blue-500" />
              ThinkPages
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Preview
              </Badge>
              {onCollapse && (
                <button 
                  className="glass-hierarchy-interactive p-1 rounded hover:scale-110 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCollapse();
                  }}
                >
                  <ChevronRight className="h-4 w-4 text-foreground" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Account Status */}
          <div className="glass-hierarchy-interactive rounded-lg p-3 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Account Status</span>
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Reputation: {thinkPagesStats.reputation.toLocaleString()}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-hierarchy-interactive rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <FileText className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-lg font-semibold">{thinkPagesStats.userPosts}</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>
            
            <div className="glass-hierarchy-interactive rounded-lg p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <Users className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-lg font-semibold">{thinkPagesStats.collaborations}</div>
              <div className="text-xs text-muted-foreground">Collabs</div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Views</span>
              <span className="font-medium">{thinkPagesStats.totalViews.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active Projects</span>
              <span className="font-medium">{thinkPagesStats.activeProjects}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Weekly Growth
              </span>
              <span className="font-medium text-green-600">+{thinkPagesStats.weeklyGrowth}%</span>
            </div>
          </div>

          {/* Last Activity */}
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last activity
              </span>
              <span>{thinkPagesStats.lastActivity}</span>
            </div>
          </div>

          {/* Action Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="pt-2"
          >
            <Link 
              href="/thinkpages"
              className="w-full flex items-center justify-between glass-hierarchy-interactive rounded-lg p-3 hover:bg-accent/10 transition-colors group"
            >
              <span className="text-sm font-medium">Open ThinkPages</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}