"use client";

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { api } from '~/trpc/react';
import Link from 'next/link';
import {
  Shield,
  AlertTriangle,
  Users,
  Target,
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Plus,
  ArrowLeft,
  Plane,
  Ship,
  Radio,
  MapPin,
  Globe2,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Command,
  Sword,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { createUrl } from '~/lib/url-utils';
import { cn } from '~/lib/utils';
import { MilitaryCustomizer } from '~/components/defense/MilitaryCustomizer';
import { StabilityPanel } from '~/components/defense/StabilityPanel';
import { CommandPanel } from '~/components/defense/CommandPanel';

export default function MyCountryDefenseDashboard() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState('overview');

  // Get user profile and country
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { data: country } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId ?? '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get security assessment
  const { data: securityData, isLoading: securityLoading } = api.security.getSecurityAssessment.useQuery(
    { countryId: userProfile?.countryId ?? '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get military branches
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId: userProfile?.countryId ?? '' },
    { enabled: !!userProfile?.countryId }
  );

  // Get security threats
  const { data: threats } = api.security.getSecurityThreats.useQuery(
    { countryId: userProfile?.countryId ?? '', activeOnly: true },
    { enabled: !!userProfile?.countryId }
  );

  // Get border security
  const { data: borderSecurity } = api.security.getBorderSecurity.useQuery(
    { countryId: userProfile?.countryId ?? '' },
    { enabled: !!userProfile?.countryId }
  );

  if (!user || !userProfile || !country) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
            <p className="text-muted-foreground mb-4">
              Please sign in to access MyCountry Defense
            </p>
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
      case 'very_secure': return 'text-green-600 bg-green-50 border-green-200';
      case 'secure': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high_risk': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getThreatSeverityColor = (severity: string) => {
    switch (severity) {
      case 'existential': return 'bg-red-600';
      case 'critical': return 'bg-orange-600';
      case 'high': return 'bg-yellow-600';
      case 'moderate': return 'bg-blue-600';
      case 'low': return 'bg-gray-600';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link href={createUrl("/dashboard")}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-red-600" />
              MyCountry Defense
            </h1>
            <p className="text-muted-foreground">{country.name} • National Defense Command</p>
          </div>
        </div>
      </motion.div>

      {/* Security Status Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className={cn("glass-hierarchy-parent border-2", securityData ? getSecurityLevelColor(securityData.securityLevel) : '')}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                National Security Status
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
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
                        <h4 className="font-semibold mb-2">Overall Security Score</h4>
                        <p className="text-muted-foreground">
                          Composite metric combining military strength, internal stability, border security, cybersecurity, and counter-terrorism capabilities. Scores above 75 indicate very secure status.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Security Level Classifications</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li><strong>Very Secure (75-100):</strong> Exceptional security posture with minimal threats</li>
                          <li><strong>Secure (60-74):</strong> Strong security with manageable threats</li>
                          <li><strong>Moderate (40-59):</strong> Adequate security but improvement needed</li>
                          <li><strong>High Risk (25-39):</strong> Significant vulnerabilities and active threats</li>
                          <li><strong>Critical (0-24):</strong> Severe security crisis requiring immediate action</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Component Scores</h4>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li><strong>Military Strength:</strong> Combat capability, readiness, and force size</li>
                          <li><strong>Internal Stability:</strong> Civil order, crime rates, social cohesion</li>
                          <li><strong>Border Security:</strong> Border control effectiveness and monitoring</li>
                          <li><strong>Cybersecurity:</strong> Digital infrastructure protection and capabilities</li>
                          <li><strong>Counter-Terrorism:</strong> Anti-terrorism operations and intelligence</li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </span>
              <Badge variant="outline" className="text-lg px-4 py-1">
                {securityData?.securityLevel.replace('_', ' ').toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>
              Overall security posture and threat environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Security Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Security Score</span>
                <span className="text-2xl font-bold">
                  <NumberFlowDisplay value={securityData?.overallSecurityScore ?? 0} decimalPlaces={1} />
                  <span className="text-sm text-muted-foreground">/100</span>
                </span>
              </div>
              <Progress value={securityData?.overallSecurityScore ?? 0} className="h-3" />
            </div>

            {/* Component Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Military Strength
                </div>
                <Progress value={securityData?.militaryStrength ?? 0} className="h-2" />
                <div className="text-xs text-right">
                  <NumberFlowDisplay value={securityData?.militaryStrength ?? 0} decimalPlaces={0} />%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Internal Stability
                </div>
                <Progress value={typeof securityData?.internalStability === 'number' ? securityData.internalStability : securityData?.internalStability?.stabilityScore ?? 0} className="h-2" />
                <div className="text-xs text-right">
                  <NumberFlowDisplay value={typeof securityData?.internalStability === 'number' ? securityData.internalStability : securityData?.internalStability?.stabilityScore ?? 0} decimalPlaces={0} />%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Border Security
                </div>
                <Progress value={typeof securityData?.borderSecurity === 'number' ? securityData.borderSecurity : securityData?.borderSecurity?.overallSecurityLevel ?? 0} className="h-2" />
                <div className="text-xs text-right">
                  <NumberFlowDisplay value={typeof securityData?.borderSecurity === 'number' ? securityData.borderSecurity : securityData?.borderSecurity?.overallSecurityLevel ?? 0} decimalPlaces={0} />%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Radio className="h-4 w-4" />
                  Cybersecurity
                </div>
                <Progress value={securityData?.cybersecurity ?? 0} className="h-2" />
                <div className="text-xs text-right">
                  <NumberFlowDisplay value={securityData?.cybersecurity ?? 0} decimalPlaces={0} />%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  Counter-Terrorism
                </div>
                <Progress value={securityData?.counterTerrorism ?? 0} className="h-2" />
                <div className="text-xs text-right">
                  <NumberFlowDisplay value={securityData?.counterTerrorism ?? 0} decimalPlaces={0} />%
                </div>
              </div>
            </div>

            {/* Threat Summary */}
            <div className="flex items-center justify-around border-t pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  <NumberFlowDisplay value={securityData?.activeThreatCount ?? 0} />
                </div>
                <div className="text-xs text-muted-foreground">Active Threats</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  <NumberFlowDisplay value={securityData?.highSeverityThreats ?? 0} />
                </div>
                <div className="text-xs text-muted-foreground">High Severity</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  <NumberFlowDisplay value={militaryBranches?.length ?? 0} />
                </div>
                <div className="text-xs text-muted-foreground">Military Branches</div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  <NumberFlowDisplay value={securityData?.militaryReadiness ?? 0} decimalPlaces={0} />%
                </div>
                <div className="text-xs text-muted-foreground">Readiness Level</div>
              </div>
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="forces" className="flex items-center gap-2">
              <Sword className="h-4 w-4" />
              Forces
            </TabsTrigger>
            <TabsTrigger value="borders" className="flex items-center gap-2">
              <Globe2 className="h-4 w-4" />
              Borders
            </TabsTrigger>
            <TabsTrigger value="stability" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Stability
            </TabsTrigger>
            <TabsTrigger value="threats" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Threats
            </TabsTrigger>
            <TabsTrigger value="command" className="flex items-center gap-2">
              <Command className="h-4 w-4" />
              Command
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Security Events */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Recent Security Events
                  </CardTitle>
                  <CardDescription>Latest incidents and developments</CardDescription>
                </CardHeader>
                <CardContent>
                  {securityData?.internalStability?.stabilityScore && (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <AlertCircle className="h-4 w-4 text-yellow-600 mt-1" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">Security Event #{i + 1}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Monitoring ongoing situation
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!securityData?.internalStability && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No recent security events
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Military Readiness Summary */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Military Readiness
                  </CardTitle>
                  <CardDescription>Armed forces status and capabilities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {militaryBranches?.slice(0, 3).map((branch) => (
                      <div key={branch.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {branch.branchType === 'navy' && <Ship className="h-4 w-4 text-blue-600" />}
                            {branch.branchType === 'air_force' && <Plane className="h-4 w-4 text-sky-600" />}
                            {branch.branchType === 'army' && <Users className="h-4 w-4 text-green-600" />}
                            <span className="text-sm font-medium">{branch.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            <NumberFlowDisplay value={branch.readinessLevel} decimalPlaces={0} />%
                          </span>
                        </div>
                        <Progress value={branch.readinessLevel} className="h-2" />
                      </div>
                    ))}
                    {(!militaryBranches || militaryBranches.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No military branches configured
                        <div className="mt-4">
                          <Button size="sm" onClick={() => setActiveTab('military')}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Military Branch
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Forces Tab - Military Customizer */}
          <TabsContent value="forces" className="space-y-6">
            {userProfile?.countryId && (
              <MilitaryCustomizer countryId={userProfile.countryId} />
            )}
          </TabsContent>

          {/* Internal Stability Tab */}
          <TabsContent value="stability" className="space-y-6">
            {userProfile?.countryId && (
              <StabilityPanel countryId={userProfile.countryId} />
            )}
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
                        <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
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
                          <h4 className="font-semibold mb-2">Border Security Overview</h4>
                          <p className="text-muted-foreground">
                            Manage and monitor your nation's borders to prevent illegal crossings, smuggling, and external threats. Border security is crucial for maintaining sovereignty and controlling immigration.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Key Components</h4>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li><strong>Border Checkpoints:</strong> Official crossing points with customs and immigration control</li>
                            <li><strong>Surveillance Systems:</strong> Cameras, sensors, and monitoring technology along borders</li>
                            <li><strong>Border Patrol:</strong> Personnel deployed to monitor and secure border regions</li>
                            <li><strong>Physical Barriers:</strong> Fences, walls, and natural obstacles that deter illegal crossings</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Threat Assessment</h4>
                          <p className="text-muted-foreground">
                            Border security scores consider neighboring country relations, refugee flows, smuggling activity, and terrorist infiltration risks. Higher scores indicate more secure and well-monitored borders.
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
                <div className="text-center py-12 text-muted-foreground">
                  <Globe2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">Border Control Coming Soon</h3>
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
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Active Security Threats
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-red-600" />
                            Security Threats Guide
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 text-sm">
                          <div>
                            <h4 className="font-semibold mb-2">Threat Management</h4>
                            <p className="text-muted-foreground">
                              Track and assess security threats to your nation. Threats can be external (foreign military, terrorism) or internal (insurgency, organized crime, civil unrest).
                            </p>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Severity Levels</h4>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li><strong>Existential:</strong> Threatens national survival (invasion, nuclear attack)</li>
                              <li><strong>Critical:</strong> Major threat requiring immediate military response</li>
                              <li><strong>High:</strong> Significant threat that could cause major disruption</li>
                              <li><strong>Moderate:</strong> Manageable threat requiring monitoring and response</li>
                              <li><strong>Low:</strong> Minor threat with limited potential impact</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Threat Types</h4>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              <li><strong>Military:</strong> Foreign military forces or aggression</li>
                              <li><strong>Terrorism:</strong> Non-state actors using violence for political goals</li>
                              <li><strong>Insurgency:</strong> Armed rebellion against the government</li>
                              <li><strong>Cyber:</strong> Digital attacks on infrastructure and networks</li>
                              <li><strong>Organized Crime:</strong> Criminal networks undermining security</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Likelihood Assessment</h4>
                            <p className="text-muted-foreground">
                              Percentage chance the threat will materialize based on intelligence, historical patterns, and current conditions. Higher likelihood threats require more resources for prevention and response.
                            </p>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </span>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Threat
                  </Button>
                </CardTitle>
                <CardDescription>
                  Track and manage security threats to your nation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {threats && threats.length > 0 ? (
                  <div className="space-y-3">
                    {threats.map((threat) => (
                      <div key={threat.id} className="p-4 rounded-lg border bg-card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getThreatSeverityColor(threat.severity)}>
                                {threat.severity.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{threat.threatName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{threat.description}</p>
                            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                              <span>Type: {threat.threatType.replace('_', ' ')}</span>
                              <span>•</span>
                              <span>Likelihood: {threat.likelihood}%</span>
                              <span>•</span>
                              <span>Status: {threat.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold mb-2">No Active Threats</h3>
                    <p className="text-sm mb-4">
                      Create and track security threats to your nation
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Command Tab - Budget & Readiness Management */}
          <TabsContent value="command" className="space-y-6">
            {userProfile?.countryId && (
              <CommandPanel countryId={userProfile.countryId} />
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
