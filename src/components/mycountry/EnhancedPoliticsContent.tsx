"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Vote, Landmark, Users, BarChart3 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData, VitalityRings, SectionHeaderBackground, TabHeroBanner } from "./primitives";
import type { RingConfig } from "./primitives";
import { api } from "~/trpc/react";
import { LegislaturePanel } from "~/components/executive/politics/LegislaturePanel";
import { PartyManager } from "~/components/executive/politics/PartyManager";
import { ElectionSimulator } from "~/components/executive/politics/ElectionSimulator";
import { PoliticsOverview } from "~/components/executive/politics/PoliticsOverview";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedPoliticsContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

type PoliticsTab = "overview" | "legislature" | "parties" | "elections";

export function EnhancedPoliticsContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedPoliticsContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<PoliticsTab>("overview");

  const { data: parties } = api.elections.getParties.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const { data: elections } = api.elections.getElections.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const politicsRings = useMemo((): RingConfig[] => {
    const partyCount = parties?.length ?? 0;
    const totalSeats = legislature?.totalSeats ?? 0;
    const filledSeats = parliament?.seatSummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
    const completedElections = elections?.filter((e: any) => e.status === "COMPLETED" || e.status === "completed").length ?? 0;

    const partyColor = partyCount >= 3 ? "#22c55e" : partyCount > 0 ? "#f97316" : "#6b7280";
    const seatColor = totalSeats > 0 && filledSeats >= totalSeats ? "#22c55e" : totalSeats > 0 ? "#3b82f6" : "#6b7280";

    return [
      { key: "parties", label: "Parties", subtitle: "registered", color: partyColor, icon: Users, value: partyCount, target: Math.max(partyCount + 2, 5), displayValue: `${partyCount} active`, onClick: () => setActiveTab("parties") },
      { key: "seats", label: "Parliament", subtitle: totalSeats > 0 ? `${totalSeats} total seats` : "not configured", color: seatColor, icon: Landmark, value: filledSeats, target: totalSeats || 1, displayValue: totalSeats > 0 ? `${filledSeats}/${totalSeats}` : "—", onClick: () => setActiveTab("legislature") },
      { key: "elections", label: "Elections", subtitle: "held", color: completedElections > 0 ? "#8b5cf6" : "#6b7280", icon: BarChart3, value: completedElections, target: Math.max(completedElections + 2, 3), displayValue: `${completedElections} completed`, onClick: () => setActiveTab("elections") },
    ];
  }, [parties, legislature, parliament, elections]);

  if (isLoading || !country) {
    return null;
  }

  const pendingElections = elections?.filter((e: any) => e.status === "SCHEDULED" || e.status === "scheduled" || e.status === "IN_PROGRESS" || e.status === "in_progress").length ?? 0;

  const tabs = [
    { value: "overview" as const, icon: Vote, label: "Overview", shortLabel: "Over", badge: 0 },
    { value: "legislature" as const, icon: Landmark, label: "Legislature", shortLabel: "Legis", badge: 0 },
    { value: "parties" as const, icon: Users, label: "Parties", shortLabel: "Party", badge: 0 },
    { value: "elections" as const, icon: BarChart3, label: "Elections", shortLabel: "Elect", badge: pendingElections },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="politics">
        <div className="glass-hierarchy-parent rounded-xl border border-indigo-500/30 p-3 dark:border-indigo-500/20 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              MyCountry®
            </Badge>
            <span className="text-muted-foreground text-sm">→</span>
            <Badge className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
              <Vote className="mr-1 h-3 w-3" />
              Political Landscape
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 p-2 flex-shrink-0">
              <Vote className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Legislature, Parties & Elections</p>
            </div>
          </div>
        </div>
      </SectionHeaderBackground>
    </motion.div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      <VitalityRings rings={politicsRings} title="Political Status" variant="grid" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as PoliticsTab)}
          className="space-y-3"
        >
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 min-w-fit gap-0.5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-2.5"
                >
                  <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  {tab.badge > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full text-[9px] font-bold leading-none min-w-[14px] h-3.5 px-1 bg-amber-500 text-white">
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="overview">
            <ThemedTabContent theme="politics" className="tab-content-enter">
              <PoliticsOverview
                country={country}
                parties={parties}
                legislature={legislature}
                parliament={parliament}
                elections={elections}
              />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="legislature">
            <ThemedTabContent theme="politics" className="tab-content-enter">
              <LegislaturePanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="parties">
            <ThemedTabContent theme="politics" className="tab-content-enter">
              <TabHeroBanner context="politics_parties" title="Political Parties" subtitle="Manage parties, ideologies, and support bases" icon={Users} accentColor="indigo" />
              <PartyManager countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="elections">
            <ThemedTabContent theme="politics" className="tab-content-enter">
              <TabHeroBanner context="politics_elections" title="Elections" subtitle="Schedule elections, register candidates, and view results" icon={BarChart3} accentColor="indigo" />
              <ElectionSimulator countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}
