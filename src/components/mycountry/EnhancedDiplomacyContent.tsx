"use client";

import { useState, useEffect } from "react";
import { Globe, Eye, Building2, Calendar, Send, FileText } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData } from "./primitives";
import { MyCountryNavCards } from "./MyCountryNavCards";
import { DiplomacyOverview } from "~/components/diplomacy/DiplomacyOverview";
import { EmbassyNetworkPanel } from "~/components/diplomacy/EmbassyNetworkPanel";
import { DiplomaticMissionsPanel } from "~/components/diplomacy/DiplomaticMissionsPanel";
import { CommunicationsPanel } from "~/components/diplomacy/CommunicationsPanel";
import { EventsPanel } from "~/components/diplomacy/EventsPanel";

interface EnhancedDiplomacyContentProps {
  variant?: "unified" | "standard" | "premium";
  title?: string;
}

type DiplomacyTab = "overview" | "network" | "missions" | "communications" | "events";

export function EnhancedDiplomacyContent({
  variant = "unified",
  title,
}: EnhancedDiplomacyContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<DiplomacyTab>("overview");
  const [navCardsCollapsed, setNavCardsCollapsed] = useState(false);

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  // Auto-collapse navigation cards on scroll
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY > 100 && currentScrollY > lastScrollY) {
            setNavCardsCollapsed(true);
          } else if (currentScrollY < 80 || currentScrollY < lastScrollY) {
            setNavCardsCollapsed(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  const tabs = [
    { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over" },
    { value: "network", icon: Building2, label: "Network", shortLabel: "Net" },
    { value: "missions", icon: Calendar, label: "Missions", shortLabel: "Miss" },
    { value: "communications", icon: Send, label: "Comms", shortLabel: "Comms" },
    { value: "events", icon: FileText, label: "Events", shortLabel: "Events" },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Diplomacy Header with MyCountry Branding */}
      <div id="overview">
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 p-2 flex-shrink-0">
              <Globe className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{country.name}</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Diplomatic Operations & International Relations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <MyCountryNavCards currentPage="diplomacy" collapsed={navCardsCollapsed} />

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DiplomacyTab)}
        className="space-y-4"
      >
        {/* Tab Navigation */}
        <div className="overflow-x-auto">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 min-w-fit gap-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
              >
                <tab.icon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" id="overview">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <DiplomacyOverview countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Embassy Network Tab */}
        <TabsContent value="network" id="network">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <EmbassyNetworkPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" id="missions">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <DiplomaticMissionsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications" id="communications">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <CommunicationsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" id="events">
          <ThemedTabContent theme="diplomacy" className="tab-content-enter">
            <EventsPanel countryId={country.id} />
          </ThemedTabContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}
