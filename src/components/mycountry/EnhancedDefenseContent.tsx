"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import {
  Shield,
  AlertTriangle,
  Users,
  Target,
  Activity,
  Radio,
  MapPin,
  Globe2,
  AlertCircle,
  CheckCircle,
  Sword,
  HelpCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { ColoredProgress } from "~/components/ui/colored-progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { MilitaryCustomizer } from "~/components/defense/MilitaryCustomizer";
import { StabilityPanel } from "~/components/defense/StabilityPanel";
import { OperationsPanel } from "~/components/defense/OperationsPanel";
import { CommandPanel } from "~/components/defense/CommandPanel";
import { MetricCardGrid, staggerContainer, staggerItem } from "./primitives";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { DefenseSidebarWidget } from "./sidebar-widgets";

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedDefenseContentProps {
  user: any;
  userProfile: {
    countryId: string;
  };
  country: {
    id: string;
    name: string;
    flag?: string | null;
    flagUrl?: string | null;
  };
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
}

export function EnhancedDefenseContent({
  user,
  userProfile,
  country,
  activeSection,
  onNavigate,
}: EnhancedDefenseContentProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Get security assessment
  const { data: securityData } =
    api.security.getSecurityAssessment.useQuery(
      { countryId: userProfile.countryId },
      { enabled: !!userProfile.countryId }
    );

  // Get military branches
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId: userProfile.countryId },
    { enabled: !!userProfile.countryId }
  );

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case "very_secure":
        return "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
      case "secure":
        return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800";
      case "moderate":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800";
      case "high_risk":
        return "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800";
      case "critical":
        return "text-red-600 bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800";
    }
  };

  const getSecurityStatusLabel = (level: string) => {
    return level.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getInternalStabilityScore = () => {
    if (typeof securityData?.internalStability === "number") {
      return securityData.internalStability;
    }
    return securityData?.internalStability?.stabilityScore ?? 0;
  };

  const getBorderSecurityScore = () => {
    if (typeof securityData?.borderSecurity === "number") {
      return securityData.borderSecurity;
    }
    return securityData?.borderSecurity?.overallSecurityLevel ?? 0;
  };

  const header = (
    <div id="overview" className="glass-hierarchy-parent rounded-xl border border-red-500/20 p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50">
          MyCountry®
        </Badge>
        <span className="text-muted-foreground text-sm">→</span>
        <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <Shield className="mr-1 h-3 w-3" />
          Defense & Security
        </Badge>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-2 flex-shrink-0">
          <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{country.name}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Defense & National Security Operations</p>
        </div>
      </div>
    </div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={header}
      activeSection={activeSection}
      onNavigate={onNavigate}
    >
      {/* Inline status strip */}
      <DefenseSidebarWidget countryId={userProfile.countryId} />

      {/* Security Status Overview Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-3"
      >
        <Card
          className={cn(
            "glass-hierarchy-parent border-2 transition-all duration-500",
            securityData ? getSecurityLevelColor(securityData.securityLevel) : ""
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                National Security Status
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-blue-600" />
                        National Security Status Guide
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div>
                        <h4 className="mb-2 font-semibold">Overall Security Score</h4>
                        <p className="text-muted-foreground">
                          Composite metric combining military strength, internal stability, border
                          security, cybersecurity, and counter-terrorism capabilities. Scores above
                          75 indicate very secure status.
                        </p>
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold">Security Level Classifications</h4>
                        <ul className="text-muted-foreground list-inside list-disc space-y-1">
                          <li><strong>Very Secure (75-100):</strong> Exceptional security posture with minimal threats</li>
                          <li><strong>Secure (60-74):</strong> Strong security with manageable threats</li>
                          <li><strong>Moderate (40-59):</strong> Adequate security but improvement needed</li>
                          <li><strong>High Risk (25-39):</strong> Significant vulnerabilities and active threats</li>
                          <li><strong>Critical (0-24):</strong> Severe security crisis requiring immediate action</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </span>
              <Badge variant="outline" className="px-4 py-1 text-lg">
                {securityData ? getSecurityStatusLabel(securityData.securityLevel) : "Loading..."}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Overall Security Score */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Overall Security Score</span>
                <span className="text-lg font-bold">
                  <NumberFlowDisplay
                    value={securityData?.overallSecurityScore ?? 0}
                    decimalPlaces={1}
                  />
                  <span className="text-muted-foreground text-sm">/100</span>
                </span>
              </div>
              <ColoredProgress
                theme="defense"
                value={securityData?.overallSecurityScore ?? 0}
                className="h-2"
                showPulse={true}
              />
            </div>

            {/* Security Metrics Grid */}
            <MetricCardGrid
              theme="labor"
              columns={4}
              animate={false}
              metrics={[
                {
                  id: "military-strength",
                  title: "Military Strength",
                  value: `${securityData?.militaryStrength ?? 0}%`,
                  icon: Target,
                  status: (securityData?.militaryStrength ?? 0) > 60 ? "success" : (securityData?.militaryStrength ?? 0) > 40 ? "warning" : "error",
                },
                {
                  id: "internal-stability",
                  title: "Internal Stability",
                  value: `${getInternalStabilityScore()}%`,
                  icon: Users,
                  status: getInternalStabilityScore() > 60 ? "success" : getInternalStabilityScore() > 40 ? "warning" : "error",
                },
                {
                  id: "border-security",
                  title: "Border Security",
                  value: `${getBorderSecurityScore()}%`,
                  icon: MapPin,
                  status: getBorderSecurityScore() > 60 ? "success" : getBorderSecurityScore() > 40 ? "warning" : "error",
                },
                {
                  id: "cybersecurity",
                  title: "Cybersecurity",
                  value: `${securityData?.cybersecurity ?? 0}%`,
                  icon: Radio,
                  status: (securityData?.cybersecurity ?? 0) > 60 ? "success" : (securityData?.cybersecurity ?? 0) > 40 ? "warning" : "error",
                },
              ]}
            />

            {/* Threat Summary */}
            <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4 sm:gap-3">
              <motion.div
                className="bg-muted/30 rounded-lg p-2.5 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-lg font-bold">
                  <NumberFlowDisplay value={securityData?.activeThreatCount ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">Active Threats</div>
              </motion.div>

              <motion.div
                className={cn(
                  "rounded-lg p-2.5 text-center",
                  (securityData?.highSeverityThreats ?? 0) > 0
                    ? "bg-red-50 dark:bg-red-950/30 animate-pulse"
                    : "bg-muted/30"
                )}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className={cn(
                  "text-lg font-bold",
                  (securityData?.highSeverityThreats ?? 0) > 0 ? "text-red-600" : ""
                )}>
                  <NumberFlowDisplay value={securityData?.highSeverityThreats ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">High Severity</div>
              </motion.div>

              <motion.div
                className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-lg font-bold text-blue-600">
                  <NumberFlowDisplay value={militaryBranches?.length ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">Military Branches</div>
              </motion.div>

              <motion.div
                className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2.5 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-lg font-bold text-emerald-600">
                  <NumberFlowDisplay value={securityData?.militaryReadiness ?? 0} decimalPlaces={0} />%
                </div>
                <div className="text-muted-foreground text-xs">Readiness Level</div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-5 min-w-fit">
              <TabsTrigger value="overview" className="flex items-center gap-1 text-xs lg:text-sm">
                <Activity className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Overview</span>
                <span className="sm:hidden">Over</span>
              </TabsTrigger>
              <TabsTrigger value="forces" className="flex items-center gap-1 text-xs lg:text-sm">
                <Sword className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Forces</span>
                <span className="sm:hidden">Force</span>
              </TabsTrigger>
              <TabsTrigger value="stability" className="flex items-center gap-1 text-xs lg:text-sm">
                <Users className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Stability</span>
                <span className="sm:hidden">Stab</span>
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-1 text-xs lg:text-sm">
                <Target className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Operations</span>
                <span className="sm:hidden">Ops</span>
              </TabsTrigger>
              <TabsTrigger value="threats" className="flex items-center gap-1 text-xs lg:text-sm">
                <AlertTriangle className="h-3 w-3 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Threats</span>
                <span className="sm:hidden">Thr</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <ThemedTabContent theme="defense">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-4"
              >
                <motion.div variants={staggerItem}>
                  <Card className="glass-hierarchy-child">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        Recent Security Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6">
                        <CheckCircle className="text-emerald-500 dark:text-emerald-400 mx-auto mb-3 h-8 w-8" />
                        <h3 className="font-semibold text-sm mb-1">All Clear</h3>
                        <p className="text-muted-foreground text-sm">
                          No recent security events detected. Your nation is secure.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={staggerItem}>
                  <CommandPanel countryId={userProfile.countryId} />
                </motion.div>
              </motion.div>
            </ThemedTabContent>
          </TabsContent>

          {/* Forces Tab */}
          <TabsContent value="forces" className="space-y-4">
            <ThemedTabContent theme="defense">
              <MilitaryCustomizer countryId={userProfile.countryId} />
            </ThemedTabContent>
          </TabsContent>

          {/* Stability Tab */}
          <TabsContent value="stability" className="space-y-4">
            <ThemedTabContent theme="defense">
              <StabilityPanel countryId={userProfile.countryId} />
            </ThemedTabContent>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-4">
            <ThemedTabContent theme="defense">
              <OperationsPanel countryId={userProfile.countryId} />
            </ThemedTabContent>
          </TabsContent>

          {/* Threats Tab */}
          <TabsContent value="threats" className="space-y-4">
            <ThemedTabContent theme="defense">
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Threat Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground py-8 text-center">
                    <AlertTriangle className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                    <h3 className="mb-1 text-sm font-semibold">Threat Management Coming Soon</h3>
                    <p className="mx-auto max-w-md text-xs">
                      Track and respond to external and internal security threats.
                      This system will provide real-time threat assessment, intelligence alerts, and coordinated response capabilities.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </ThemedTabContent>
          </TabsContent>
        </Tabs>
      </motion.div>
    </MyCountrySidebarLayout>
  );
}

export default EnhancedDefenseContent;
