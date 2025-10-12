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
  CountryAdminPanel,
  NotificationsAdmin,
  UserManagement,
} from "./_components";
import { NavigationSettings } from "./_components/NavigationSettings";
import { AdminDashboardSafe } from "./_components/AdminDashboardSafe";
// Complex components loaded on-demand to prevent API errors
import { SystemOverview } from "./_components/SystemOverview";
import { CalculationEditor } from "./_components/CalculationEditor";
import { StorytellerControlPanel } from "./_components/StorytellerControlPanel";
import { IxTimeVisualizer } from "./_components/IxTimeVisualizer";
import { GlassCard, EnhancedCard } from "~/components/ui/enhanced-card";
import { withBasePath } from "~/lib/base-path";
import { BentoGrid } from "~/components/ui/bento-grid";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { TrendIndicator } from "~/components/ui/trend-indicator";
import { HealthRing } from "~/components/ui/health-ring";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { FlagTestComponent } from "~/components/FlagTestComponent";
import { RealTimeClock } from "~/components/ui/real-time-clock";
import { api } from "~/trpc/react";
import { AdminFavoriteButton } from "~/components/admin/AdminFavoriteButton";
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
import { Settings, Clock, TrendingUp, Bot, Database, Upload, List, Shield, Users, Bell, Monitor, Code, Gamepad2, Minimize2, Maximize2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    temporal: false,
    discord: false,
    cache: false
  });

  const toggleCardCollapse = useCallback((cardId: string) => {
    setCollapsedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  }, []);

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
      fetch(withBasePath('/api/ixtime/sync-from-bot'), { method: 'POST' })
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
        const naturalResponse = await fetch(withBasePath('/api/ixtime/set-natural'), {
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
          const syncResponse = await fetch(withBasePath('/api/ixtime/sync-bot'), { method: 'POST' });
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
      const response = await fetch(withBasePath('/api/ixtime/sync-from-bot'), { method: 'POST' });
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
          {/* Modern Admin Sidebar */}
          <div className="w-72 min-h-screen bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Admin Console</h1>
                  <p className="text-sm text-muted-foreground">System Management</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-4">
              <nav className="space-y-6">
                {/* Overview */}
                <div>
                  <button
                    onClick={() => setSelectedSection("overview")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                      selectedSection === "overview"
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Dashboard</span>
                  </button>
                </div>

                {/* Main Functions */}
                <div>
                  <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Core Functions
                  </h3>
                  <div className="space-y-1">
                    {[
                      { value: "system", icon: <Monitor className="h-5 w-5" />, label: "System Monitor" },
                      { value: "formulas", icon: <Code className="h-5 w-5" />, label: "Formula Editor" },
                      { value: "storyteller", icon: <Gamepad2 className="h-5 w-5" />, label: "Storyteller (God Mode)" },
                      { value: "time", icon: <Clock className="h-5 w-5" />, label: "Time Controls" },
                      { value: "navigation", icon: <Settings className="h-5 w-5" />, label: "Navigation Settings" }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setSelectedSection(item.value)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                          selectedSection === item.value
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data & Integration */}
                <div>
                  <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Data & Integration
                  </h3>
                  <div className="space-y-1">
                    {[
                      { value: "bot", icon: <Bot className="h-5 w-5" />, label: "Discord Bot" },
                      { value: "import", icon: <Upload className="h-5 w-5" />, label: "Data Import" },
                      { value: "ixtime-visualizer", icon: <BarChart3 className="h-5 w-5" />, label: "IxTime Visualizer" }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setSelectedSection(item.value)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                          selectedSection === item.value
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* User Management */}
                <div>
                  <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    User Management
                  </h3>
                  <div className="space-y-1">
                    {[
                      { value: "user-management", icon: <Users className="h-5 w-5" />, label: "Users & Roles" },
                      { value: "country-admin", icon: <UsersIcon className="h-5 w-5" />, label: "Country Admin" },
                      { value: "notifications", icon: <Bell className="h-5 w-5" />, label: "Notifications" }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setSelectedSection(item.value)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                          selectedSection === item.value
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Monitoring */}
                <div>
                  <h3 className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Monitoring
                  </h3>
                  <div className="space-y-1">
                    {[
                      { value: "logs", icon: <List className="h-5 w-5" />, label: "System Logs" },
                      { value: "economic", icon: <TrendingUp className="h-5 w-5" />, label: "Economic Monitor" }
                    ].map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setSelectedSection(item.value)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                          selectedSection === item.value
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </nav>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>System Online</span>
              </div>
            </div>
          </div>
          <main className="flex-1 min-h-screen px-2 md:px-8 py-6">
            <div className="max-w-[1400px] mx-auto">
              {selectedSection === "overview" && (
                <>
                <div className="space-y-8">
                  {/* Enhanced Header Section */}
                  <div className="glass-card-parent p-6 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                      {/* Left: Title and description */}
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                            <Settings className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                              System Administration
                            </h1>
                            <p className="text-lg text-primary/80 font-medium">Administrative System Control</p>
                          </div>
                        </div>
                        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
                          Comprehensive administrative control over all systems including calculations, 
                          time management, economic modifiers, and real-time monitoring.
                        </p>
                        {/* Real-time status indicators */}
                        <div className="flex flex-wrap gap-3 mt-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-sm text-green-700 dark:text-green-300 font-medium">System Online</span>
                          </div>
                          <RealTimeClock className="bg-card/80 backdrop-blur-sm border-border rounded-full px-4 py-1.5" />
                        </div>

                        {/* Quick Actions - moved from below */}
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                              { icon: Monitor, label: "System Monitor", section: "system", color: "indigo" },
                              { icon: Code, label: "Formula Editor", section: "formulas", color: "emerald" },
                              { icon: Gamepad2, label: "Storyteller", section: "storyteller", color: "purple" },
                              { icon: Upload, label: "Data Import", section: "import", color: "rose" }
                            ].map((item) => (
                              <button
                                key={item.section}
                                onClick={() => setSelectedSection(item.section)}
                                className="glass-card-child p-3 rounded-xl border-2 bg-gradient-to-br transition-all duration-200 hover:scale-105 group border-primary/20 bg-primary/5 hover:bg-primary/10 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                    <item.icon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm">{item.label}</h5>
                                    <p className="text-xs text-muted-foreground">Quick access</p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {/* Right: Enhanced status dashboard */}
                      <div className="flex flex-col gap-4 min-w-[320px]">
                        {/* Key metrics grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="glass-card-child p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-4 w-4 text-blue-500" />
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">IxTime</span>
                            </div>
                            {statusLoading ? (
                              <Skeleton className="h-6 w-full" />
                            ) : (
                              <div className="text-sm font-bold text-foreground">
                                {systemStatus?.ixTime?.formattedIxTime || "N/A"}
                              </div>
                            )}
                          </div>
                          <div className="glass-card-child p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Bot className="h-4 w-4 text-green-500" />
                              <span className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">Bot</span>
                            </div>
                            {botStatusLoading ? (
                              <Skeleton className="h-6 w-full" />
                            ) : (
                              <div className={`text-sm font-bold ${botStatus?.botHealth?.available ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {botStatus?.botHealth?.available ? 'Connected' : 'Disconnected'}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="glass-card-child p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-600/5 border border-indigo-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-indigo-500" />
                              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Growth Factor</span>
                            </div>
                            {configLoading ? (
                              <Skeleton className="h-8 w-16" />
                            ) : (
                              <div className="text-lg font-bold text-foreground">
                                +{((config.globalGrowthFactor - 1) * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span>Economic multiplier active</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced control panels grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[
                      {
                        id: "temporal",
                        title: "Temporal Controls",
                        description: "IxTime management & synchronization",
                        icon: Clock,
                        color: "blue",
                        content: (
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
                        )
                      },
                      {
                        id: "discord",
                        title: "Discord Integration",
                        description: "Bot controls & synchronization",
                        icon: Bot,
                        color: "green",
                        content: (
                          <BotControlPanel
                            botStatus={botStatus}
                            onPauseBot={handlePauseBot}
                            onResumeBot={handleResumeBot}
                            onClearOverrides={handleClearOverrides}
                            pausePending={actionState.pausePending}
                            resumePending={actionState.resumePending}
                            clearPending={actionState.clearPending}
                          />
                        )
                      },
                      {
                        id: "cache",
                        title: "System Cache",
                        description: "Resource management & optimization",
                        icon: Database,
                        color: "purple",
                        content: (
                          <div className="space-y-4">
                            <FlagCacheManager />
                            <div className="glass-card-child p-4 rounded-lg border border-purple-500/10">
                              <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                Performance Monitor
                              </h4>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Cache Hit Rate:</span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">94.2%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Memory Usage:</span>
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">67MB</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      }
                    ].map((card) => {
                      const isCollapsed = collapsedCards[card.id];
                      const colorClasses = {
                        blue: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/5",
                        green: "border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/5",
                        purple: "border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-600/5"
                      };
                      const iconColorClasses = {
                        blue: "bg-blue-500/10 border-blue-500/20 text-blue-500",
                        green: "bg-green-500/10 border-green-500/20 text-green-500", 
                        purple: "bg-purple-500/10 border-purple-500/20 text-purple-500"
                      };
                      const descColorClasses = {
                        blue: "text-blue-700/70 dark:text-blue-300/70",
                        green: "text-green-700/70 dark:text-green-300/70",
                        purple: "text-purple-700/70 dark:text-purple-300/70"
                      };

                      return (
                        <div 
                          key={card.id}
                          className={`glass-card-parent rounded-xl border-2 transition-all duration-300 ${colorClasses[card.color as keyof typeof colorClasses]} ${
                            isCollapsed ? 'min-h-[120px]' : 'min-h-[400px]'
                          }`}
                        >
                          {/* Header - always visible */}
                          <div className={`p-6 ${isCollapsed ? 'pb-6' : 'pb-4'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg border ${iconColorClasses[card.color as keyof typeof iconColorClasses]}`}>
                                  <card.icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-foreground">{card.title}</h3>
                                  {!isCollapsed && (
                                    <p className={`text-sm ${descColorClasses[card.color as keyof typeof descColorClasses]}`}>
                                      {card.description}
                                    </p>
                                  )}
                                  {isCollapsed && (
                                    <p className="text-xs text-muted-foreground">Click to expand</p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCardCollapse(card.id)}
                                className="hover:bg-white/10 h-8 w-8 p-0 flex-shrink-0"
                              >
                                {isCollapsed ? (
                                  <Maximize2 className="h-4 w-4" />
                                ) : (
                                  <Minimize2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Content - collapsible */}
                          {!isCollapsed && (
                            <div className="px-6 pb-6 transition-all duration-300 ease-in-out">
                              {card.content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {systemStatus && <WarningPanel systemStatus={systemStatus} />}
                </div>
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
              {selectedSection === "system" && (
                <div className="mb-8">
                  <SystemOverview />
                </div>
              )}
              {selectedSection === "formulas" && (
                <div className="mb-8">
                  <CalculationEditor />
                </div>
              )}
              {selectedSection === "storyteller" && (
                <div className="mb-8">
                  <StorytellerControlPanel />
                </div>
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
              {selectedSection === "navigation" && (
                <div className="mb-8">
                  <NavigationSettings />
                </div>
              )}
            </div>
          </main>
        </div>
      </AdminErrorBoundary>
    </>
  );
}