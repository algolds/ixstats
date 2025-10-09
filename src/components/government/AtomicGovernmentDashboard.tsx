"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { api } from '~/trpc/react';
import {
  AtomicMetric,
  AtomicProgress,
  AtomicGauge,
  AtomicStatus,
  AtomicEffectiveness,
  AtomicComponentCard,
  AtomicSynergy
} from './atoms/AtomicUIComponents';
import { ComponentType, ATOMIC_COMPONENTS, type AtomicGovernmentComponent } from './atoms/AtomicGovernmentComponents';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import {
  Crown,
  Users,
  Scale,
  Building2,
  Zap,
  Target,
  Shield,
  TrendingUp,
  Activity,
  Settings,
  ChevronRight,
  Plus,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

interface AtomicGovernmentDashboardProps {
  countryId: string;
  className?: string;
}

export const AtomicGovernmentDashboard: React.FC<AtomicGovernmentDashboardProps> = ({
  countryId,
  className
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedComponents, setSelectedComponents] = useState<Set<ComponentType>>(new Set());
  const [showComponentSelector, setShowComponentSelector] = useState(false);

  // Fetch government data
  const { data: governmentData, isLoading } = api.atomicGovernment.getGovernmentStructure.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: countryData } = api.countries.getById.useQuery(
    { id: countryId },
    { enabled: !!countryId }
  );

  // Calculate government effectiveness based on selected components
  const calculateEffectiveness = useMemo(() => {
    let baseEffectiveness = 50;
    let synergyBonus = 0;
    let conflictPenalty = 0;

    const components = Array.from(selectedComponents).map(type => ATOMIC_COMPONENTS[type]).filter(Boolean) as AtomicGovernmentComponent[];

    // Calculate base effectiveness
    components.forEach(component => {
      baseEffectiveness += component.effectiveness * 0.2;
    });

    // Calculate synergies
    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1.id !== comp2.id && comp1.synergies?.includes(comp2.type)) {
          synergyBonus += 5;
        }
        if (comp1.id !== comp2.id && comp1.conflicts?.includes(comp2.type)) {
          conflictPenalty += 8;
        }
      });
    });

    const totalEffectiveness = Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));

    return {
      total: totalEffectiveness,
      base: baseEffectiveness,
      synergy: synergyBonus,
      conflict: conflictPenalty,
      components
    };
  }, [selectedComponents]);

  // Calculate costs
  const totalCosts = useMemo(() => {
    const components = Array.from(selectedComponents).map(type => ATOMIC_COMPONENTS[type]).filter(Boolean) as AtomicGovernmentComponent[];

    return {
      implementation: components.reduce((sum, c) => sum + c.implementationCost, 0),
      maintenance: components.reduce((sum, c) => sum + c.maintenanceCost, 0),
      capacity: components.reduce((sum, c) => sum + c.requiredCapacity, 0)
    };
  }, [selectedComponents]);

  // Toggle component selection
  const toggleComponent = (type: ComponentType) => {
    setSelectedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Identify synergies and conflicts
  const synergyAnalysis = useMemo(() => {
    const synergies: Array<{ components: string[], level: 'high' | 'medium' | 'low' }> = [];
    const conflicts: Array<{ components: string[], severity: 'high' | 'medium' | 'low' }> = [];

    const components = Array.from(selectedComponents).map(type => ATOMIC_COMPONENTS[type]).filter(Boolean) as AtomicGovernmentComponent[];

    components.forEach(comp1 => {
      components.forEach(comp2 => {
        if (comp1.id !== comp2.id) {
          if (comp1.synergies?.includes(comp2.type)) {
            synergies.push({
              components: [comp1.name, comp2.name],
              level: 'high'
            });
          }
          if (comp1.conflicts?.includes(comp2.type)) {
            conflicts.push({
              components: [comp1.name, comp2.name],
              severity: 'high'
            });
          }
        }
      });
    });

    return { synergies, conflicts };
  }, [selectedComponents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Section */}
      <Card className="glass-hierarchy-parent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/20">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Atomic Government System</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {countryData?.name || 'Government'} - Component-Based Architecture
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowComponentSelector(!showComponentSelector)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Component
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <AtomicMetric
              label="Government Effectiveness"
              value={calculateEffectiveness.total}
              unit="%"
              trend={calculateEffectiveness.total > 70 ? 'up' : calculateEffectiveness.total < 50 ? 'down' : 'stable'}
              status={calculateEffectiveness.total > 75 ? 'success' : calculateEffectiveness.total > 50 ? 'warning' : 'error'}
              icon={Shield}
            />

            <AtomicMetric
              label="Active Components"
              value={selectedComponents.size}
              trend={selectedComponents.size > 5 ? 'up' : 'stable'}
              status="neutral"
              icon={Building2}
            />

            <AtomicMetric
              label="Monthly Cost"
              value={totalCosts.maintenance}
              unit="₡"
              status={totalCosts.maintenance > 500000 ? 'warning' : 'success'}
              icon={TrendingUp}
            />

            <AtomicMetric
              label="Capacity Used"
              value={totalCosts.capacity}
              unit="%"
              trend={totalCosts.capacity > 80 ? 'up' : 'stable'}
              status={totalCosts.capacity > 90 ? 'error' : totalCosts.capacity > 70 ? 'warning' : 'success'}
              icon={Activity}
            />
          </div>

          {/* Effectiveness Breakdown */}
          <AtomicEffectiveness
            value={calculateEffectiveness.total}
            label="Overall Government Effectiveness"
            description="Combined effectiveness of all active government components"
            showDetails={true}
            factors={[
              { name: 'Base Components', impact: calculateEffectiveness.base - 50, positive: true },
              { name: 'Synergy Bonuses', impact: calculateEffectiveness.synergy, positive: true },
              { name: 'Conflict Penalties', impact: -calculateEffectiveness.conflict, positive: false }
            ]}
            className="mb-6"
          />

          {/* Tabs Section */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="synergies">Synergies</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* System Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <AtomicGauge
                  value={calculateEffectiveness.total}
                  max={100}
                  label="Effectiveness"
                  unit="%"
                  thresholds={{ critical: 40, warning: 60, good: 80 }}
                />

                <AtomicGauge
                  value={totalCosts.capacity}
                  max={100}
                  label="Capacity"
                  unit="%"
                  thresholds={{ critical: 90, warning: 70, good: 50 }}
                />

                <AtomicGauge
                  value={Math.min(100, (totalCosts.maintenance / 1000000) * 100)}
                  max={100}
                  label="Cost Efficiency"
                  unit="%"
                  thresholds={{ critical: 80, warning: 60, good: 40 }}
                />
              </div>

              {/* Progress Indicators */}
              <Card className="glass-hierarchy-child">
                <CardHeader>
                  <CardTitle className="text-lg">System Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AtomicProgress
                    label="Power Distribution"
                    value={selectedComponents.size}
                    max={10}
                    color="blue"
                  />
                  <AtomicProgress
                    label="Decision Making"
                    value={calculateEffectiveness.base}
                    max={100}
                    color="green"
                  />
                  <AtomicProgress
                    label="Legitimacy"
                    value={80 + calculateEffectiveness.synergy - calculateEffectiveness.conflict}
                    max={100}
                    color="purple"
                  />
                  <AtomicProgress
                    label="Institutional Strength"
                    value={selectedComponents.size * 15}
                    max={100}
                    color="yellow"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="components" className="space-y-4">
              {/* Component Selector */}
              {showComponentSelector && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="glass-hierarchy-child rounded-lg p-4 mb-4"
                >
                  <h3 className="font-semibold mb-3">Available Components</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(ATOMIC_COMPONENTS).map((component) => component && (
                      <AtomicComponentCard
                        key={component.id}
                        title={component.name}
                        description={component.description}
                        icon={Crown}
                        effectiveness={component.effectiveness}
                        cost={component.maintenanceCost}
                        isActive={selectedComponents.has(component.type)}
                        onToggle={() => toggleComponent(component.type)}
                        synergies={component.synergies?.map(s => ATOMIC_COMPONENTS[s]?.name || s)}
                        conflicts={component.conflicts?.map(c => ATOMIC_COMPONENTS[c]?.name || c)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Active Components */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calculateEffectiveness.components.map((component) => (
                  <AtomicComponentCard
                    key={component.id}
                    title={component.name}
                    description={component.description}
                    icon={Crown}
                    effectiveness={component.effectiveness}
                    cost={component.maintenanceCost}
                    isActive={true}
                    onToggle={() => toggleComponent(component.type)}
                    synergies={component.synergies?.map(s => ATOMIC_COMPONENTS[s]?.name || s)}
                    conflicts={component.conflicts?.map(c => ATOMIC_COMPONENTS[c]?.name || c)}
                  />
                ))}
              </div>

              {calculateEffectiveness.components.length === 0 && (
                <Card className="glass-hierarchy-child">
                  <CardContent className="text-center py-8">
                    <Info className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      No components selected. Click "Add Component" to build your government system.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="synergies" className="space-y-4">
              {/* Synergies */}
              {synergyAnalysis.synergies.length > 0 && (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-green-500" />
                      Active Synergies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {synergyAnalysis.synergies.map((synergy, index) => (
                      <AtomicSynergy
                        key={index}
                        components={synergy.components}
                        synergyLevel={synergy.level}
                        description="These components work well together, providing bonus effectiveness"
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Conflicts */}
              {synergyAnalysis.conflicts.length > 0 && (
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Component Conflicts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {synergyAnalysis.conflicts.map((conflict, index) => (
                      <AtomicSynergy
                        key={index}
                        components={conflict.components}
                        synergyLevel="conflict"
                        description="These components conflict with each other, reducing effectiveness"
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {synergyAnalysis.synergies.length === 0 && synergyAnalysis.conflicts.length === 0 && (
                <Card className="glass-hierarchy-child">
                  <CardContent className="text-center py-8">
                    <Info className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      Select multiple components to see synergies and conflicts.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-lg">Component Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <AtomicStatus status="active" label={`${selectedComponents.size} Active Components`} pulse />
                      <AtomicStatus status="pending" label={`${synergyAnalysis.synergies.length} Synergies`} />
                      <AtomicStatus status="error" label={`${synergyAnalysis.conflicts.length} Conflicts`} />
                      <AtomicStatus status="success" label="System Operational" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-hierarchy-child">
                  <CardHeader>
                    <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Implementation</span>
                        <span className="font-medium">₡{totalCosts.implementation.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Monthly Maintenance</span>
                        <span className="font-medium">₡{totalCosts.maintenance.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Annual Cost</span>
                        <span className="font-medium">₡{(totalCosts.maintenance * 12).toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between">
                        <span className="text-sm font-medium">Cost per Effectiveness Point</span>
                        <span className="font-bold">
                          ₡{calculateEffectiveness.total > 0
                            ? Math.round(totalCosts.maintenance / calculateEffectiveness.total).toLocaleString()
                            : '0'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AtomicGovernmentDashboard;