"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
  Users,
  Calendar,
  Send,
  HelpCircle,
} from "lucide-react";
import { api } from "~/trpc/react";
import { EstablishEmbassyModal } from "~/components/diplomatic/EstablishEmbassyModal";

interface DiplomacyOverviewProps {
  countryId: string;
  onTabChange?: (tab: string) => void;
}

export function DiplomacyOverview({ countryId, onTabChange }: DiplomacyOverviewProps) {
  const [embassyModalOpen, setEmbassyModalOpen] = useState(false);

  // Fetch country data (for EstablishEmbassyModal)
  const { data: country } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

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
    <>
      <div className="space-y-4">
        {/* Header with Help */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-600" />
            <h3 className="text-sm font-semibold">Diplomacy Overview</h3>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
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
                  <h3 className="font-semibold mb-2">Metrics Explained</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Embassy Network:</strong> Total number of active embassies you&apos;ve established with other countries</p>
                    <p><strong>Diplomatic Relations:</strong> Total countries you have diplomatic relationships with</p>
                    <p><strong>Active Missions:</strong> Currently in-progress diplomatic missions</p>
                    <p><strong>Strong Alliances:</strong> Relationships with 70+ strength rating</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Quick Actions</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Establish Embassy:</strong> Set up a new embassy in another country to strengthen ties</p>
                    <p><strong>Start Mission:</strong> Launch a diplomatic mission to achieve specific goals</p>
                    <p><strong>Send Message:</strong> Communicate securely with other nations</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Tips</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Monitor your recent embassies and missions for important updates</p>
                    <p>Strong alliances provide diplomatic advantages and synergies</p>
                    <p>Regular communication helps maintain relationship strength</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Diplomacy Metrics Strip */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {diplomacyMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className={`glass-hierarchy-child rounded-lg p-2.5 ${metric.bgColor}`}>
                <div className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${metric.color}`} />
                  <span className="text-muted-foreground text-xs font-medium">{metric.label}</span>
                </div>
                <div className="mt-0.5 text-lg font-bold">{metric.value}</div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions (positioned after metrics, before activity — matches Executive pattern) */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEmbassyModalOpen(true)}>
            <Building2 className="h-3.5 w-3.5" />
            Establish Embassy
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onTabChange?.("missions")}>
            <Calendar className="h-3.5 w-3.5" />
            Start Mission
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onTabChange?.("communications")}>
            <Send className="h-3.5 w-3.5" />
            Send Message
          </Button>
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Embassies */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                  Recent Embassies
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => onTabChange?.("network")}>
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-cyan-500" />
                            <span className="truncate text-sm font-semibold">{embassy.targetCountryName || embassy.targetCountry?.name || "Unknown"}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs pl-5.5">
                            {embassy.level || "Standard"} Embassy
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
                <div className="text-muted-foreground py-6 text-center">
                  <Building2 className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <p className="text-sm">No embassies established yet</p>
                  <p className="text-muted-foreground/80 mt-1 text-xs">Establish an embassy to strengthen international ties</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Missions */}
          <Card className="glass-hierarchy-child">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  Active Missions
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => onTabChange?.("missions")}>
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-purple-500" />
                            <span className="truncate text-sm font-semibold">{mission.title || mission.name}</span>
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs pl-5.5">
                            {mission.type || "Diplomatic Mission"}
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
                <div className="text-muted-foreground py-6 text-center">
                  <Calendar className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                  <p className="text-sm">No active missions</p>
                  <p className="text-muted-foreground/80 mt-1 text-xs">Start a diplomatic mission to achieve strategic goals</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Establish Embassy Modal */}
      <EstablishEmbassyModal
        open={embassyModalOpen}
        onOpenChange={setEmbassyModalOpen}
        guestCountryId={countryId}
        guestCountryName={country?.name || "Your Country"}
      />
    </>
  );
}
