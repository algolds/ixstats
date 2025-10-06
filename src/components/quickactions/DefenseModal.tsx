// src/components/quickactions/DefenseModal.tsx
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '~/trpc/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import {
  Shield,
  Target,
  Users,
  AlertTriangle,
  MapPin,
  Radio,
  Plane,
  Ship,
  ArrowRight,
  Sword,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { cn } from '~/lib/utils';

interface DefenseModalProps {
  countryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DefenseModal({ countryId, open, onOpenChange }: DefenseModalProps) {
  const router = useRouter();

  // Get security assessment
  const { data: securityData, isLoading: securityLoading } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId && open }
  );

  // Get military branches
  const { data: militaryBranches, isLoading: branchesLoading } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId && open }
  );

  // Get active threats
  const { data: threats, isLoading: threatsLoading } = api.security.getSecurityThreats.useQuery(
    { countryId, activeOnly: true },
    { enabled: !!countryId && open }
  );

  // Get internal stability
  const { data: stabilityData } = api.security.getInternalStability.useQuery(
    { countryId },
    { enabled: !!countryId && open }
  );

  const getSecurityLevelColor = (level: string) => {
    switch (level) {
      case 'very_secure': return 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30';
      case 'secure': return 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30';
      case 'moderate': return 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30';
      case 'high_risk': return 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30';
      case 'critical': return 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30';
      default: return 'border-border';
    }
  };

  const getThreatSeverityColor = (severity: string) => {
    switch (severity) {
      case 'existential': return 'bg-red-600 dark:bg-red-700';
      case 'critical': return 'bg-orange-600 dark:bg-orange-700';
      case 'high': return 'bg-yellow-600 dark:bg-yellow-700';
      case 'moderate': return 'bg-blue-600 dark:bg-blue-700';
      case 'low': return 'bg-gray-600 dark:bg-gray-700';
      default: return 'bg-muted';
    }
  };

  const handleViewFullDashboard = () => {
    onOpenChange(false);
    router.push('/mycountry/defense');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500 dark:text-red-400" />
            Defense & Security Command Center
          </DialogTitle>
          <DialogDescription>
            Monitor national security, military readiness, and active threats
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="military">Military Forces</TabsTrigger>
            <TabsTrigger value="stability">Stability</TabsTrigger>
            <TabsTrigger value="threats">Threats</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Security Status Card */}
            <div className={cn("p-4 rounded-lg border-2", securityData ? getSecurityLevelColor(securityData.securityLevel) : 'border-border')}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">National Security Status</h3>
                <Badge variant="outline" className="text-sm px-3">
                  {securityData?.securityLevel.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                </Badge>
              </div>

              {/* Overall Security Score */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Security Score</span>
                  <span className="text-xl font-bold">
                    <NumberFlowDisplay value={securityData?.overallSecurityScore ?? 0} decimalPlaces={0} />
                    <span className="text-sm text-muted-foreground">/100</span>
                  </span>
                </div>
                <Progress value={securityData?.overallSecurityScore ?? 0} className="h-2" />
              </div>

              {/* Component Scores */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="text-center p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                  <Target className="h-4 w-4 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                  <div className="text-sm font-bold">
                    <NumberFlowDisplay value={securityData?.militaryStrength ?? 0} decimalPlaces={0} />%
                  </div>
                  <div className="text-xs text-muted-foreground">Military</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                  <Users className="h-4 w-4 mx-auto mb-1 text-green-600 dark:text-green-400" />
                  <div className="text-sm font-bold">
                    <NumberFlowDisplay value={securityData?.internalStability?.stabilityScore ?? 0} decimalPlaces={0} />%
                  </div>
                  <div className="text-xs text-muted-foreground">Stability</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                  <MapPin className="h-4 w-4 mx-auto mb-1 text-purple-600 dark:text-purple-400" />
                  <div className="text-sm font-bold">
                    <NumberFlowDisplay value={securityData?.borderSecurity?.overallSecurityLevel ?? 0} decimalPlaces={0} />%
                  </div>
                  <div className="text-xs text-muted-foreground">Borders</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                  <Radio className="h-4 w-4 mx-auto mb-1 text-indigo-600 dark:text-indigo-400" />
                  <div className="text-sm font-bold">
                    <NumberFlowDisplay value={securityData?.cybersecurity ?? 0} decimalPlaces={0} />%
                  </div>  
                  <div className="text-xs text-muted-foreground">Cyber</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-orange-600 dark:text-orange-400" />
                  <div className="text-sm font-bold">
                    <NumberFlowDisplay value={securityData?.counterTerrorism ?? 0} decimalPlaces={0} />%
                  </div>
                  <div className="text-xs text-muted-foreground">Counter-Terror</div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-muted-foreground">
                    <NumberFlowDisplay value={securityData?.activeThreatCount ?? 0} decimalPlaces={0} />
                  </div>
                  <div className="text-xs text-muted-foreground">Active Threats</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600 dark:text-red-400">
                    <NumberFlowDisplay value={securityData?.highSeverityThreats ?? 0} decimalPlaces={0} />
                  </div>
                  <div className="text-xs text-muted-foreground">High Severity</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    <NumberFlowDisplay value={militaryBranches?.length ?? 0} decimalPlaces={0} />
                  </div>
                  <div className="text-xs text-muted-foreground">Branches</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    <NumberFlowDisplay value={securityData?.militaryReadiness ?? 0} decimalPlaces={0} />%
                  </div>
                  <div className="text-xs text-muted-foreground">Readiness</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Military Forces Tab */}
          <TabsContent value="military" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Sword className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-semibold">Military Forces Overview</h3>
              </div>

              {militaryBranches && militaryBranches.length > 0 ? (
                <div className="space-y-3">
                  {militaryBranches.map((branch) => (
                    <div key={branch.id} className="p-3 border rounded-lg bg-card hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {branch.branchType === 'navy' && <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                          {branch.branchType === 'air_force' && <Plane className="h-4 w-4 text-sky-600 dark:text-sky-400" />}
                          {branch.branchType === 'army' && <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />}
                          {!['navy', 'air_force', 'army'].includes(branch.branchType) && <Target className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                          <span className="font-medium">{branch.name}</span>
                        </div>
                        <Badge variant="outline">{branch.branchType.replace('_', ' ')}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm mb-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Active Duty</div>
                          <div className="font-medium">
                            <NumberFlowDisplay value={branch.activeDuty} decimalPlaces={0} />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Readiness</div>
                          <div className="font-medium">{branch.readinessLevel}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Budget</div>
                          <div className="font-medium">${(branch.annualBudget / 1000000).toFixed(0)}M</div>
                        </div>
                      </div>
                      <Progress value={branch.readinessLevel} className="h-1.5" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No military branches configured</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={handleViewFullDashboard}
                  >
                    Configure Military Forces
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Stability Tab */}
          <TabsContent value="stability" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h3 className="text-lg font-semibold">Internal Stability Metrics</h3>
              </div>

              {stabilityData?.metrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                      <div className="text-xs text-muted-foreground mb-1">Stability Score</div>
                      <div className="text-2xl font-bold">
                        <NumberFlowDisplay value={stabilityData.metrics.stabilityScore} decimalPlaces={0} />%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                      <div className="text-xs text-muted-foreground mb-1">Crime Rate</div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        <NumberFlowDisplay value={stabilityData.metrics.crimeRate} decimalPlaces={1} />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                      <div className="text-xs text-muted-foreground mb-1">Social Cohesion</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        <NumberFlowDisplay value={stabilityData.metrics.socialCohesion} decimalPlaces={0} />%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 dark:bg-muted/10">
                      <div className="text-xs text-muted-foreground mb-1">Public Order</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        <NumberFlowDisplay value={stabilityData.metrics.policingEffectiveness} decimalPlaces={0} />%
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Recent Stability Events</h4>
                    {stabilityData.activeEvents && stabilityData.activeEvents.length > 0 ? (
                      <div className="space-y-2">
                        {stabilityData.activeEvents.slice(0, 3).map((event) => (
                          <div key={event.id} className="p-2 border rounded-lg bg-card text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className="text-[10px]">
                                {event.eventType}
                              </Badge>
                              <span className="text-muted-foreground">Impact: {event.stabilityImpact}</span>
                            </div>
                            <p className="text-muted-foreground">{event.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 dark:bg-muted/10 rounded-lg">No recent stability events</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Loading stability data...</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Threats Tab */}
          <TabsContent value="threats" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <h3 className="text-lg font-semibold">Active Security Threats</h3>
              </div>

              {threats && threats.length > 0 ? (
                <div className="space-y-3">
                  {threats.map((threat) => (
                    <div key={threat.id} className="p-3 border rounded-lg bg-card hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={cn("text-white", getThreatSeverityColor(threat.severity))}>
                              {threat.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-sm">{threat.threatName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{threat.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Type: {threat.threatType.replace('_', ' ')}</span>
                        <span>•</span>
                        <span>Likelihood: {threat.likelihood}%</span>
                        <span>•</span>
                        <span>Status: {threat.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">No active threats detected</p>
                  <p className="text-xs text-muted-foreground">Security status: All clear</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <DialogFooter className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleViewFullDashboard} className="gap-2">
            View Full Defense Dashboard
            <ExternalLink className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
