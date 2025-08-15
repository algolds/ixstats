"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Image from "next/image";
import { 
  MessageSquare, 
  BarChart3, 
  Shield, 
  Users, 
  Settings,
  Search,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

export default function ThinkPagesMainPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("social");

  // Get user profile and country data
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  if (!user || !userProfile || !countryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-modal max-w-md w-full text-center p-8">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-blue-400" />
          <h2 className="text-2xl font-bold mb-4">Welcome to ThinkPages</h2>
          <p className="text-muted-foreground mb-6">
            Please complete your profile setup to access the social platform.
          </p>
          <Link href={createUrl("/setup")}>
            <Button className="w-full">
              Complete Setup
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-20 dark:opacity-15">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link href={createUrl("/dashboard")}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              
              <div className="h-6 w-px bg-border" />
              
              <div>
                <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Image 
                      src="/thinkpages_logo.svg" 
                      alt="ThinkPages Logo" 
                      width={32} 
                      height={32}
                      className="h-8 w-8" 
                    />
                  </div>
                  ThinkPages
                </h1>
                <p className="text-muted-foreground">Where Minds Meet</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {countryData.name}
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
              <TabsTrigger value="social" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Social Platform
              </TabsTrigger>
              <TabsTrigger value="stratcomm" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                StratComm Intelligence
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics & Insights
              </TabsTrigger>
            </TabsList>

            {/* Tab Content */}
            <div className="mt-8">
              <TabsContent value="social" className="space-y-6">
                <ThinkpagesSocialPlatform
                  countryId={countryData.id}
                  countryName={countryData.name}
                  isOwner={true}
                />
              </TabsContent>

              <TabsContent value="stratcomm" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  {/* Diplomatic Wire */}
                  <Card className="glass-hierarchy-parent">
                    <CardHeader>
                      <CardTitle className="text-red-400 flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Diplomatic Wire
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Official communications only
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Diplomatic communications feed</p>
                        <p className="text-sm">Coming in Phase 2</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Intelligence Briefings */}
                  <Card className="glass-hierarchy-parent">
                    <CardHeader>
                      <CardTitle className="text-purple-400 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Intelligence Briefings
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Enhanced intelligence system
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Enhanced intelligence briefings</p>
                        <p className="text-sm">Coming in Phase 2</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                >
                  {/* Reputation & Influence Scores */}
                  <Card className="glass-hierarchy-parent">
                    <CardHeader>
                      <CardTitle className="text-green-400 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Reputation & Influence
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Reputation scoring system</p>
                        <p className="text-sm">Coming in Phase 3</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trending Topics & Sentiment */}
                  <Card className="glass-hierarchy-parent">
                    <CardHeader>
                      <CardTitle className="text-orange-400 flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Trending & Sentiment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Sentiment analysis</p>
                        <p className="text-sm">Coming in Phase 3</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Policy Impact Metrics */}
                  <Card className="glass-hierarchy-parent">
                    <CardHeader>
                      <CardTitle className="text-blue-400 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Policy Impact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Policy impact tracking</p>
                        <p className="text-sm">Coming in Phase 3</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </div>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}