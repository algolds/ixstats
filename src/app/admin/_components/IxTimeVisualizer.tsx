/**
 * IxTime Visualizer - Comprehensive time management and accuracy verification
 * 
 * This component provides real-time visualization of IxTime calculations,
 * accuracy verification, synchronization status, and time simulation tools.
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Clock, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Play, 
  Pause,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Settings,
  BarChart3,
  Timer,
  Gauge
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { IxTime } from '~/lib/ixtime';
import { IxTimeAccuracyVerifier, type TimeSimulationResult } from '~/lib/ixtime-accuracy';
import { IxTimeSyncManager, type MasterTimeState, type SyncStatus } from '~/lib/ixtime-sync';

interface TimeVisualizationData {
  currentIxTime: number;
  currentRealTime: number;
  currentGameYear: number;
  multiplier: number;
  isPaused: boolean;
  formattedTime: string;
  timeSinceEpoch: number;
  timeUntilTransition: number | null;
  epochData: {
    realWorldEpoch: number;
    inGameEpoch: number;
    speedChangeEpoch: number;
  };
}

export function IxTimeVisualizer() {
  const [timeData, setTimeData] = useState<TimeVisualizationData | null>(null);
  const [accuracyStatus, setAccuracyStatus] = useState<any>(null);
  const [syncManager] = useState(() => IxTimeSyncManager.getInstance());
  const [masterState, setMasterState] = useState<MasterTimeState | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [simulationResults, setSimulationResults] = useState<TimeSimulationResult | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Update time data
  const updateTimeData = useCallback(() => {
    try {
      const currentIxTime = IxTime.getCurrentIxTime();
      const currentRealTime = Date.now();
      const currentGameYear = IxTime.getCurrentGameYear();
      const multiplier = IxTime.getTimeMultiplier();
      const isPaused = IxTime.isPaused();
      const formattedTime = IxTime.formatIxTime(currentIxTime, true);
      
      const realWorldEpoch = IxTime.getRealWorldEpoch();
      const inGameEpoch = IxTime.getInGameEpoch();
      const speedChangeEpoch = new Date('2025-07-27T00:00:00Z').getTime();
      
      const timeSinceEpoch = currentIxTime - realWorldEpoch;
      
      // Calculate time until next major transition (if any)
      let timeUntilTransition = null;
      if (currentRealTime < speedChangeEpoch) {
        timeUntilTransition = speedChangeEpoch - currentRealTime;
      }

      setTimeData({
        currentIxTime,
        currentRealTime,
        currentGameYear,
        multiplier,
        isPaused,
        formattedTime,
        timeSinceEpoch,
        timeUntilTransition,
        epochData: {
          realWorldEpoch,
          inGameEpoch,
          speedChangeEpoch
        }
      });
    } catch (error) {
      console.error('Error updating time data:', error);
    }
  }, []);

  // Update accuracy status
  const updateAccuracyStatus = useCallback(() => {
    try {
      const status = IxTimeAccuracyVerifier.getAccuracyStatus();
      setAccuracyStatus(status);
    } catch (error) {
      console.error('Error updating accuracy status:', error);
    }
  }, []);

  // Update sync status
  const updateSyncStatus = useCallback(() => {
    try {
      const master = syncManager.getMasterState();
      const statuses = syncManager.getSyncStatuses();
      setMasterState(master);
      setSyncStatuses(statuses);
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }, [syncManager]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      updateTimeData();
      updateAccuracyStatus();
      updateSyncStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, updateTimeData, updateAccuracyStatus, updateSyncStatus]);

  // Initial load
  useEffect(() => {
    updateTimeData();
    updateAccuracyStatus();
    updateSyncStatus();
    
    // Start sync manager
    syncManager.start().catch(console.error);
    
    return () => {
      syncManager.stop();
    };
  }, [syncManager, updateTimeData, updateAccuracyStatus, updateSyncStatus]);

  // Run comprehensive simulation
  const runSimulation = useCallback(async () => {
    setIsRunningSimulation(true);
    try {
      const results = await IxTimeAccuracyVerifier.runAllTests();
      setSimulationResults(results);
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setIsRunningSimulation(false);
    }
  }, []);

  // Format time duration
  const formatDuration = useCallback((ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, []);

  // Status color mapping
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, []);

  const getStatusBadgeVariant = useCallback((status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'excellent': case 'good': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  }, []);

  if (!timeData || !accuracyStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading IxTime visualization...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Clock className="h-6 w-6" />
          <h2 className="text-2xl font-bold">IxTime Management & Visualization</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateTimeData();
              updateAccuracyStatus();
              updateSyncStatus();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
          <TabsTrigger value="synchronization">Sync Status</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Current Time Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Current IxTime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-mono font-bold text-blue-600">
                    {timeData.formattedTime}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Game Year: {timeData.currentGameYear}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Raw timestamp: {timeData.currentIxTime}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Time Multiplier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold">
                      {timeData.multiplier}x
                    </div>
                    {timeData.isPaused && (
                      <Badge variant="destructive">PAUSED</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {timeData.multiplier === 4 ? '4x Speed Period (Pre-2025)' : 
                     timeData.multiplier === 2 ? '2x Speed Period (Post-2025)' : 
                     'Custom Speed Override'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {accuracyStatus.status === 'excellent' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : accuracyStatus.status === 'critical' ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                    <Badge variant={getStatusBadgeVariant(accuracyStatus.status)}>
                      {accuracyStatus.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm font-mono">
                    Accuracy: {accuracyStatus.accuracy.toFixed(4)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {accuracyStatus.message}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Epoch Timeline Visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                IxTime Timeline & Epochs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="font-semibold text-blue-800">Real World Epoch</div>
                    <div className="text-blue-600">October 4, 2020</div>
                    <div className="text-xs text-blue-500">IxTime system start</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="font-semibold text-green-800">Speed Transition</div>
                    <div className="text-green-600">July 27, 2025</div>
                    <div className="text-xs text-green-500">4x → 2x multiplier</div>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="font-semibold text-purple-800">In-Game Epoch</div>
                    <div className="text-purple-600">January 1, 2028</div>
                    <div className="text-xs text-purple-500">Game baseline</div>
                  </div>
                </div>

                {/* Visual timeline */}
                <div className="relative">
                  <div className="h-2 bg-gradient-to-r from-blue-200 via-green-200 to-purple-200 rounded-full"></div>
                  <div className="absolute top-0 left-0 h-2 bg-blue-500 rounded-l-full" style={{
                    width: timeData.currentRealTime >= timeData.epochData.speedChangeEpoch ? '50%' : 
                           `${((timeData.currentRealTime - timeData.epochData.realWorldEpoch) / 
                              (timeData.epochData.speedChangeEpoch - timeData.epochData.realWorldEpoch)) * 50}%`
                  }}></div>
                  {timeData.currentRealTime >= timeData.epochData.speedChangeEpoch && (
                    <div className="absolute top-0 left-1/2 h-2 bg-green-500" style={{
                      width: '25%', // Placeholder for post-transition progress
                      borderRadius: '0 4px 4px 0'
                    }}></div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  <div>Time since real world epoch: {formatDuration(timeData.timeSinceEpoch)}</div>
                  {timeData.timeUntilTransition && (
                    <div>Time until speed transition: {formatDuration(timeData.timeUntilTransition)}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Accuracy Verification System
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {accuracyStatus.accuracy.toFixed(6)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Target: ≥99.9998% accuracy
                    </div>
                  </div>
                  <div className={`text-right ${getStatusColor(accuracyStatus.status)}`}>
                    <div className="text-lg font-semibold">
                      {accuracyStatus.status.toUpperCase()}
                    </div>
                    <div className="text-sm">
                      {accuracyStatus.isAccurate ? 'PASSING' : 'FAILING'}
                    </div>
                  </div>
                </div>

                <Progress 
                  value={Math.min(100, accuracyStatus.accuracy)} 
                  className="h-3"
                />

                <div className="text-sm text-muted-foreground">
                  {accuracyStatus.message}
                </div>

                <Button 
                  onClick={runSimulation}
                  disabled={isRunningSimulation}
                  className="w-full"
                >
                  {isRunningSimulation ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Running Comprehensive Tests...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Run Full Accuracy Test Suite
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {simulationResults && (
            <Card>
              <CardHeader>
                <CardTitle>Test Suite Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {simulationResults.passedTests}
                      </div>
                      <div className="text-sm text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {simulationResults.failedTests}
                      </div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {simulationResults.overallAccuracy.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Overall</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {simulationResults.averageExecutionTime.toFixed(1)}ms
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Time</div>
                    </div>
                  </div>

                  {simulationResults.criticalIssues.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="font-semibold text-red-800 mb-2">Critical Issues Found:</div>
                      <ul className="text-sm text-red-700 space-y-1">
                        {simulationResults.criticalIssues.map((issue, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {issue.details}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Synchronization Tab */}
        <TabsContent value="synchronization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Time Synchronization Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncStatuses.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Timer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No sync targets configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncStatuses.map((status) => (
                      <div key={status.target} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {status.status === 'synced' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : status.status === 'drift' ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <div>
                            <div className="font-medium">{status.target}</div>
                            <div className="text-sm text-muted-foreground">
                              Last sync: {new Date(status.lastSyncAttempt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">
                            Drift: {status.drift > 0 ? '+' : ''}{status.drift}ms
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {status.accuracy.toFixed(2)}% accuracy
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  onClick={() => syncManager.forceSyncAll()} 
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync All Targets
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulation Tab */}
        <TabsContent value="simulation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Time Simulation & Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Run comprehensive simulations to verify IxTime accuracy across different scenarios,
                  test edge cases, and validate synchronization between systems.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={runSimulation}
                    disabled={isRunningSimulation}
                    variant="outline"
                    className="h-16"
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Zap className="h-5 w-5 mr-2" />
                        Accuracy Test Suite
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Run all accuracy verification tests
                      </div>
                    </div>
                  </Button>

                  <Button 
                    onClick={() => syncManager.runComprehensiveSync()}
                    variant="outline"
                    className="h-16"
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <RefreshCw className="h-5 w-5 mr-2" />
                        Sync Verification
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Test all synchronization targets
                      </div>
                    </div>
                  </Button>
                </div>

                {isRunningSimulation && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="font-medium">Running comprehensive simulation...</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      This may take several seconds to complete all accuracy tests.
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}