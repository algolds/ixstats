"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  TrendingUp,
  Brain,
  Settings,
  BarChart3,
  Activity,
  Shield,
  Target,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import { useAtomicState, useAtomicComponents, useAtomicAnalytics } from "./AtomicStateProvider";
import { AtomicEconomicIndicators } from "./AtomicEconomicIndicators";
import { AtomicIntelligenceCenter } from "./AtomicIntelligenceCenter";
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";

interface AtomicDashboardProps {
  variant?: "full" | "compact" | "embedded";
  allowEdit?: boolean;
  className?: string;
}

interface DashboardSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

function DashboardSection({
  title,
  icon,
  children,
  isExpanded = true,
  onToggleExpand,
  className,
}: DashboardSectionProps) {
  return (
    <motion.div
      className={cn("space-y-4", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        {onToggleExpand && (
          <Button variant="ghost" size="sm" onClick={onToggleExpand} className="h-8 w-8 p-0">
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}

export function AtomicDashboard({
  variant = "full",
  allowEdit = true,
  className,
}: AtomicDashboardProps) {
  const { state, getSystemHealth } = useAtomicState();
  const { selectedComponents, effectivenessScore, setSelectedComponents } = useAtomicComponents();
  const { systemHealth, realTimeMetrics } = useAtomicAnalytics();
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,
    components: variant === "full",
    economic: true,
    intelligence: true,
    analytics: variant === "full",
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (selectedComponents.length === 0 && variant !== "embedded") {
    return (
      <div className={cn("p-8 text-center", className)}>
        <div className="mx-auto max-w-md space-y-4">
          <div className="bg-primary/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
            <Zap className="text-primary h-10 w-10" />
          </div>
          <h2 className="text-2xl font-semibold">Atomic Dashboard</h2>
          <p className="text-muted-foreground">
            Configure atomic components for your government to see comprehensive analytics and
            intelligence.
          </p>
          <Button className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure Components
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Quick Overview */}
        <Card className="from-primary/5 to-purple/5 border-primary/20 bg-gradient-to-r">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-primary font-semibold">Atomic System Status</h3>
                <p className="text-muted-foreground text-sm">
                  {selectedComponents.length} components active
                </p>
              </div>
              <div className="text-right">
                <div className="text-primary text-2xl font-bold">
                  {effectivenessScore.toFixed(0)}%
                </div>
                <div className="text-muted-foreground text-xs">Effectiveness</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AtomicEconomicIndicators variant="compact" />
          <AtomicIntelligenceCenter variant="compact" />
        </div>
      </div>
    );
  }

  if (variant === "embedded") {
    return (
      <div className={cn("space-y-4", className)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="economic">Economic</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card className="p-3">
                <div className="flex items-center space-x-2">
                  <Zap className="text-primary h-4 w-4" />
                  <div>
                    <div className="text-lg font-bold">{effectivenessScore.toFixed(0)}%</div>
                    <div className="text-muted-foreground text-xs">Effectiveness</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-lg font-bold text-green-600">{state.synergies.length}</div>
                    <div className="text-muted-foreground text-xs">Synergies</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {realTimeMetrics.crisisResiliency.toFixed(0)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Stability</div>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {realTimeMetrics.policyImplementationSpeed.toFixed(0)}%
                    </div>
                    <div className="text-muted-foreground text-xs">Policy Speed</div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="economic">
            <AtomicEconomicIndicators variant="compact" />
          </TabsContent>

          <TabsContent value="intelligence">
            <AtomicIntelligenceCenter variant="compact" />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Full dashboard view
  return (
    <div className={cn("space-y-8", className)}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 rounded-lg p-2">
              <Zap className="text-primary h-8 w-8" />
            </div>
            Atomic Government Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive analytics and control center for your atomic government system
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
            {selectedComponents.length} Components Active
          </Badge>
          <Badge variant={systemHealth.overall === "excellent" ? "default" : "secondary"}>
            System: {systemHealth.overall.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* System Overview */}
      <DashboardSection
        title="System Overview"
        icon={<BarChart3 className="text-primary h-5 w-5" />}
        isExpanded={expandedSections.overview}
        onToggleExpand={() => toggleSection("overview")}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="from-primary/10 to-primary/5 border-primary/20 bg-gradient-to-br">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-primary text-2xl font-bold">
                    {effectivenessScore.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground text-sm">Overall Effectiveness</div>
                </div>
                <Zap className="text-primary/60 h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-700">{state.synergies.length}</div>
                  <div className="text-muted-foreground text-sm">Active Synergies</div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-700">
                    {realTimeMetrics.governmentCapacity.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground text-sm">Government Capacity</div>
                </div>
                <Activity className="h-8 w-8 text-blue-600/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-700">
                    {realTimeMetrics.crisisResiliency.toFixed(0)}%
                  </div>
                  <div className="text-muted-foreground text-sm">Crisis Resiliency</div>
                </div>
                <Shield className="h-8 w-8 text-purple-600/60" />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardSection>

      {/* Component Management */}
      {allowEdit && (
        <DashboardSection
          title="Atomic Components"
          icon={<Settings className="text-primary h-5 w-5" />}
          isExpanded={expandedSections.components}
          onToggleExpand={() => toggleSection("components")}
        >
          <AtomicComponentSelector
            initialComponents={selectedComponents}
            onChange={setSelectedComponents}
          />
        </DashboardSection>
      )}

      {/* Economic Analysis */}
      <DashboardSection
        title="Economic Impact Analysis"
        icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        isExpanded={expandedSections.economic}
        onToggleExpand={() => toggleSection("economic")}
      >
        <AtomicEconomicIndicators variant="dashboard" />
      </DashboardSection>

      {/* Intelligence Center */}
      <DashboardSection
        title="Intelligence & Analytics"
        icon={<Brain className="h-5 w-5 text-purple-600" />}
        isExpanded={expandedSections.intelligence}
        onToggleExpand={() => toggleSection("intelligence")}
      >
        <AtomicIntelligenceCenter variant="dashboard" />
      </DashboardSection>

      {/* Performance Analytics */}
      <DashboardSection
        title="Performance Analytics"
        icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
        isExpanded={expandedSections.analytics}
        onToggleExpand={() => toggleSection("analytics")}
      >
        <Card>
          <CardHeader>
            <CardTitle>Historical Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium">Effectiveness Trend</h4>
                <div className="text-primary text-2xl font-bold">
                  {state.performanceAnalytics.historicalEffectiveness.length > 0
                    ? state.performanceAnalytics.historicalEffectiveness[
                        state.performanceAnalytics.historicalEffectiveness.length - 1
                      ].score.toFixed(0)
                    : "0"}
                  %
                </div>
                <div className="text-muted-foreground text-sm">Current effectiveness score</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Component Performance</h4>
                <div className="text-2xl font-bold text-green-600">
                  {Object.keys(state.performanceAnalytics.componentPerformance).length}
                </div>
                <div className="text-muted-foreground text-sm">Components being tracked</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Benchmark Ranking</h4>
                <div className="text-2xl font-bold text-blue-600">
                  {state.performanceAnalytics.benchmarkComparison.percentile}th
                </div>
                <div className="text-muted-foreground text-sm">Percentile ranking</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DashboardSection>
    </div>
  );
}
