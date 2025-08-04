// src/app/admin/page.tsx
// FIXED: Updated admin page to work with current system

"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { 
  StatusCards,
  BotStatusBanner,
  BotControlPanel,
  TimeControlPanel,
  EconomicControlPanel,
  ActionPanel,
  CalculationLogs,
  DataImportSection,
  WarningPanel,
  ImportPreviewDialog,
  SdiAdminPanel,
  CountryAdminPanel,
  NotificationsAdmin,
  UserManagement,
} from "./_components";
import { IxTimeVisualizer } from "./_components/IxTimeVisualizer";
import { GlassCard, EnhancedCard } from "~/components/ui/enhanced-card";
import { BentoGrid } from "~/components/ui/bento-grid";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { TrendIndicator } from "~/components/ui/trend-indicator";
import { HealthRing } from "~/components/ui/health-ring";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { FlagTestComponent } from "~/components/FlagTestComponent";
import { RealTimeClock } from "~/components/ui/real-time-clock";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { CONFIG_CONSTANTS } from "~/lib/config-service";
import type { 
  SystemStatus, 
  AdminPageBotStatusView, 
  ImportAnalysis,
  BaseCountryData,
  CalculationLog
} from "~/types/ixstats";
import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { SignedIn, SignedOut, SignInButton, useUser, UserButton } from "@clerk/nextjs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Sidebar, SidebarBody, SidebarLink } from "~/components/ui/sidebar";
import { Settings, Clock, TrendingUp, Bot, Database, Upload, List, Shield, Users, Bell } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { BarChart3, Users as UsersIcon } from "lucide-react";
import { formatPopulation, formatCurrency } from '~/lib/chart-utils';

export default function AdminPage() {
  // All hooks must be called unconditionally and at the top
  useEffect(() => {
    document.title = "Admin Panel - IxStats";
  }, []);

  const { user, isLoaded } = useUser();
  const [config, setConfig] = useState({
    globalGrowthFactor: CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR as number,
    autoUpdate: true,
    botSyncEnabled: true,
    timeMultiplier: 2.0,
  });
  const [timeState, setTimeState] = useState({
    customDate: new Date().toISOString().split('T')[0] || "",
    customTime: "12:00",
  });
  const [importState, setImportState] = useState({
    isUploading: false,
    isAnalyzing: false,
    analyzeError: null as string | null,
    importError: null as string | null,
    previewData: null as ImportAnalysis | null,
    showPreview: false,
    fileData: null as number[] | null,
    fileName: null as string | null,
  });
  const [actionState, setActionState] = useState({
    calculationPending: false,
    setTimePending: false,
    savePending: false,
    syncPending: false,
    pausePending: false,
    resumePending: false,
    clearPending: false,
    syncEpochPending: false,
    autoSyncPending: false,
    lastUpdate: null as Date | null,
    lastBotSync: null as Date | null,
  });
  const [selectedSection, setSelectedSection] = useState("overview");
  const sidebarLinks = [
    { label: "Overview", value: "overview", icon: <Settings /> },
    { label: "Time Controls", value: "time", icon: <Clock /> },
    { label: "IxTime Visualizer", value: "ixtime-visualizer", icon: <BarChart3 /> },
    { label: "Economic Controls", value: "economic", icon: <TrendingUp /> },
    { label: "Bot Controls", value: "bot", icon: <Bot /> },
    { label: "Data Import", value: "import", icon: <Upload /> },
    { label: "Calculation Logs", value: "logs", icon: <List /> },
    { label: "Country Admin", value: "country-admin", icon: <Users /> },
    { label: "User Management", value: "user-management", icon: <Users /> },
    { label: "SDI Admin", value: "sdi", icon: <Shield /> },
    { label: "Notifications", value: "notifications", icon: <Bell /> },
  ];

  // TRPC Queries - all called unconditionally
  const { 
    data: systemStatus, 
    isLoading: statusLoading, 
    refetch: refetchStatus 
  } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: false,
  });
  const { 
    data: botStatus, 
    isLoading: botStatusLoading,
    refetch: refetchBotStatus 
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000, // Refresh every 15 seconds
    refetchOnWindowFocus: false,
  });
  const { 
    data: configData, 
    isLoading: configLoading,
    refetch: refetchConfig 
  } = api.admin.getConfig.useQuery();
  const { 
    data: calculationLogs, 
    isLoading: logsLoading,
    error: logsError 
  } = api.admin.getCalculationLogs.useQuery({ limit: 10 });

  // TRPC Mutations - all called unconditionally
  const saveConfigMutation = api.admin.saveConfig.useMutation();
  const forceCalculationMutation = api.countries.updateStats.useMutation();
  const setCustomTimeMutation = api.admin.setCustomTime.useMutation();
  const analyzeImportMutation = api.admin.analyzeImport.useMutation();
  const importDataMutation = api.admin.importRosterData.useMutation();
  const syncEpochMutation = api.admin.syncEpochWithData.useMutation();
  // Bot control mutations
  const syncBotMutation = api.admin.syncBot.useMutation();
  const pauseBotMutation = api.admin.pauseBot.useMutation();
  const resumeBotMutation = api.admin.resumeBot.useMutation();
  const clearBotOverridesMutation = api.admin.clearBotOverrides.useMutation();

  // Load initial config - called unconditionally
  useEffect(() => {
    if (configData) {
      setConfig({
        globalGrowthFactor: configData.globalGrowthFactor || CONFIG_CONSTANTS.GLOBAL_GROWTH_FACTOR,
        autoUpdate: configData.autoUpdate ?? true,
        botSyncEnabled: configData.botSyncEnabled ?? true,
        timeMultiplier: configData.timeMultiplier || 2.0,
      });
    }
  }, [configData]);

  // Auto-sync with Discord bot when bot multiplier changes
  useEffect(() => {
    if (!config.botSyncEnabled || !botStatus || actionState.autoSyncPending) return;

    const currentMultiplier = config.timeMultiplier;
    // Check if bot multiplier differs from dashboard config
    const botMultiplier = botStatus.multiplier;
    const dashboardMultiplier = currentMultiplier;
    
    // If bot multiplier differs from what we expect, sync from bot
    if (botMultiplier && botMultiplier !== dashboardMultiplier) {
      console.log(`Bot multiplier (${botMultiplier}) differs from dashboard (${dashboardMultiplier}), syncing...`);
      
      setActionState(prev => ({ ...prev, autoSyncPending: true }));
      
      // Sync from bot to admin panel
      fetch('/api/ixtime/sync-from-bot', { method: 'POST' })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            console.log('Successfully synced from Discord bot:', result.message);
            // Update local config to match bot
            setConfig(prev => ({ ...prev, timeMultiplier: botMultiplier }));
            setActionState(prev => ({ ...prev, lastBotSync: new Date() }));
            // Refresh status data
            refetchStatus();
            refetchBotStatus();
          } else {
            console.warn('Failed to sync from Discord bot:', result.error);
          }
        })
        .catch(error => {
          console.warn('Error syncing from Discord bot:', error);
        })
        .finally(() => {
          setActionState(prev => ({ ...prev, autoSyncPending: false }));
        });
    }
  }, [botStatus, config.timeMultiplier, config.botSyncEnabled, actionState.autoSyncPending, refetchStatus, refetchBotStatus]);

  // Handlers - all called unconditionally
  const handleSaveConfig = useCallback(async () => {
    setActionState(prev => ({ ...prev, savePending: true }));
    try {
      await saveConfigMutation.mutateAsync(config);
      setActionState(prev => ({ ...prev, lastUpdate: new Date() }));
      await refetchConfig();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setActionState(prev => ({ ...prev, savePending: false }));
    }
  }, [config, saveConfigMutation, refetchConfig]);

  const handleForceCalculation = useCallback(async () => {
    setActionState(prev => ({ ...prev, calculationPending: true }));
    try {
      await forceCalculationMutation.mutateAsync({});
      await refetchStatus();
    } catch (error) {
      console.error("Failed to force calculation:", error);
    } finally {
      setActionState(prev => ({ ...prev, calculationPending: false }));
    }
  }, [forceCalculationMutation, refetchStatus]);

  const handleSetCustomTime = useCallback(async () => {
    if (!timeState.customDate || !timeState.customTime) return;
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      const ixTime = IxTime.createGameTime(
        parseInt(timeState.customDate.split('-')[0]!),
        parseInt(timeState.customDate.split('-')[1]!),
        parseInt(timeState.customDate.split('-')[2]!),
        parseInt(timeState.customTime.split(':')[0]!),
        parseInt(timeState.customTime.split(':')[1]!)
      );
      await setCustomTimeMutation.mutateAsync({ 
        ixTime, 
        multiplier: config.timeMultiplier 
      });
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to set custom time:", error);
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [timeState, config.timeMultiplier, setCustomTimeMutation, refetchStatus, refetchBotStatus]);

  const handleResetToRealTime = useCallback(async () => {
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      await setCustomTimeMutation.mutateAsync({ 
        ixTime: IxTime.getCurrentIxTime(),
        multiplier: 2.0 
      });
      setConfig(prev => ({ ...prev, timeMultiplier: 2.0 }));
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to reset time:", error);
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus]);

  const handleTimeMultiplierChange = useCallback(async (value: number) => {
    // Update local state immediately for UI responsiveness
    setConfig(prev => ({ ...prev, timeMultiplier: value }));
    
    // Apply to bot with current time
    setActionState(prev => ({ ...prev, setTimePending: true }));
    try {
      // Use natural time setting if available, fallback to custom time
      try {
        const naturalResponse = await fetch('/api/ixtime/set-natural', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ multiplier: value })
        });
        
        if (naturalResponse.ok) {
          const naturalResult = await naturalResponse.json();
          console.log(`Time set naturally: ${naturalResult.message}`);
        } else {
          throw new Error('Natural time setting failed');
        }
      } catch (naturalError) {
        console.warn('Natural time setting failed, using override:', naturalError);
        
        // Fallback to custom time override
        await setCustomTimeMutation.mutateAsync({ 
          ixTime: IxTime.getCurrentIxTime(),
          multiplier: value 
        });
        
        // Auto-sync with Discord bot
        try {
          const syncResponse = await fetch('/api/ixtime/sync-bot', { method: 'POST' });
          if (syncResponse.ok) {
            console.log('Discord bot automatically synced with new time settings');
          } else {
            console.warn('Failed to auto-sync with Discord bot');
          }
        } catch (syncError) {
          console.warn('Discord bot sync failed:', syncError);
        }
      }
      
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to set time multiplier:", error);
      // Revert local state on error
      setConfig(prev => ({ ...prev, timeMultiplier: 2.0 }));
    } finally {
      setActionState(prev => ({ ...prev, setTimePending: false }));
    }
  }, [setCustomTimeMutation, refetchStatus, refetchBotStatus]);

  const handleSyncEpoch = useCallback(async (targetEpoch: number) => {
    setActionState(prev => ({ ...prev, syncEpochPending: true }));
    try {
      await syncEpochMutation.mutateAsync({
        targetEpoch,
        reason: 'Manual epoch sync from admin panel'
      });
      await refetchStatus();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to sync epoch:", error);
    } finally {
      setActionState(prev => ({ ...prev, syncEpochPending: false }));
    }
  }, [syncEpochMutation, refetchStatus, refetchBotStatus]);

  // Bot control handlers
  const handleSyncBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, syncPending: true }));
    try {
      await syncBotMutation.mutateAsync();
      await refetchBotStatus();
      await refetchStatus();
    } catch (error) {
      console.error("Failed to sync bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, syncPending: false }));
    }
  }, [syncBotMutation, refetchBotStatus, refetchStatus]);

  const handleSyncFromBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, autoSyncPending: true }));
    try {
      const response = await fetch('/api/ixtime/sync-from-bot', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        console.log('Successfully synced from Discord bot:', result.message);
        // Update local config to match bot
        if (result.currentState?.multiplier) {
          setConfig(prev => ({ ...prev, timeMultiplier: result.currentState.multiplier }));
        }
        setActionState(prev => ({ ...prev, lastBotSync: new Date() }));
        await refetchStatus();
        await refetchBotStatus();
      } else {
        console.error('Failed to sync from Discord bot:', result.error);
      }
    } catch (error) {
      console.error("Error syncing from Discord bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, autoSyncPending: false }));
    }
  }, [refetchStatus, refetchBotStatus]);

  const handlePauseBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, pausePending: true }));
    try {
      await pauseBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to pause bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, pausePending: false }));
    }
  }, [pauseBotMutation, refetchBotStatus]);

  const handleResumeBot = useCallback(async () => {
    setActionState(prev => ({ ...prev, resumePending: true }));
    try {
      await resumeBotMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to resume bot:", error);
    } finally {
      setActionState(prev => ({ ...prev, resumePending: false }));
    }
  }, [resumeBotMutation, refetchBotStatus]);

  const handleClearOverrides = useCallback(async () => {
    setActionState(prev => ({ ...prev, clearPending: true }));
    try {
      await clearBotOverridesMutation.mutateAsync();
      await refetchBotStatus();
    } catch (error) {
      console.error("Failed to clear overrides:", error);
    } finally {
      setActionState(prev => ({ ...prev, clearPending: false }));
    }
  }, [clearBotOverridesMutation, refetchBotStatus]);

  // Import handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setImportState(prev => ({ 
      ...prev, 
      isAnalyzing: true, 
      analyzeError: null, 
      importError: null,
      fileData: null,
      fileName: null
    }));
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileData = Array.from(new Uint8Array(arrayBuffer));
      const fileName = file.name;
      const analysis = await analyzeImportMutation.mutateAsync({
        fileData,
        fileName,
      });
      setImportState(prev => ({ 
        ...prev, 
        previewData: analysis, 
        showPreview: true,
        importError: null,
        fileData, // Save fileData for later import
        fileName, // Save fileName for later import
      }));
    } catch (error) {
      setImportState(prev => ({ 
        ...prev, 
        analyzeError: error instanceof Error ? error.message : "Failed to analyze file",
        showPreview: false,
        previewData: null,
        fileData: null,
        fileName: null
      }));
    } finally {
      setImportState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [analyzeImportMutation]);

  // Only clear previewData/showPreview after user closes dialog, not immediately after import
  const handleImportConfirm = useCallback(async (replaceExisting: boolean, syncEpoch?: boolean, targetEpoch?: number) => {
    if (!importState.previewData || !importState.fileData || !importState.fileName) return;
    setImportState(prev => ({ ...prev, isUploading: true, importError: null }));
    try {
      // First, import the data
      await importDataMutation.mutateAsync({
        analysisId: importState.previewData.totalCountries.toString(),
        replaceExisting,
        fileData: importState.fileData,
        fileName: importState.fileName
      });
      
      // Then, if epoch sync is requested, sync the epoch time
      if (syncEpoch && targetEpoch) {
        await syncEpochMutation.mutateAsync({
          targetEpoch,
          reason: `Import sync: ${importState.fileName}`
        });
      }
      
      setImportState(prev => ({
        ...prev,
        isUploading: false,
        // Do not clear previewData/showPreview here; let user close dialog
      }));
      // Optionally, you can show a success message here
      await refetchStatus();
      await handleForceCalculation();
    } catch (error) {
      setImportState(prev => ({
        ...prev,
        importError: error instanceof Error ? error.message : "Failed to import data",
        isUploading: false
      }));
    }
  }, [importState.previewData, importState.fileData, importState.fileName, importDataMutation, syncEpochMutation, refetchStatus, handleForceCalculation]);

  // Only clear previewData/showPreview when user closes the dialog
  const handleImportClose = useCallback(() => {
    setImportState(prev => ({ 
      ...prev, 
      showPreview: false, 
      previewData: null,
      analyzeError: null,
      importError: null,
      fileData: null,
      fileName: null
    }));
  }, []);

  const handleRefreshStatus = useCallback(async () => {
    await Promise.all([
      refetchStatus(),
      refetchBotStatus(),
      refetchConfig(),
    ]);
  }, [refetchStatus, refetchBotStatus, refetchConfig]);

  // Early returns after all hooks are called
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <SignInButton mode="modal" />
      </div>
    );
  }

  if (user && user.publicMetadata?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-6">You do not have permission to view this page.</p>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminErrorBoundary>
        <div className="min-h-screen bg-background text-foreground flex">
          <Sidebar>
            <SidebarBody className="h-screen">
              <div className="flex flex-col gap-2 mt-4">
                {sidebarLinks.map((link) => (
                  <div
                    key={link.value}
                    onClick={e => { e.preventDefault(); setSelectedSection(link.value); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <SidebarLink
                      link={{ label: link.label, href: `#${link.value}`, icon: link.icon }}
                      className={selectedSection === link.value ? "bg-blue-500/20 text-blue-700 dark:text-blue-200 font-semibold shadow-lg border border-blue-400/30" : ""}
                    />
                  </div>
                ))}
              </div>
            </SidebarBody>
          </Sidebar>
          <main className="flex-1 min-h-screen px-0 md:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              {selectedSection === "overview" && (
                <>
                  {/* Header with quick stats */}
                  <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Left: Title and description */}
                      <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
                          <Settings className="h-8 w-8 md:h-10 md:w-10 mr-3 text-primary" />
                          Admin Overview
                        </h1>
                        <p className="mt-2 text-base md:text-lg text-muted-foreground">
                          System status, time, bot, and cache controls for IxStats.
                        </p>
                        {/* Real-time clock */}
                        <div className="mt-3">
                          <RealTimeClock className="bg-card/50 backdrop-blur-sm border-border rounded-lg px-3 py-2" />
                        </div>
                      </div>
                      {/* Right: Stat cards */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* IxTime Stat */}
                        <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
                          <Clock className="h-5 w-5 mr-2 text-blue-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Current IxTime</p>
                            {statusLoading ? (
                              <Skeleton className="h-5 w-24 mt-1" />
                            ) : (
                              <div className="font-semibold text-foreground">
                                {systemStatus?.ixTime?.formattedIxTime || "N/A"}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Bot Status Stat */}
                        <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
                          <Bot className="h-5 w-5 mr-2 text-green-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Bot Status</p>
                            {botStatusLoading ? (
                              <Skeleton className="h-5 w-16 mt-1" />
                            ) : (
                              <div className={`font-semibold ${botStatus?.botHealth?.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {botStatus?.botHealth?.available ? 'Online' : 'Offline'}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Global Growth Stat */}
                        <div className="flex items-center px-4 py-2 bg-card text-card-foreground rounded-lg border">
                          <TrendingUp className="h-5 w-5 mr-2 text-indigo-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Global Growth</p>
                            {configLoading ? (
                              <Skeleton className="h-5 w-12 mt-1" />
                            ) : (
                              <div className="font-semibold text-foreground">
                                {((config.globalGrowthFactor - 1) * 100).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Main grid of admin cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Time Controls Card */}
                    <Card className="flex flex-col h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-blue-500" />
                          Time Controls
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          Adjust IxTime, multiplier, and sync epoch.
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <TimeControlPanel
                          timeMultiplier={config.timeMultiplier}
                          customDate={timeState.customDate}
                          customTime={timeState.customTime}
                          botSyncEnabled={config.botSyncEnabled}
                          botStatus={botStatus}
                          onTimeMultiplierChange={handleTimeMultiplierChange}
                          onCustomDateChange={(value) => setTimeState(prev => ({ ...prev, customDate: value }))}
                          onCustomTimeChange={(value) => setTimeState(prev => ({ ...prev, customTime: value }))}
                          onSetCustomTime={handleSetCustomTime}
                          onResetToRealTime={handleResetToRealTime}
                          onSyncEpoch={handleSyncEpoch}
                          onSyncFromBot={handleSyncFromBot}
                          setTimePending={actionState.setTimePending}
                          syncEpochPending={actionState.syncEpochPending}
                          autoSyncPending={actionState.autoSyncPending}
                          lastBotSync={actionState.lastBotSync}
                        />
                      </CardContent>
                    </Card>
                    {/* Bot Controls Card */}
                    <Card className="flex flex-col h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5 text-green-500" />
                          Bot Controls
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          Pause, resume, or sync the Discord bot.
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <BotControlPanel
                          botStatus={botStatus}
                          onPauseBot={handlePauseBot}
                          onResumeBot={handleResumeBot}
                          onClearOverrides={handleClearOverrides}
                          pausePending={actionState.pausePending}
                          resumePending={actionState.resumePending}
                          clearPending={actionState.clearPending}
                        />
                      </CardContent>
                    </Card>
                    {/* Flag Cache Manager Card */}
                    <Card className="flex flex-col h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Database className="h-5 w-5 text-purple-500" />
                          Flag Cache Manager
                        </CardTitle>
                        <div className="text-sm text-muted-foreground mt-1">
                          Manage and refresh cached country flags for the dashboard.
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <FlagCacheManager />
                        
                        {/* Debug: Flag Test Component */}
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium mb-2">Debug: Flag Loading Test</h4>
                          <FlagTestComponent />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  {systemStatus && <WarningPanel systemStatus={systemStatus} />}
                </>
              )}
              {selectedSection === "time" && (
                <EnhancedCard variant="glass" className="mb-8">
                  <TimeControlPanel
                    timeMultiplier={config.timeMultiplier}
                    customDate={timeState.customDate}
                    customTime={timeState.customTime}
                    botSyncEnabled={config.botSyncEnabled}
                    botStatus={botStatus}
                    onTimeMultiplierChange={handleTimeMultiplierChange}
                    onCustomDateChange={(value) => setTimeState(prev => ({ ...prev, customDate: value }))}
                    onCustomTimeChange={(value) => setTimeState(prev => ({ ...prev, customTime: value }))}
                    onSetCustomTime={handleSetCustomTime}
                    onResetToRealTime={handleResetToRealTime}
                    onSyncEpoch={handleSyncEpoch}
                    onSyncFromBot={handleSyncFromBot}
                    setTimePending={actionState.setTimePending}
                    syncEpochPending={actionState.syncEpochPending}
                    autoSyncPending={actionState.autoSyncPending}
                    lastBotSync={actionState.lastBotSync}
                  />
                </EnhancedCard>
              )}
              {selectedSection === "ixtime-visualizer" && (
                <div className="mb-8">
                  <IxTimeVisualizer />
                </div>
              )}
              {selectedSection === "economic" && (
                <>
                  <EnhancedCard variant="glass" className="mb-8">
                    <EconomicControlPanel
                      globalGrowthFactor={config.globalGrowthFactor}
                      autoUpdate={config.autoUpdate}
                      botSyncEnabled={config.botSyncEnabled}
                      onGlobalGrowthFactorChange={(value) => setConfig(prev => ({ ...prev, globalGrowthFactor: value }))}
                      onAutoUpdateChange={(value) => setConfig(prev => ({ ...prev, autoUpdate: value }))}
                      onBotSyncEnabledChange={(value) => setConfig(prev => ({ ...prev, botSyncEnabled: value }))}
                      onForceCalculation={handleForceCalculation}
                      calculationPending={actionState.calculationPending}
                    />
                  </EnhancedCard>
                  <GlassCard className="mb-8">
                    <ActionPanel
                      lastUpdate={actionState.lastUpdate}
                      onSaveConfig={handleSaveConfig}
                      savePending={actionState.savePending}
                    />
                  </GlassCard>
                </>
              )}
              {selectedSection === "bot" && (
                <GlassCard className="mb-8">
                  <BotControlPanel
                    botStatus={botStatus}
                    onPauseBot={handlePauseBot}
                    onResumeBot={handleResumeBot}
                    onClearOverrides={handleClearOverrides}
                    pausePending={actionState.pausePending}
                    resumePending={actionState.resumePending}
                    clearPending={actionState.clearPending}
                  />
                </GlassCard>
              )}
              {selectedSection === "import" && (
                <>
                  <EnhancedCard variant="glass" className="mb-8">
                    <DataImportSection
                      onFileSelect={handleFileSelect}
                      isUploading={importState.isUploading}
                      isAnalyzing={importState.isAnalyzing}
                      analyzeError={importState.analyzeError}
                      importError={importState.importError}
                    />
                  </EnhancedCard>
                  {importState.showPreview && importState.previewData && (
                    <ImportPreviewDialog
                      isOpen={importState.showPreview}
                      onClose={handleImportClose}
                      onConfirm={handleImportConfirm}
                      changes={importState.previewData.changes}
                      isLoading={importState.isUploading}
                    />
                  )}
                </>
              )}
              {selectedSection === "logs" && (
                <EnhancedCard variant="glass" className="mb-8">
                  <CalculationLogs
                    logs={calculationLogs}
                    isLoading={logsLoading}
                    error={logsError?.message}
                  />
                </EnhancedCard>
              )}
              {selectedSection === "country-admin" && (
                <EnhancedCard variant="glass" className="mb-8">
                  {/* CountryAdminPanel will be implemented here */}
                  <CountryAdminPanel />
                </EnhancedCard>
              )}
              {selectedSection === "sdi" && (
                <EnhancedCard variant="glass" className="mb-8">
                  <SdiAdminPanel />
                </EnhancedCard>
              )}
              {selectedSection === "notifications" && (
                <EnhancedCard variant="glass" className="mb-8">
                  <NotificationsAdmin />
                </EnhancedCard>
              )}
              {selectedSection === "user-management" && (
                <EnhancedCard variant="glass" className="mb-8">
                  <UserManagement />
                </EnhancedCard>
              )}
            </div>
          </main>
        </div>
      </AdminErrorBoundary>
    </>
  );
}