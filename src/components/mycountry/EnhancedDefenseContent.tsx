"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import { Shield, Sword, Target, Activity } from "lucide-react";
import { ShieldCheckIcon } from "~/components/ui/icons";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { MilitaryCustomizer } from "~/components/defense/MilitaryCustomizer";
import { OperationsPanel } from "~/components/defense/OperationsPanel";
import { DefenseCommandPanel } from "~/components/defense/DefenseCommandPanel";
import {
  useCountryData,
  VitalityRings,
  SectionHeaderBackground,
  TabHeroBanner,
} from "./primitives";
import type { RingConfig } from "./primitives";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";

const DefenseMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DefenseMapWidget").then((m) => ({
      default: m.DefenseMapWidget,
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

  // Get military branches
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  const branchCount = militaryBranches?.length ?? 0;
  const avgReadiness =
    branchCount > 0
      ? Math.round(
          militaryBranches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount
        )
      : 0;
  const securityScore = securityData?.overallSecurityScore ?? 0;

  const defenseRings = useMemo((): RingConfig[] => {
    const securityLevel = securityData?.securityLevel?.replace("_", " ") ?? "unknown";

    const scoreColor =
      securityScore >= 75 ? "#22c55e" : securityScore >= 50 ? "#3b82f6" : "#f97316";
    const readinessColor = avgReadiness >= 70 ? "#22c55e" : "#eab308";

    return [
      {
        key: "security",
        label: "Security",
        subtitle: securityLevel,
        color: scoreColor,
        icon: Shield,
        value: securityScore,
        target: 100,
        displayValue: `${securityScore}/100`,
        onClick: () => setActiveTab("command"),
      },
      {
        key: "branches",
        label: "Branches",
        subtitle: "military forces",
        color: "#ef4444",
        icon: Sword,
        value: branchCount,
        target: branchCount + 2,
        displayValue: `${branchCount} active`,
        onClick: () => setActiveTab("forces"),
      },
      {
        key: "readiness",
        label: "Readiness",
        subtitle: "avg. combat ready",
        color: readinessColor,
        icon: Target,
        value: avgReadiness,
        target: 100,
        displayValue: `${avgReadiness}%`,
        onClick: () => setActiveTab("operations"),
      },
    ];
  }, [securityData, securityScore, branchCount, avgReadiness]);

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

  const header = (
    <SectionHeaderBackground context="defense">
      <div
        id="overview"
        className="glass-hierarchy-parent rounded-xl border border-red-500/30 p-3 sm:p-4 dark:border-red-500/20"
      >
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
            MyCountry®
          </Badge>
          <span className="text-muted-foreground text-sm">→</span>
          <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
            <ShieldCheckIcon size={12} className="mr-1" />
            Defense & Security
          </Badge>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="shrink-0 rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-2">
            <ShieldCheckIcon size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">{country.name}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Defense & National Security Operations
            </p>
          </div>
        </div>
      </div>
    </SectionHeaderBackground>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* Defense Territory Map */}
      <DefenseMapWidget countryId={country.id} countryName={country.name} />

      {/* Defense Status Rings */}
      <VitalityRings rings={defenseRings} title="Defense Status" variant="grid" />

      {/* Compact stats strip (replaces 175-line security card) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCell
          icon={Shield}
          label="Security"
          value={`${securityScore}/100`}
          color={
            securityScore >= 75
              ? "text-green-600"
              : securityScore >= 50
                ? "text-blue-600"
                : "text-orange-600"
          }
        />
        <StatCell
          icon={Sword}
          label="Branches"
          value={`${branchCount} active`}
          color="text-red-600"
        />
        <StatCell
          icon={Target}
          label="Readiness"
          value={`${avgReadiness}%`}
          color={avgReadiness >= 70 ? "text-green-600" : "text-yellow-600"}
        />
        <StatCell
          icon={Activity}
          label="Threats"
          value={`${securityData?.activeThreatCount ?? 0}`}
          color={(securityData?.activeThreatCount ?? 0) > 0 ? "text-red-600" : "text-green-600"}
        />
      </div>

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

      <WikiLoreBlock context="defense" themeColor="red" title="Military Heritage" />
    </MyCountrySidebarLayout>
  );
}

/* ─── Stats Cell ─── */
function StatCell({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="glass-hierarchy-child rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}

export default EnhancedDefenseContent;
