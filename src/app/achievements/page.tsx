"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Trophy, Star, Medal, Crown, Sparkles, Lock, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "@clerk/nextjs";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import Link from "next/link";
import { useAchievementNotifications } from "~/hooks/useAchievementNotifications";



export default function AchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStats";
  }, []);

  const { user } = useUser();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Achievement notification system
  const achievementNotifications = useAchievementNotifications({
    countryId: userProfile?.countryId || "",
    countryName: userProfile?.country?.name || "",
    enableRealTime: false, // Can be toggled via UI
    enableToast: true,
    enableDynamicIsland: true,
    enableNotificationCenter: true
  });

  // Get user's achievements
  const { data: myAchievements } = api.achievements.getAllByCountry.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId }
  );

  // Get global leaderboard
  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery({
    limit: 20,
    category: selectedCategory !== "all" ? selectedCategory : undefined
  });

  const categories = [
    { id: "all", name: "All Achievements", icon: Star },
    { id: "Economy", name: "Economic", icon: TrendingUp },
    { id: "Diplomacy", name: "Diplomatic", icon: Crown },
    { id: "Culture", name: "Cultural", icon: Sparkles },
    { id: "General", name: "General", icon: Trophy }
  ];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "Legendary": return "text-amber-500";
      case "Epic": return "text-purple-500";
      case "Rare": return "text-blue-500";
      case "Uncommon": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  const getRarityBg = (rarity: string) => {
    switch (rarity) {
      case "Legendary": return "bg-amber-500/10 border-amber-500/20";
      case "Epic": return "bg-purple-500/10 border-purple-500/20";
      case "Rare": return "bg-blue-500/10 border-blue-500/20";
      case "Uncommon": return "bg-green-500/10 border-green-500/20";
      default: return "bg-gray-500/10 border-gray-500/20";
    }
  };

  const totalPoints = myAchievements?.reduce((sum: number, a: { points?: number | null }) => sum + (a.points || 0), 0) || 0;
  const totalAchievements = myAchievements?.length || 0;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500" />
            Achievement Constellation
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your nation's accomplishments and compete globally
          </p>
        </div>

        {/* Real-time Notifications Toggle */}
        {userProfile?.countryId && (
          <Button
            variant="outline"
            size="sm"
            onClick={achievementNotifications.isConnected ? achievementNotifications.disconnect : achievementNotifications.connect}
            className="flex items-center gap-2"
          >
            {achievementNotifications.isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="hidden sm:inline">Live Updates</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline">Enable Live Updates</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div>
        <Link href={createUrl("/leaderboards")}>
          <Button variant="outline">
            <Medal className="h-4 w-4 mr-2" />
            View Leaderboards
          </Button>
        </Link>
      </div>

      {/* User Stats */}
      {userProfile && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 border-amber-500/20">
          <CardHeader>
            <CardTitle>Your Achievement Profile</CardTitle>
            <CardDescription>{userProfile.country?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-3xl font-bold text-amber-600">{totalAchievements}</div>
                <div className="text-sm text-muted-foreground">Total Achievements</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-purple-600">{totalPoints}</div>
                <div className="text-sm text-muted-foreground">Total Points</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-blue-600">
                  {myAchievements?.filter((a: { rarity?: string | null }) => a.rarity === "Rare" || a.rarity === "Epic" || a.rarity === "Legendary").length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Rare+</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-green-600">
                  #{leaderboard?.findIndex((l: { countryId: string }) => l.countryId === userProfile.countryId)! + 1 || "—"}
                </div>
                <div className="text-sm text-muted-foreground">Global Rank</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="my-achievements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-achievements">My Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard">Global Leaderboard</TabsTrigger>
        </TabsList>

        {/* My Achievements */}
        <TabsContent value="my-achievements" className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {category.name}
                </Button>
              );
            })}
          </div>

          {/* Achievement Grid */}
          {myAchievements && myAchievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myAchievements
                .filter((a: { category?: string | null }) => selectedCategory === "all" || a.category === selectedCategory)
                .map((achievement: { id: string; icon?: string | null; rarity?: string | null; title: string; description?: string | null; category?: string | null; points?: number | null }) => (
                  <Card key={achievement.id} className={cn("overflow-hidden", getRarityBg(achievement.rarity || "Common"))}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="text-4xl">{achievement.icon}</div>
                        <Badge variant="outline" className={getRarityColor(achievement.rarity || "Common")}>
                          {achievement.rarity}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-2">{achievement.title}</CardTitle>
                      <CardDescription className="text-xs">{achievement.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="secondary">{achievement.category}</Badge>
                        <div className="flex items-center gap-1 text-amber-600">
                          <Star className="h-4 w-4" />
                          <span className="font-semibold">{achievement.points} pts</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Trophy className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Achievements Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Start playing to unlock achievements and earn points!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>Global Achievement Leaderboard</CardTitle>
              <CardDescription>Top nations by achievement points</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((entry: { countryId: string; countryName: string; achievementCount: number; rareAchievements: number; totalPoints: number }, index: number) => (
                    <div
                      key={entry.countryId}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        index < 3 ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/20" : "bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "text-2xl font-bold w-8 text-center",
                          index === 0 ? "text-amber-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-amber-700" : "text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{entry.countryName}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.achievementCount} achievements • {entry.rareAchievements} rare+
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-amber-500" />
                        <span className="text-xl font-bold">{entry.totalPoints}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No leaderboard data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
