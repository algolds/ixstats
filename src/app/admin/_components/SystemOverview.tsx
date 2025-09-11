// src/app/admin/_components/SystemOverview.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Database, 
  Server, 
  Activity, 
  Cpu, 
  MemoryStick, 
  HardDrive, 
  Globe, 
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";
import { DatabaseExplorer } from "./DatabaseExplorer";
import { SystemLogs } from "./SystemLogs";

interface SystemMetrics {
  database: {
    connectionCount: number;
    queryCount: number;
    averageResponseTime: number;
    tableCount: number;
    totalRecords: number;
    diskUsage: number;
  };
  server: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    requestCount: number;
    errorRate: number;
  };
  application: {
    activeUsers: number;
    totalCalculations: number;
    cacheHitRate: number;
    botConnectionStatus: boolean;
    lastBackup: Date;
    configVersion: string;
  };
}

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
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [formulas, setFormulas] = useState<InternalFormula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<InternalFormula | null>(null);
  const [isEditingFormula, setIsEditingFormula] = useState(false);

  // Real-time system metrics
  const { data: systemStatus, refetch: refetchSystemStatus } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const { data: calculationFormulasData, error: formulasError } = api.admin.getCalculationFormulas.useQuery(
    undefined,
    {
      retry: false,
      refetchOnWindowFocus: false,
      onError: (error: unknown) => {
        console.error("Failed to fetch calculation formulas:", error);
      }
    }
  );

  // Mock metrics for demonstration - replace with real API calls
  useEffect(() => {
    const mockMetrics: SystemMetrics = {
      database: {
        connectionCount: 12,
        queryCount: 1543,
        averageResponseTime: 23.5,
        tableCount: 47,
        totalRecords: 89234,
        diskUsage: 67.8
      },
      server: {
        uptime: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
        memoryUsage: 72.3,
        cpuUsage: 34.7,
        diskUsage: 45.2,
        requestCount: 5678,
        errorRate: 0.12
      },
      application: {
        activeUsers: 8,
        totalCalculations: 234567,
        cacheHitRate: 94.6,
        botConnectionStatus: true,
        lastBackup: new Date(Date.now() - (2 * 60 * 60 * 1000)), // 2 hours ago
        configVersion: "1.0.0"
      }
    };

    const mockFormulas: InternalFormula[] = [
      {
        id: "gdp-growth",
        name: "GDP Growth Calculation",
        description: "Core GDP growth formula with tier-based constraints",
        formula: "(baseGDP * globalGrowthFactor * tierMultiplier) + dmModifiers - inflationAdjustment",
        variables: {
          globalGrowthFactor: 1.0321,
          baseInflationRate: 0.025,
          tierMultiplierMax: 0.10,
          populationGrowthWeight: 0.3
        },
        lastModified: new Date(),
        isActive: true,
        category: "Economic"
      },
      {
        id: "tax-efficiency",
        name: "Tax Collection Efficiency",
        description: "Government tax collection effectiveness calculation",
        formula: "baseTaxRate * governmentEfficiency * atomicModifiers * complianceRate",
        variables: {
          baseTaxRate: 0.25,
          governmentEfficiency: 0.85,
          complianceRate: 0.78,
          atomicBonus: 1.2
        },
        lastModified: new Date(Date.now() - (3 * 24 * 60 * 60 * 1000)),
        isActive: true,
        category: "Economic"
      },
      {
        id: "stability-index",
        name: "Country Stability Index",
        description: "Overall country stability based on multiple factors",
        formula: "(economicStability + politicalStability + socialCohesion) / 3 * atomicGovernanceBonus",
        variables: {
          economicWeight: 0.4,
          politicalWeight: 0.35,
          socialWeight: 0.25,
          atomicGovernanceBonus: 1.15
        },
        lastModified: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)),
        isActive: true,
        category: "Stability"
      },
      {
        id: "population-growth",
        name: "Population Growth Rate",
        description: "Natural population growth with migration factors",
        formula: "naturalGrowthRate + migrationRate - mortalityAdjustment + economicFactors",
        variables: {
          naturalGrowthRate: 0.018,
          baseMigrationRate: 0.005,
          economicGrowthInfluence: 0.3,
          healthcareIndex: 0.85
        },
        lastModified: new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)),
        isActive: true,
        category: "Demographics"
      }
    ];

    setMetrics(mockMetrics);
    // Use API data if available, otherwise fall back to mock data
    if (calculationFormulasData?.formulas) {
      setFormulas(calculationFormulasData.formulas.map(f => ({
        ...f,
        formula: `function ${f.name.replace(/\s+/g, '')}() { /* ${f.description} */ }`,
        variables: {
          globalFactor: 1.0321,
          baseInflationRate: 0.025,
          tierMultiplierMax: 0.10,
          populationGrowthWeight: 0.3
        },
        constants: {
          minGrowthRate: -0.05,
          maxTierMultipliers: [0.10, 0.075, 0.05, 0.035, 0.0275, 0.015, 0.005]
        },
        dependencies: ["dm-modifiers", "economic-tiers"],
        testCases: [
          {
            id: "test-1",
            name: "Standard Test Case",
            inputs: { baseGDP: 45000, population: 10000000, tier: 3 },
            expectedOutput: 0.048,
            status: "pending" as const
          }
        ],
        modifiedBy: "system"
      })));
    } else {
      setFormulas(mockFormulas);
    }
  }, [calculationFormulasData]);

  const getStatusColor = (value: number, type: 'percentage' | 'inverse' = 'percentage') => {
    if (type === 'inverse') {
      value = 100 - value;
    }
    if (value >= 80) return "text-green-600 dark:text-green-400";
    if (value >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStatusIcon = (value: number, type: 'percentage' | 'inverse' = 'percentage') => {
    if (type === 'inverse') {
      value = 100 - value;
    }
    if (value >= 80) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (value >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  if (!metrics) {
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
                    <p className="text-sm font-medium text-muted-foreground">Server Status</p>
                    <p className="text-2xl font-bold">Online</p>
                  </div>
                  <Server className="h-8 w-8 text-green-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Uptime: {formatDistanceToNow(metrics.server.uptime)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold">{metrics.application.activeUsers}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Total calculations: {metrics.application.totalCalculations.toLocaleString()}
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
                      {metrics.application.botConnectionStatus ? "Connected" : "Disconnected"}
                    </p>
                  </div>
                  <Globe className={`h-8 w-8 ${metrics.application.botConnectionStatus ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDistanceToNow(new Date(Date.now() - 300000))} ago
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                    <p className={`text-2xl font-bold ${getStatusColor(metrics.server.errorRate, 'inverse')}`}>
                      {metrics.server.errorRate.toFixed(2)}%
                    </p>
                  </div>
                  {getStatusIcon(metrics.server.errorRate, 'inverse')}
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {metrics.server.requestCount.toLocaleString()} total requests
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Server Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Server Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">CPU Usage</span>
                    <span className={`text-sm ${getStatusColor(100 - metrics.server.cpuUsage)}`}>
                      {metrics.server.cpuUsage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={metrics.server.cpuUsage} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className={`text-sm ${getStatusColor(100 - metrics.server.memoryUsage)}`}>
                      {metrics.server.memoryUsage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={metrics.server.memoryUsage} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Disk Usage</span>
                    <span className={`text-sm ${getStatusColor(100 - metrics.server.diskUsage)}`}>
                      {metrics.server.diskUsage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={metrics.server.diskUsage} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Database Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                    <p className="text-xl font-bold">{metrics.database.connectionCount}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Query Count</p>
                    <p className="text-xl font-bold">{metrics.database.queryCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                    <p className="text-xl font-bold">{metrics.database.averageResponseTime}ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cache Hit Rate</p>
                    <p className={`text-xl font-bold ${getStatusColor(metrics.application.cacheHitRate)}`}>
                      {metrics.application.cacheHitRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Database Size</p>
                  <p className="text-sm">
                    <span className="font-medium">{metrics.database.tableCount}</span> tables, 
                    <span className="font-medium ml-1">{metrics.database.totalRecords.toLocaleString()}</span> records
                  </p>
                  <div className="mt-2">
                    <Progress value={metrics.database.diskUsage} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.database.diskUsage.toFixed(1)}% disk usage
                    </p>
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