"use client";

import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import { motion } from "framer-motion";
import { api } from "~/trpc/react";
import Link from "next/link";
import { useUserCountry } from "~/hooks/useUserCountry";
import {
  Shield,
  AlertTriangle,
  Users,
  Target,
  Activity,
  Plus,
  Plane,
  Ship,
  Radio,
  MapPin,
  Globe2,
  AlertCircle,
  CheckCircle,
  Sword,
  HelpCircle,
  Info,
  Crown,
  Brain,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { ColoredProgress } from "~/components/ui/colored-progress";
import { Separator } from "~/components/ui/separator";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { MilitaryCustomizer } from "~/components/defense/MilitaryCustomizer";
import { StabilityPanel } from "~/components/defense/StabilityPanel";
import { CommandPanel } from "~/components/defense/CommandPanel";
import { MyCountryNavCards } from "~/components/mycountry/MyCountryNavCards";

export default function MyCountryDefenseDashboard() {
  const { user, userProfile, country } = useUserCountry();
  const [activeTab, setActiveTab] = useState("overview");
  const [navCardsCollapsed, setNavCardsCollapsed] = useState(false);

  // Get security assessment
  const { data: securityData, isLoading: securityLoading } =
    api.security.getSecurityAssessment.useQuery(
      { countryId: userProfile?.countryId ?? "" },
      { enabled: !!userProfile?.countryId }
    );

  // Get military branches
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId: userProfile?.countryId ?? "" },
    { enabled: !!userProfile?.countryId }
  );

  // Auto-collapse navigation cards on scroll
  React.useEffect(() => {
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

  if (!user || !userProfile || !country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <Shield className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">Authentication Required</h3>
            <p className="text-muted-foreground mb-4">Please sign in to access MyCountry Defense</p>
            <Link href={createUrl("/setup")}>
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case "very_secure":
        return "text-green-600 bg-green-50 border-green-200";
      case "secure":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "moderate":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high_risk":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "critical":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      {/* Header with MyCountry Branding */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 p-2">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{country.name}</h1>
              <p className="text-muted-foreground">Defense Command & Security Operations</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Navigation Cards */}
      <MyCountryNavCards currentPage="defense" collapsed={navCardsCollapsed} />

      {/* Security Status Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
                <Shield className="h-5 w-5" />
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
                          <li>
                            <strong>Very Secure (75-100):</strong> Exceptional security posture with
                            minimal threats
                          </li>
                          <li>
                            <strong>Secure (60-74):</strong> Strong security with manageable threats
                          </li>
                          <li>
                            <strong>Moderate (40-59):</strong> Adequate security but improvement
                            needed
                          </li>
                          <li>
                            <strong>High Risk (25-39):</strong> Significant vulnerabilities and
                            active threats
                          </li>
                          <li>
                            <strong>Critical (0-24):</strong> Severe security crisis requiring
                            immediate action
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 font-semibold">Component Scores</h4>
                        <ul className="text-muted-foreground list-inside list-disc space-y-1">
                          <li>
                            <strong>Military Strength:</strong> Combat capability, readiness, and
                            force size
                          </li>
                          <li>
                            <strong>Internal Stability:</strong> Civil order, crime rates, social
                            cohesion
                          </li>
                          <li>
                            <strong>Border Security:</strong> Border control effectiveness and
                            monitoring
                          </li>
                          <li>
                            <strong>Cybersecurity:</strong> Digital infrastructure protection and
                            capabilities
                          </li>
                          <li>
                            <strong>Counter-Terrorism:</strong> Anti-terrorism operations and
                            intelligence
                          </li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </span>
              <Badge variant="outline" className="px-4 py-1 text-lg">
                {securityData?.securityLevel.replace("_", " ").toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>Overall security posture and threat environment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Security Score */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Overall Security Score</span>
                <span className="text-2xl font-bold">
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
                className="h-3"
                showPulse={true}
              />
            </div>

            {/* Component Scores Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4" />
                  Military Strength
                </div>
                <ColoredProgress theme="defense" value={securityData?.militaryStrength ?? 0} className="h-2" />
                <div className="text-right text-xs">
                  <NumberFlowDisplay
                    value={securityData?.militaryStrength ?? 0}
                    decimalPlaces={0}
                  />
                  %
                </div>
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  Internal Stability
                </div>
                <ColoredProgress
                  theme="defense"
                  value={
                    typeof securityData?.internalStability === "number"
                      ? securityData.internalStability
                      : (securityData?.internalStability?.stabilityScore ?? 0)
                  }
                  className="h-2"
                />
                <div className="text-right text-xs">
                  <NumberFlowDisplay
                    value={
                      typeof securityData?.internalStability === "number"
                        ? securityData.internalStability
                        : (securityData?.internalStability?.stabilityScore ?? 0)
                    }
                    decimalPlaces={0}
                  />
                  %
                </div>
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  Border Security
                </div>
                <ColoredProgress
                  theme="defense"
                  value={
                    typeof securityData?.borderSecurity === "number"
                      ? securityData.borderSecurity
                      : (securityData?.borderSecurity?.overallSecurityLevel ?? 0)
                  }
                  className="h-2"
                />
                <div className="text-right text-xs">
                  <NumberFlowDisplay
                    value={
                      typeof securityData?.borderSecurity === "number"
                        ? securityData.borderSecurity
                        : (securityData?.borderSecurity?.overallSecurityLevel ?? 0)
                    }
                    decimalPlaces={0}
                  />
                  %
                </div>
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Radio className="h-4 w-4" />
                  Cybersecurity
                </div>
                <ColoredProgress theme="defense" value={securityData?.cybersecurity ?? 0} className="h-2" />
                <div className="text-right text-xs">
                  <NumberFlowDisplay value={securityData?.cybersecurity ?? 0} decimalPlaces={0} />%
                </div>
              </motion.div>

              <motion.div
                className="space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Counter-Terrorism
                </div>
                <ColoredProgress theme="defense" value={securityData?.counterTerrorism ?? 0} className="h-2" />
                <div className="text-right text-xs">
                  <NumberFlowDisplay
                    value={securityData?.counterTerrorism ?? 0}
                    decimalPlaces={0}
                  />
                  %
                </div>
              </motion.div>
            </div>

            {/* Threat Summary */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
              <motion.div
                className="bg-muted/30 rounded-lg p-4 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="text-muted-foreground text-2xl font-bold">
                  <NumberFlowDisplay value={securityData?.activeThreatCount ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">Active Threats</div>
              </motion.div>

              <motion.div
                className={cn(
                  "rounded-lg p-4 text-center",
                  (securityData?.highSeverityThreats ?? 0) > 0
                    ? "bg-red-50 dark:bg-red-950/30 animate-pulse"
                    : "bg-muted/30"
                )}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <div className={cn(
                  "text-2xl font-bold",
                  (securityData?.highSeverityThreats ?? 0) > 0 ? "text-red-600" : "text-muted-foreground"
                )}>
                  <NumberFlowDisplay value={securityData?.highSeverityThreats ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">High Severity</div>
              </motion.div>

              <motion.div
                className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
              >
                <div className="text-2xl font-bold text-blue-600">
                  <NumberFlowDisplay value={militaryBranches?.length ?? 0} />
                </div>
                <div className="text-muted-foreground text-xs">Military Branches</div>
              </motion.div>

              <motion.div
                className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
              >
                <div className="text-2xl font-bold text-emerald-600">
                  <NumberFlowDisplay
                    value={securityData?.militaryReadiness ?? 0}
                    decimalPlaces={0}
                  />
                  %
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="forces" className="flex items-center gap-2">
              <Sword className="h-4 w-4" />
              Forces
            </TabsTrigger>
            <TabsTrigger value="stability" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Stability
            </TabsTrigger>
            <TabsTrigger value="borders" className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Borders
            </TabsTrigger>
            <TabsTrigger value="threats" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Threats
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Merged with Command */}
          <TabsContent value="overview" className="space-y-6">
            {/* Security Events Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Recent Security Events
                  </CardTitle>
                  <CardDescription>Latest incidents and developments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <CheckCircle className="text-emerald-500 dark:text-emerald-400 mx-auto mb-4 h-12 w-12" />
                    <h3 className="font-semibold text-lg mb-2">All Clear</h3>
                    <p className="text-muted-foreground text-sm">
                      No recent security events detected. Your nation is secure.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Command Panel - Budget & Readiness */}
            {userProfile?.countryId && <CommandPanel countryId={userProfile.countryId} />}
          </TabsContent>

          {/* Forces Tab - Military Customizer */}
          <TabsContent value="forces" className="space-y-6">
            {userProfile?.countryId && <MilitaryCustomizer countryId={userProfile.countryId} />}
          </TabsContent>

          {/* Internal Stability Tab */}
          <TabsContent value="stability" className="space-y-6">
            {userProfile?.countryId && <StabilityPanel countryId={userProfile.countryId} />}
          </TabsContent>

          {/* Border Security Tab */}
          <TabsContent value="borders" className="space-y-6">
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-purple-600" />
                  Border Security Management
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <HelpCircle className="text-muted-foreground hover:text-primary h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-purple-600" />
                          Border Security Guide
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <div>
                          <h4 className="mb-2 font-semibold">Border Security Overview</h4>
                          <p className="text-muted-foreground">
                            Manage and monitor your nation's borders to prevent illegal crossings,
                            smuggling, and external threats. Border security is crucial for
                            maintaining sovereignty and controlling immigration.
                          </p>
                        </div>
                        <div>
                          <h4 className="mb-2 font-semibold">Key Components</h4>
                          <ul className="text-muted-foreground list-inside list-disc space-y-1">
                            <li>
                              <strong>Border Checkpoints:</strong> Official crossing points with
                              customs and immigration control
                            </li>
                            <li>
                              <strong>Surveillance Systems:</strong> Cameras, sensors, and
                              monitoring technology along borders
                            </li>
                            <li>
                              <strong>Border Patrol:</strong> Personnel deployed to monitor and
                              secure border regions
                            </li>
                            <li>
                              <strong>Physical Barriers:</strong> Fences, walls, and natural
                              obstacles that deter illegal crossings
                            </li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-2 font-semibold">Threat Assessment</h4>
                          <p className="text-muted-foreground">
                            Border security scores consider neighboring country relations, refugee
                            flows, smuggling activity, and terrorist infiltration risks. Higher
                            scores indicate more secure and well-monitored borders.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
                <CardDescription>
                  Monitor borders and assess threats from neighboring countries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground py-12 text-center">
                  <Globe2 className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
                  <h3 className="mb-2 text-lg font-semibold">Border Control Coming Soon</h3>
                  <p className="text-sm">
                    Assess threats from neighbors and manage border security infrastructure
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Threats Tab */}
          <TabsContent value="threats" className="space-y-6">
            <Card className="glass-hierarchy-child">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Threat Management
                </CardTitle>
                <CardDescription>
                  Track and assess security threats to your nation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground py-12 text-center">
                  <AlertTriangle className="text-muted-foreground/50 mx-auto mb-4 h-16 w-16" />
                  <h3 className="mb-2 text-lg font-semibold">Threat System Coming Soon</h3>
                  <p className="text-sm">
                    Track and respond to external and internal security threats
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </motion.div>
    </div>
  );
}
