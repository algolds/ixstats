"use client";

import { useState } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { Sword, Target, Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MilitaryCustomizer } from "~/components/defense/MilitaryCustomizer";
import { OperationsPanel } from "~/components/defense/OperationsPanel";
import { DefenseCommandPanel } from "~/components/defense/DefenseCommandPanel";
import { useCountryData, SectionShell, InlineWiki, TabHeroBanner } from "./primitives";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { DefenseSidebarWidget } from "./sidebar-widgets/DefenseSidebarWidget";

const DashboardMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DashboardMapWidget").then((m) => ({
      default: m.DashboardMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
);

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedDefenseContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

type DefenseTab = "command" | "forces" | "operations";

export function EnhancedDefenseContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedDefenseContentProps) {
  const { country, isLoading } = useCountryData();
  const [activeTab, setActiveTab] = useState<DefenseTab>("command");

  // Get security assessment
  const { data: securityData } = api.security.getSecurityAssessment.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  if (isLoading || !country) {
    return null;
  }

  const activeThreatCount = securityData?.activeThreatCount ?? 0;

  const tabs = [
    {
      value: "command" as const,
      icon: Activity,
      label: "Command",
      shortLabel: "Cmd",
      badge: activeThreatCount,
    },
    { value: "forces" as const, icon: Sword, label: "Forces", shortLabel: "Forces", badge: 0 },
    {
      value: "operations" as const,
      icon: Target,
      label: "Operations",
      shortLabel: "Ops",
      badge: 0,
    },
  ];

  return (
    <SectionShell
      section="defense"
      hero={<DashboardMapWidget countryId={country.id} viewMode="defense" />}
      contextWidget={<DefenseSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* Main Content Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DefenseTab)}
          className="space-y-3"
        >
          <TabsList className="grid w-full grid-cols-3 gap-0.5">
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
                  <span
                    className={`inline-flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] leading-none font-bold ${
                      tab.value === "command" && activeThreatCount > 0
                        ? "bg-red-500 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Command Tab — Budget/Readiness + Stability (collapsible) */}
          <TabsContent value="command">
            <ThemedTabContent theme="defense" className="tab-content-enter">
              <DefenseCommandPanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          {/* Forces Tab — MilitaryCustomizer */}
          <TabsContent value="forces">
            <ThemedTabContent theme="defense" className="tab-content-enter">
              <TabHeroBanner
                context="defense_forces"
                title="Military Forces"
                subtitle="Branch customization and force structure"
                icon={Sword}
                accentColor="red"
              />
              <MilitaryCustomizer countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>

          {/* Operations Tab — Deployments + PvP + Active Ops */}
          <TabsContent value="operations">
            <ThemedTabContent theme="defense" className="tab-content-enter">
              <TabHeroBanner
                context="defense_operations"
                title="Active Operations"
                subtitle="Deployments and tactical missions"
                icon={Target}
                accentColor="red"
              />
              <OperationsPanel countryId={country.id} />
            </ThemedTabContent>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Wiki woven inline */}
      <InlineWiki context="defense" accent="red" maxSections={1} />
    </SectionShell>
  );
}

export default EnhancedDefenseContent;
