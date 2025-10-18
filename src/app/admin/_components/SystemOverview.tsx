// src/app/admin/_components/SystemOverview.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Database,
  Server,
  Activity,
  Globe,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { SystemLogs } from "./SystemLogs";

interface InternalFormula {
  id: string;
  name: string;
  description: string;
  formula: string;
  variables: Record<string, number>;
  lastModified: Date;
  isActive: boolean;
  category: string;
}

export function SystemOverview() {
  const [formulas, setFormulas] = useState<InternalFormula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<InternalFormula | null>(null);
  const [isEditingFormula, setIsEditingFormula] = useState(false);

  // Real-time system metrics
  const { data: systemStatus, refetch: refetchSystemStatus } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const { data: systemHealth } = api.admin.getSystemHealth.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const { data: calculationFormulasData, error: formulasError } = api.admin.getCalculationFormulas.useQuery(
    undefined,
    {
      retry: false,
      refetchOnWindowFocus: false
    }
  );

  // Handle formulas error
  useEffect(() => {
    if (formulasError) {
      console.error("Failed to fetch calculation formulas:", formulasError);
    }
  }, [formulasError]);

  // Process formula data from API
  useEffect(() => {
    if (calculationFormulasData?.formulas) {
      setFormulas(calculationFormulasData.formulas.map(f => ({
        ...f,
        formula: `Effective Growth = (baseGDP * ${f.variables.globalGrowthFactor} * tierMultiplier) + dmModifiers`,
        variables: f.variables,
        lastModified: f.lastModified,
        isActive: f.isActive,
        category: f.category
      })));
    }
  }, [calculationFormulasData]);


  if (!systemStatus || !systemHealth) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Overview</h2>
          <p className="text-muted-foreground">Real-time system metrics and internal calculations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetchSystemStatus()}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">System Metrics</TabsTrigger>
          <TabsTrigger value="formulas">Internal Formulas</TabsTrigger>
          <TabsTrigger value="database">Database Explorer</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          {/* Critical Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Database Status</p>
                    <p className="text-2xl font-bold">
                      {systemHealth.database.connected ? "Connected" : "Disconnected"}
                    </p>
                  </div>
                  <Database className={`h-8 w-8 ${systemHealth.database.connected ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Countries: {systemHealth.database.countries}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Countries</p>
                    <p className="text-2xl font-bold">{systemStatus.countryCount}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Active DM Inputs: {systemStatus.activeDmInputs}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bot Connection</p>
                    <p className="text-2xl font-bold">
                      {systemHealth.bot.available ? "Connected" : "Unavailable"}
                    </p>
                  </div>
                  <Globe className={`h-8 w-8 ${systemHealth.bot.available ? 'text-green-500' : 'text-yellow-500'}`} />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {systemHealth.bot.message || "No message"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Calculations</p>
                    <p className="text-2xl font-bold">
                      {systemHealth.database.recentCalculations}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Last 24 hours
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* IxTime Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  IxTime System
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current IxTime</p>
                    <p className="text-lg font-bold">{systemHealth.ixTime.formatted}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Multiplier</p>
                    <p className="text-lg font-bold">{systemHealth.ixTime.multiplier}x</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <p className="text-lg font-bold">
                      {systemHealth.ixTime.isPaused ? "Paused" : "Running"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Update</p>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(systemHealth.lastUpdate))} ago
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Countries</p>
                    <p className="text-xl font-bold">{systemHealth.database.countries}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recent Calculations</p>
                    <p className="text-xl font-bold">{systemHealth.database.recentCalculations}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Last Calculation</p>
                    {systemStatus.lastCalculation ? (
                      <div className="text-sm">
                        <p>
                          <span className="font-medium">{systemStatus.lastCalculation.countriesUpdated}</span> countries updated
                        </p>
                        <p className="text-muted-foreground">
                          {formatDistanceToNow(new Date(systemStatus.lastCalculation.timestamp))} ago
                          ({systemStatus.lastCalculation.executionTimeMs}ms)
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No calculations yet</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Server Resources - Not Available */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Server Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">Server metrics not available</p>
                    <p className="text-xs mt-1">CPU, memory, and disk usage monitoring requires additional infrastructure setup</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="formulas" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formula List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Internal Formulas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Core calculation formulas used throughout the system
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {formulas.map((formula) => (
                      <div
                        key={formula.id}
                        onClick={() => setSelectedFormula(formula)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFormula?.id === formula.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{formula.name}</h4>
                          <Badge variant={formula.isActive ? "default" : "secondary"}>
                            {formula.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formula.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Modified {formatDistanceToNow(formula.lastModified)} ago
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Formula Details */}
            <div className="lg:col-span-2">
              {selectedFormula ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedFormula.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {selectedFormula.description}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsEditingFormula(!isEditingFormula)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                      >
                        <Settings className="h-4 w-4" />
                        {isEditingFormula ? "Save" : "Edit"}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Formula</h4>
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                        {selectedFormula.formula}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Variables</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedFormula.variables).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                            <span className="font-mono text-sm">{key}</span>
                            {isEditingFormula ? (
                              <input
                                type="number"
                                step="0.0001"
                                defaultValue={value}
                                className="w-24 px-2 py-1 text-sm border rounded"
                              />
                            ) : (
                              <span className="text-sm font-medium">{value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Category: <span className="font-medium">{selectedFormula.category}</span></span>
                      <span>Status: <Badge variant={selectedFormula.isActive ? "default" : "secondary"}>
                        {selectedFormula.isActive ? "Active" : "Inactive"}
                      </Badge></span>
                      <span>Last modified: {formatDistanceToNow(selectedFormula.lastModified)} ago</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Select a formula to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <DatabaseExplorer />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <SystemLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}