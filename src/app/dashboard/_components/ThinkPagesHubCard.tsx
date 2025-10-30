"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Users,
  TrendingUp,
  Crown,
  Newspaper,
  MessageCircle,
  Hash,
  ArrowRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface ThinkPagesHubCardProps {
  userProfile?: {
    id: string;
    countryId?: string;
  };
  className?: string;
}

export function ThinkPagesHubCard({ userProfile, className }: ThinkPagesHubCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Fetch ThinkPages data
  const { data: accounts } = api.thinkpages.getAccountsByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  const { data: recentFeed } = api.thinkpages.getFeed.useQuery({ filter: "recent" });

  const { data: trendingTopics } = api.thinkpages.getTrendingTopics.useQuery(
    { limit: 3 },
    { enabled: !!userProfile?.countryId }
  );

  // getMentions is not implemented yet, so use empty array
  const mentions: any[] = [];

  const getAccountTypeCount = (type: string) => {
    // Note: accountType removed from User model, using role-based counting instead
    // This is a placeholder implementation - replace with actual role-based logic
    return (
      accounts?.filter((account: any) => account.role?.name?.toLowerCase() === type).length || 0
    );
  };

  const unreadMentions = Array.isArray(mentions)
    ? mentions.filter((mention: any) => !mention.read).length
    : 0;
  const recentPosts = recentFeed?.posts?.slice(0, 3) || [];
  const topTrending = trendingTopics?.slice(0, 3) || [];

  return (
    <motion.div
      className={cn("lg:col-span-4", className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="glass-hierarchy-parent h-full overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Image
                  src="/thinkpages_logo.svg"
                  alt="ThinkPages Logo"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-blue-400">
                  ThinkPages Social Hub
                </CardTitle>
                <p className="text-muted-foreground text-sm">Where Minds Meet</p>
              </div>
            </div>

            <Link href={createUrl("/thinkpages")}>
              <Button variant="outline" size="sm" className="group">
                Open Platform
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Account Status Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Account Status</h4>
              <Badge variant="outline" className="text-xs">
                {accounts?.length || 0}/25
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="glass-hierarchy-child rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Crown className="h-3 w-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Gov</span>
                </div>
                <div className="text-lg font-bold text-amber-400">
                  {getAccountTypeCount("government")}
                </div>
              </div>

              <div className="glass-hierarchy-child rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Newspaper className="h-3 w-3 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">Media</span>
                </div>
                <div className="text-lg font-bold text-blue-400">
                  {getAccountTypeCount("media")}
                </div>
              </div>

              <div className="glass-hierarchy-child rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Users className="h-3 w-3 text-green-400" />
                  <span className="text-xs font-medium text-green-400">Citizens</span>
                </div>
                <div className="text-lg font-bold text-green-400">
                  {getAccountTypeCount("citizen")}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Recent Activity</h4>

            {/* Mentions & Notifications */}
            <div className="glass-hierarchy-child flex items-center justify-between rounded-lg p-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-400" />
                <span className="text-sm">Latest Mentions</span>
              </div>
              {unreadMentions > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadMentions}
                </Badge>
              )}
            </div>

            {/* Recent Posts Preview */}
            {recentPosts.length > 0 && (
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  <span>Recent from your accounts</span>
                </div>
                {recentPosts.map((post: any) => (
                  <div key={post.id} className="glass-hierarchy-child rounded-lg p-2">
                    <div className="text-muted-foreground text-xs">@{post.account.username}</div>
                    <div className="truncate text-sm">
                      {post.content.length > 60
                        ? post.content.substring(0, 60) + "..."
                        : post.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trending Topics */}
          {topTrending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <h4 className="text-sm font-semibold">Trending Now</h4>
              </div>

              <div className="space-y-2">
                {topTrending.map((topic: any, index: number) => (
                  <Link
                    key={topic.hashtag}
                    href={createUrl(`/hashtags/${topic.hashtag}`)}
                    className="block"
                  >
                    <div className="glass-hierarchy-child rounded-lg p-2 transition-colors hover:bg-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3 w-3 text-orange-400" />
                          <span className="text-sm font-medium">{topic.hashtag}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {topic.postCount} posts
                          </span>
                          <Badge variant="outline" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="border-t border-white/10 pt-2">
            <div className="flex gap-2">
              <Link href={createUrl("/thinkpages")} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View Feed
                </Button>
              </Link>

              {accounts && accounts.length < 25 && (
                <Link href={createUrl("/thinkpages")} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
