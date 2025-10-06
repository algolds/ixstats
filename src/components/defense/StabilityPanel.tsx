// src/components/defense/StabilityPanel.tsx
"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '~/trpc/react';
import {
  Users,
  AlertTriangle,
  Shield,
  TrendingUp,
  TrendingDown,
  Activity,
  Minus,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Scale,
  Heart,
  Eye,
  HelpCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { NumberFlowDisplay } from '~/components/ui/number-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '~/lib/utils';

interface StabilityPanelProps {
  countryId: string;
}

export function StabilityPanel({ countryId }: StabilityPanelProps) {
  // Fetch stability metrics
  const { data: stabilityData, refetch: refetchStability } = api.security.getInternalStability.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Generate stability event mutation
  const generateEvent = api.security.generateStabilityEvent.useMutation({
    onSuccess: () => {
      toast.success('Security event generated');
      refetchStability();
    },
    onError: (error) => {
      toast.error(`Failed to generate event: ${error.message}`);
    },
  });

  // Resolve event mutation
  const resolveEvent = api.security.resolveSecurityEvent.useMutation({
    onSuccess: () => {
      toast.success('Event resolved');
      refetchStability();
    },
    onError: (error) => {
      toast.error(`Failed to resolve event: ${error.message}`);
    },
  });

  const metrics = stabilityData?.metrics;
  const activeEvents = stabilityData?.activeEvents ?? [];

  const getStabilityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStabilityBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-blue-50 border-blue-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    if (score >= 20) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining' || trend === 'critical') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'moderate': return 'bg-yellow-600';
      case 'low': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Stability */}
      <Card className={cn('glass-hierarchy-child border-2', metrics ? getStabilityBg(metrics.stabilityScore) : '')}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Internal Stability
                {/* Help Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-blue-600" />
                        Understanding Internal Stability Metrics
                      </DialogTitle>
                      <DialogDescription>
                        How stability metrics are calculated and what they mean for your country
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 text-sm">
                      {/* Overall Score */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Overall Stability Score (0-100)
                        </h4>
                        <p className="text-muted-foreground">
                          A composite metric combining social cohesion (25%), trust in government (20%), low crime rates (20%),
                          low ethnic tension (15%), low riot risk (10%), and effective policing (10%). Higher scores indicate
                          greater internal stability.
                        </p>
                        <div className="pl-4 space-y-1 text-xs">
                          <p>• <strong>80-100:</strong> Highly stable, minimal security concerns</p>
                          <p>• <strong>60-79:</strong> Stable with manageable challenges</p>
                          <p>• <strong>40-59:</strong> Moderate instability, active management needed</p>
                          <p>• <strong>20-39:</strong> Unstable, significant security risks</p>
                          <p>• <strong>0-19:</strong> Critical instability, immediate intervention required</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Crime Metrics */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Crime & Law Enforcement
                        </h4>
                        <div className="space-y-3 pl-4">
                          <div>
                            <p className="font-medium">Crime Rate (per 100k population)</p>
                            <p className="text-muted-foreground">
                              Calculated from unemployment (×0.8), income inequality (×0.15), poverty (×0.6), and youth
                              unemployment (×0.4). Higher urbanization and lower policing budgets increase crime rates.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Organized Crime Level (0-100%)</p>
                            <p className="text-muted-foreground">
                              Based on corruption (×0.4), political instability (×8), weak institutions (×0.3), and
                              economic desperation (×0.2). High corruption enables organized crime to flourish.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Policing Effectiveness (0-100%)</p>
                            <p className="text-muted-foreground">
                              Determined by policing budget per capita (up to 50%) minus corruption penalties (×0.3).
                              Higher budgets and lower corruption improve effectiveness.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Public Order */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Public Order
                        </h4>
                        <div className="space-y-3 pl-4">
                          <div>
                            <p className="font-medium">Protest Frequency (events/year)</p>
                            <p className="text-muted-foreground">
                              Driven by political polarization (×0.15), unemployment (×0.5), inequality (×8), recent
                              unpopular policies (×0.1), and democracy level (×10). More democratic societies allow more protests.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Riot Risk (0-100%)</p>
                            <p className="text-muted-foreground">
                              Calculated from polarization (×0.3), economic desperation (×0.3), existing crime (×0.2),
                              weak policing (×20), and frequent protests (×0.5). Multiple risk factors compound dangerously.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Social Metrics */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Heart className="h-4 w-4" />
                          Social Cohesion
                        </h4>
                        <div className="space-y-3 pl-4">
                          <div>
                            <p className="font-medium">Social Cohesion (0-100%)</p>
                            <p className="text-muted-foreground">
                              Economic growth (+3 per %), political stability (+20%), minus penalties for inequality (×30%)
                              and polarization (×0.3). Strong economies and stable politics build cohesion.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Ethnic Tension (0-100%)</p>
                            <p className="text-muted-foreground">
                              Diversity alone doesn't cause tension (×0.15), but economic scarcity (×0.3), inequality (×0.2),
                              and political polarization (×0.2) can inflame it. Address root economic causes.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Trust Metrics */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Eye className="h-4 w-4" />
                          Public Confidence
                        </h4>
                        <div className="space-y-3 pl-4">
                          <div>
                            <p className="font-medium">Trust in Government (0-100%)</p>
                            <p className="text-muted-foreground">
                              Democracy (+30%), economic growth (+4 per %), political stability (+20%), minus corruption (×0.4)
                              and polarization (×0.15). Corruption is the biggest destroyer of trust.
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Trust in Police (0-100%)</p>
                            <p className="text-muted-foreground">
                              Effective policing (+0.5 per %), minus corruption (×0.35) and high crime (×0.2).
                              Corruption in law enforcement is particularly damaging.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Event Generation */}
                      <div className="space-y-2">
                        <h4 className="font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Security Event Generation
                        </h4>
                        <p className="text-muted-foreground">
                          Events are generated based on your country's actual metrics. High riot risk = more riots.
                          High crime + organized crime = crime waves. High ethnic tension = communal violence.
                          High polarization + protests = civil unrest. The system uses weighted probabilities, not random chance.
                        </p>
                        <div className="pl-4 space-y-1 text-xs mt-2">
                          <p>• <strong>Critical Events:</strong> 30-80 casualties, major economic impact</p>
                          <p>• <strong>High Severity:</strong> 5-40 casualties, significant disruption</p>
                          <p>• <strong>Moderate:</strong> 0-15 casualties, localized impact</p>
                          <p>• <strong>Low Severity:</strong> Minimal casualties, routine incidents</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Improvement Tips */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-green-600">💡 How to Improve Stability</h4>
                        <div className="pl-4 space-y-2 text-xs">
                          <p>✓ <strong>Reduce unemployment</strong> - Biggest factor in crime and unrest</p>
                          <p>✓ <strong>Address inequality</strong> - Lower Gini index reduces tension</p>
                          <p>✓ <strong>Fight corruption</strong> - Improves trust, policing, and institutions</p>
                          <p>✓ <strong>Increase policing budget</strong> - Higher per-capita spending improves effectiveness</p>
                          <p>✓ <strong>Promote economic growth</strong> - Builds cohesion and reduces desperation</p>
                          <p>✓ <strong>Avoid polarizing policies</strong> - Popular, consensus policies prevent protests</p>
                          <p>✓ <strong>Strengthen democratic institutions</strong> - Improves trust and stability</p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Social cohesion, crime rates, and domestic security metrics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {metrics && getTrendIcon(metrics.stabilityTrend)}
              <Button size="sm" onClick={() => generateEvent.mutate({ countryId })}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate Event
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stability Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Stability Score</span>
              <span className={cn('text-2xl font-bold', metrics ? getStabilityColor(metrics.stabilityScore) : '')}>
                <NumberFlowDisplay value={metrics?.stabilityScore ?? 75} format="decimal" decimalPlaces={1} />
                <span className="text-sm text-muted-foreground">/100</span>
              </span>
            </div>
            <Progress value={metrics?.stabilityScore ?? 75} className="h-3" />
          </div>

          <Separator />

          {/* Crime & Law Enforcement */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Crime & Law Enforcement
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Overall Crime Rate</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.crimeRate ?? 5} format="decimal" decimalPlaces={1} /> per 100k
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Violent Crime</span>
                  <span><NumberFlowDisplay value={metrics?.violentCrimeRate ?? 2} /></span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Property Crime</span>
                  <span><NumberFlowDisplay value={metrics?.propertyCrimeRate ?? 10} /></span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Organized Crime</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.organizedCrimeLevel ?? 3} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.organizedCrimeLevel ?? 3} className="h-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Policing Effectiveness</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.policingEffectiveness ?? 60} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.policingEffectiveness ?? 60} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Justice System Efficiency</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.justiceSystemEfficiency ?? 50} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.justiceSystemEfficiency ?? 50} className="h-2" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Public Order */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Public Order
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Protest Frequency</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.protestFrequency ?? 5} /> /year
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Riot Risk</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.riotRisk ?? 10} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.riotRisk ?? 10} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Civil Disobedience</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.civilDisobedience ?? 5} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.civilDisobedience ?? 5} className="h-2" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Social Cohesion */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Social Cohesion
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Social Cohesion</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.socialCohesion ?? 70} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.socialCohesion ?? 70} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ethnic Tension</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.ethnicTension ?? 20} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.ethnicTension ?? 20} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Political Polarization</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.politicalPolarization ?? 40} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.politicalPolarization ?? 40} className="h-2" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Public Confidence */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Public Confidence
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trust in Government</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.trustInGovernment ?? 50} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.trustInGovernment ?? 50} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trust in Police</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.trustInPolice ?? 55} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.trustInPolice ?? 55} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fear of Crime</span>
                  <span className="font-medium">
                    <NumberFlowDisplay value={metrics?.fearOfCrime ?? 35} format="decimal" decimalPlaces={0} />%
                  </span>
                </div>
                <Progress value={metrics?.fearOfCrime ?? 35} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Security Events */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Active Security Events ({activeEvents.length})
          </CardTitle>
          <CardDescription>
            Current internal security incidents and developments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeEvents.length > 0 ? (
            <div className="space-y-3">
              {activeEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity.toUpperCase()}
                        </Badge>
                        <h5 className="font-medium text-sm">{event.title}</h5>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{event.description}</p>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        {event.casualties > 0 && (
                          <div>
                            <span className="text-muted-foreground">Casualties:</span>
                            <span className="ml-1 font-medium">
                              <NumberFlowDisplay value={event.casualties} />
                            </span>
                          </div>
                        )}
                        {event.arrested > 0 && (
                          <div>
                            <span className="text-muted-foreground">Arrested:</span>
                            <span className="ml-1 font-medium">
                              <NumberFlowDisplay value={event.arrested} />
                            </span>
                          </div>
                        )}
                        {event.economicImpact > 0 && (
                          <div>
                            <span className="text-muted-foreground">Economic Impact:</span>
                            <span className="ml-1 font-medium">
                              $<NumberFlowDisplay value={event.economicImpact} format="compact" />
                            </span>
                          </div>
                        )}
                      </div>

                      {event.region && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Location: {event.region}{event.city ? `, ${event.city}` : ''}
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveEvent.mutate({ id: event.id, resolutionNotes: 'Manually resolved' })}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolve
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
              <h4 className="font-medium mb-1">All Clear</h4>
              <p className="text-sm">No active security events at this time</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
