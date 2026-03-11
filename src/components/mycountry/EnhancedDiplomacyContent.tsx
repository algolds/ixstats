"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { Globe, Eye, Building2, Send, Scale, Handshake, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { useCountryData, VitalityRings, SectionHeaderBackground, TabHeroBanner } from "./primitives";
import type { RingConfig } from "./primitives";
import { api } from "~/trpc/react";
import { DiplomacyOverview } from "~/components/diplomacy/DiplomacyOverview";
import { EmbassiesAndRelationsPanel } from "~/components/diplomacy/EmbassiesAndRelationsPanel";
import { CommunicationsPanel } from "~/components/diplomacy/CommunicationsPanel";
import { ForeignPolicyPanel } from "~/components/diplomacy/ForeignPolicyPanel";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";

const DiplomacyMapWidget = dynamic(
  () => import("~/components/maps/widgets/DiplomacyMapWidget").then((m) => ({ default: m.DiplomacyMapWidget })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> }
);

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedDiplomacyContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

type DiplomacyTab = "overview" | "embassies-relations" | "communications" | "foreign-policy";

export function EnhancedDiplomacyContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedDiplomacyContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<DiplomacyTab>("overview");

  const { data: embassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );
  const { data: relations } = api.diplomatic.getRelationships.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const diplomacyRings = useMemo((): RingConfig[] => {
    const activeEmbassies = embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const totalEmbassies = embassies?.length ?? 0;

    const totalRelations = relations?.length ?? 0;
    const avgStrength = totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;
    const strongRelations = relations?.filter((r) => (r.strength ?? 0) >= 70).length ?? 0;

    return [
      { key: "embassies", label: "Embassies", subtitle: `${totalEmbassies} total`, color: "#06b6d4", icon: Building2, value: activeEmbassies, target: totalEmbassies || 1, displayValue: `${activeEmbassies} active`, onClick: () => setActiveTab("embassies-relations") },
      { key: "relations", label: "Relations", subtitle: `avg strength ${avgStrength}%`, color: "#3b82f6", icon: Handshake, value: totalRelations, target: totalRelations + 5, displayValue: `${totalRelations} nations`, onClick: () => setActiveTab("communications") },
      { key: "avg-strength", label: "Avg Strength", subtitle: "relation quality", color: "#22c55e", icon: Globe, value: avgStrength, target: 100, displayValue: `avg ${avgStrength}%`, onClick: () => setActiveTab("overview") },
      { key: "strong-ties", label: "Strong Ties", subtitle: "strength \u2265 70%", color: strongRelations > 0 ? "#a855f7" : "#64748b", icon: Sparkles, value: strongRelations, target: totalRelations || 1, displayValue: `${strongRelations} allies`, onClick: () => setActiveTab("embassies-relations") },
    ];
  }, [embassies, relations]);

  if (isLoading || !country) {
    return null;
  }

  const pendingEmbassies = embassies?.filter((e) => e.status === "PENDING" || e.status === "pending").length ?? 0;

  const tabs: { value: DiplomacyTab; icon: typeof Eye; label: string; shortLabel: string; badge: number }[] = [
    { value: "overview", icon: Eye, label: "Overview", shortLabel: "Over", badge: 0 },
    { value: "embassies-relations", icon: Building2, label: "Embassies & Relations", shortLabel: "Embassy", badge: pendingEmbassies },
    { value: "communications", icon: Send, label: "Communications", shortLabel: "Comms", badge: 0 },
    { value: "foreign-policy", icon: Scale, label: "Foreign Policy", shortLabel: "Policy", badge: 0 },
  ];

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <SectionHeaderBackground context="diplomacy">
        <div id="overview" className="glass-hierarchy-parent rounded-xl border border-cyan-500/30 p-3 dark:border-cyan-500/20 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
              MyCountry&reg;
            </Badge>
            <span className="text-muted-foreground text-sm">&rarr;</span>
            <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
              <Globe className="mr-1 h-3 w-3" />
              Diplomatic Operations
            </Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 p-2">
              <Globe className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{country.name}</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Diplomatic Operations & International Relations</p>
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
      {/* Embassy Network Map */}
      <DiplomacyMapWidget countryId={country.id} countryName={country.name} />

      {/* Diplomatic Status Rings */}
      <VitalityRings rings={diplomacyRings} title="Diplomatic Status" variant="grid" />

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
            <TabsList className="grid w-full grid-cols-4 min-w-fit gap-0.5">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-background data-[state=active]:text-foreground flex items-center gap-1 px-1.5 text-xs sm:px-2.5 sm:text-sm"
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
            <ThemedTabContent theme="diplomacy" className="tab-content-enter">
              <DiplomacyOverview countryId={country.id} onTabChange={(t) => setActiveTab(t as DiplomacyTab)} />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="embassies-relations">
            <ThemedTabContent theme="diplomacy" className="tab-content-enter">
              <TabHeroBanner context="diplo_network" title="Embassies & Relations" subtitle="Embassy network, alliances, cultural exchanges, and events" icon={Building2} accentColor="cyan" />
              <EmbassiesAndRelationsPanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="communications">
            <ThemedTabContent theme="diplomacy" className="tab-content-enter">
              <TabHeroBanner context="diplo_comms" title="Communications" subtitle="Secure channels and official correspondence" icon={Send} accentColor="cyan" />
              <CommunicationsPanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          <TabsContent value="foreign-policy">
            <ThemedTabContent theme="diplomacy" className="tab-content-enter">
              <TabHeroBanner context="diplo_foreign_policy" title="Foreign Policy" subtitle="Strategic foreign relations framework" icon={Scale} accentColor="cyan" />
              <ForeignPolicyPanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}
