"use client";

import React, { useState } from "react";
import {
  Send,
  Globe,
  Calendar,
  Users,
  FileText,
  Building2,
  Plus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useMyCountryUnifiedData } from "./primitives";
import { useUser } from "~/context/auth-context";
import { SecureCommunications } from "~/app/mycountry/intelligence/_components/SecureCommunications";
import { DiplomaticEventsHub } from "~/app/mycountry/diplomacy/_components/DiplomaticEventsHub";
import { api } from "~/trpc/react";
import { LoadingState } from "~/components/shared";
import {
  EmbassyCard,
  MissionCard,
} from "~/components/diplomatic/diplomatic-operations";

interface DiplomacyTabSystemProps {
  variant?: "unified" | "standard" | "premium";
}

export function DiplomacyTabSystem({ variant = "unified" }: DiplomacyTabSystemProps) {
  const { user } = useUser();
  const { country } = useMyCountryUnifiedData();
  const [activeTab, setActiveTab] = useState("network");

  // Fetch embassies
  const { data: embassies, isLoading: embassiesLoading } = api.diplomatic.getEmbassies.useQuery(
    { countryId: country?.id || "" },
    { enabled: !!country?.id }
  );

  // TODO: Implement getActiveMissions endpoint in diplomatic router
  // For now, using empty array until embassy missions API is implemented
  const missions: any[] = [];
  const missionsLoading = false;

  if (!country) return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value)}
      className="space-y-4"
    >
      <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5">
        <TabsTrigger value="network" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">Network</span>
        </TabsTrigger>
        <TabsTrigger value="missions" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Missions</span>
        </TabsTrigger>
        <TabsTrigger value="communications" className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">Comms</span>
        </TabsTrigger>
        {(variant === "premium" || variant === "unified") && (
          <>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="npcs" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">NPC Intel</span>
            </TabsTrigger>
          </>
        )}
      </TabsList>

      {/* Embassy Network Tab */}
      <TabsContent value="network">
        <ThemedTabContent theme="diplomacy">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Embassy Network</h3>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Establish Embassy
              </Button>
            </div>

            {embassiesLoading ? (
              <LoadingState variant="spinner" size="lg" message="Loading embassies..." />
            ) : embassies && embassies.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {embassies.map((embassy) => (
                  <EmbassyCard
                    key={embassy.id}
                    embassy={embassy}
                    isExpanded={false}
                    onToggle={() => {}}
                    onUpgrade={() => {}}
                    onStartMission={() => {}}
                    onAllocateBudget={() => {}}
                  />
                ))}
              </div>
            ) : (
              <Card className="glass-hierarchy-child">
                <CardContent className="py-12 text-center">
                  <Building2 className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                  <h3 className="mb-2 text-lg font-semibold">No Embassies Yet</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Establish your first embassy to begin building diplomatic relationships
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Establish First Embassy
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </ThemedTabContent>
      </TabsContent>

      {/* Missions Tab */}
      <TabsContent value="missions">
        <ThemedTabContent theme="diplomacy">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Diplomatic Missions</h3>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Start Mission
              </Button>
            </div>

            {missionsLoading ? (
              <LoadingState variant="spinner" size="lg" message="Loading missions..." />
            ) : missions && missions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {missions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onComplete={() => {}}
                  />
                ))}
              </div>
            ) : (
              <Card className="glass-hierarchy-child">
                <CardContent className="py-12 text-center">
                  <Calendar className="text-muted-foreground mx-auto mb-4 h-16 w-16 opacity-50" />
                  <h3 className="mb-2 text-lg font-semibold">No Active Missions</h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Launch diplomatic missions to strengthen relationships and achieve strategic goals
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Start First Mission
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </ThemedTabContent>
      </TabsContent>

      {/* Communications Tab */}
      <TabsContent value="communications">
        <ThemedTabContent theme="diplomacy">
          <SecureCommunications countryId={country.id} countryName={country.name} />
        </ThemedTabContent>
      </TabsContent>

      {/* Events Tab */}
      {(variant === "premium" || variant === "unified") && (
        <TabsContent value="events">
          <ThemedTabContent theme="diplomacy">
            <DiplomaticEventsHub countryId={country.id} countryName={country.name} />
          </ThemedTabContent>
        </TabsContent>
      )}

      {/* NPC Intel Tab */}
      {(variant === "premium" || variant === "unified") && (
        <TabsContent value="npcs">
          <ThemedTabContent theme="diplomacy">
            <Card className="glass-hierarchy-child">
              <CardContent className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-cyan-600" />
                <h3 className="mb-2 text-xl font-semibold">NPC Intelligence</h3>
                <p className="text-muted-foreground">
                  View NPC country personalities, archetypes, and behavioral predictions.
                </p>
              </CardContent>
            </Card>
          </ThemedTabContent>
        </TabsContent>
      )}
    </Tabs>
  );
}
