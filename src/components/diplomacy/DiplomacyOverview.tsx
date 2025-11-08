"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Building2,
  Globe,
  MessageSquare,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  Send,
  HelpCircle,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface DiplomacyOverviewProps {
  countryId: string;
}

export function DiplomacyOverview({ countryId }: DiplomacyOverviewProps) {
  const router = useRouter();

  // Fetch diplomatic data
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relationships = [] } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // TODO: Implement getActiveMissions endpoint in diplomatic router
  // For now, using empty array until embassy missions API is implemented
  const missions: any[] = [];

  // Calculate metrics
  const activeEmbassies = embassies.filter((e: any) => e.status === "ACTIVE").length;
  const totalRelationships = relationships.length;
  const activeMissions = missions.filter((m: any) => m.status === "IN_PROGRESS").length;
  const strongRelationships = relationships.filter((r: any) => (r.strength ?? 0) >= 70).length;

  const diplomacyMetrics = [
    {
      label: "Embassy Network",
      value: activeEmbassies,
      icon: Building2,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
    },
    {
      label: "Diplomatic Relations",
      value: totalRelationships,
      icon: Globe,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      label: "Active Missions",
      value: activeMissions,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/20",
    },
    {
      label: "Strong Alliances",
      value: strongRelationships,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    },
  ];

  // Get recent embassies (last 5)
  const recentEmbassies = embassies
    .sort((a: any, b: any) => new Date(b.establishedDate ?? b.createdAt).getTime() - new Date(a.establishedDate ?? a.createdAt).getTime())
    .slice(0, 5);

  // Get recent missions (last 5)
  const recentMissions = missions
    .sort((a: any, b: any) => new Date(b.startDate ?? b.createdAt).getTime() - new Date(a.startDate ?? a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header with Help */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diplomacy Overview</h2>
          <p className="text-muted-foreground text-sm">Your diplomatic network at a glance</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Diplomacy Overview - Help</DialogTitle>
              <DialogDescription>Understanding your diplomatic metrics and quick actions</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">📊 Metrics Explained</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Embassy Network:</strong> Total number of active embassies you've established with other countries</p>
                  <p><strong>Diplomatic Relations:</strong> Total countries you have diplomatic relationships with</p>
                  <p><strong>Active Missions:</strong> Currently in-progress diplomatic missions</p>
                  <p><strong>Strong Alliances:</strong> Relationships with 70+ strength rating</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🎯 Quick Actions</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Establish Embassy:</strong> Set up a new embassy in another country to strengthen ties</p>
                  <p><strong>Start Mission:</strong> Launch a diplomatic mission to achieve specific goals</p>
                  <p><strong>Send Message:</strong> Communicate securely with other nations</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">💡 Tips</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Monitor your recent embassies and missions for important updates</p>
                  <p>• Strong alliances provide diplomatic advantages and synergies</p>
                  <p>• Regular communication helps maintain relationship strength</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Diplomacy Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {diplomacyMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="glass-hierarchy-child">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm font-medium">{metric.label}</p>
                    <p className="mt-2 text-3xl font-bold">{metric.value}</p>
                  </div>
                  <div className={`rounded-lg ${metric.bgColor} p-3`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Embassies */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-600" />
                  Recent Embassies
                </CardTitle>
                <CardDescription>Your latest diplomatic establishments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/mycountry/diplomacy?tab=network")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEmbassies.length > 0 ? (
              <div className="space-y-3">
                {recentEmbassies.map((embassy: any) => (
                  <div
                    key={embassy.id}
                    className="border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-cyan-50 p-2 dark:bg-cyan-950/20">
                          <Building2 className="h-4 w-4 text-cyan-500" />
                        </div>
                        <div>
                          <div className="text-foreground font-semibold">{embassy.targetCountryName || embassy.targetCountry?.name || "Unknown"}</div>
                          <div className="text-muted-foreground text-xs">
                            {embassy.level || "Standard"} Embassy
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {embassy.status || "ACTIVE"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No embassies established yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Missions */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  Active Missions
                </CardTitle>
                <CardDescription>Your ongoing diplomatic initiatives</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push("/mycountry/diplomacy?tab=missions")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentMissions.length > 0 ? (
              <div className="space-y-3">
                {recentMissions.map((mission: any) => (
                  <div
                    key={mission.id}
                    className="border-border/40 bg-muted/40 rounded-lg border p-3 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/20">
                          <Calendar className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <div className="text-foreground font-semibold">{mission.title || mission.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {mission.type || "Diplomatic Mission"}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {mission.status || "IN_PROGRESS"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No active missions
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common diplomatic operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Button variant="outline" className="justify-start" onClick={() => router.push("/mycountry/diplomacy?tab=network")}>
              <Building2 className="mr-2 h-4 w-4" />
              Establish Embassy
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => router.push("/mycountry/diplomacy?tab=missions")}>
              <Calendar className="mr-2 h-4 w-4" />
              Start Mission
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => router.push("/mycountry/diplomacy?tab=communications")}>
              <Send className="mr-2 h-4 w-4" />
              Send Message
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
