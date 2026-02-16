"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Globe, Eye, Building2, Calendar, Send, FileText, Scale, Users } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData } from "./primitives";
import { DiplomacyOverview } from "~/components/diplomacy/DiplomacyOverview";
import { EmbassyNetworkPanel } from "~/components/diplomacy/EmbassyNetworkPanel";
import { DiplomaticMissionsPanel } from "~/components/diplomacy/DiplomaticMissionsPanel";
import { CommunicationsPanel } from "~/components/diplomacy/CommunicationsPanel";
import { EventsPanel } from "~/components/diplomacy/EventsPanel";
import { ForeignPolicyPanel } from "~/components/diplomacy/ForeignPolicyPanel";
import { AlliancesPanel } from "~/components/diplomacy/AlliancesPanel";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { DiplomacySidebarWidget } from "./sidebar-widgets";

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedDiplomacyContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
}

type DiplomacyTab = "overview" | "network" | "missions" | "communications" | "events" | "foreign_policy" | "alliances";

export function EnhancedDiplomacyContent({
  variant = "unified",
  title,
  activeSection,
  onNavigate,
}: EnhancedDiplomacyContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<DiplomacyTab>("overview");

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  if (isLoading || !country) {
    return null;
  }

  const tabs = [
    { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
    { value: "network", icon: Building2, label: "Network", shortLabel: "Net" },
    { value: "missions", icon: Calendar, label: "Missions", shortLabel: "Miss" },
    { value: "communications", icon: Send, label: "Comms", shortLabel: "Comms" },
    { value: "events", icon: FileText, label: "Events", shortLabel: "Events" },
    { value: "foreign_policy", icon: Scale, label: "Foreign Policy", shortLabel: "Policy" },
    { value: "alliances", icon: Users, label: "Alliances", shortLabel: "Allies" },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div id="overview" className="glass-hierarchy-parent rounded-xl border border-cyan-500/20 p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
            MyCountry®
          </Badge>
          <span className="text-muted-foreground text-sm">→</span>
          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
            <Globe className="mr-1 h-3 w-3" />
            Diplomatic Operations
          </Badge>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 p-2 flex-shrink-0">
            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Diplomatic Operations & International Relations</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
    >
      {/* Inline status strip */}
      <DiplomacySidebarWidget countryId={country.id} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DiplomacyTab)}
        className="space-y-3"
      >
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 min-w-fit gap-0.5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-1.5 sm:px-2.5"
              >
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" id="overview">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <DiplomacyOverview countryId={country.id} onTabChange={setActiveTab} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="network" id="network">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <EmbassyNetworkPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="missions" id="missions">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <DiplomaticMissionsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="communications" id="communications">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <CommunicationsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="events" id="events">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <EventsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="foreign_policy" id="foreign_policy">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <ForeignPolicyPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        <TabsContent value="alliances" id="alliances">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <AlliancesPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}
