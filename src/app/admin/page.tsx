// src/app/admin/page.tsx
// Refactored admin page with extracted hooks and components

"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import {
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
  AdminSidebar,
} from "./_components";
import { NavigationSettings } from "./_components/NavigationSettings";
import { SystemOverview } from "./_components/SystemOverview";
import { CalculationEditor } from "./_components/CalculationEditor";
import { StorytellerControlPanel } from "./_components/StorytellerControlPanel";
import { IxTimeVisualizer } from "./_components/IxTimeVisualizer";
import { GlassCard, EnhancedCard } from "~/components/ui/enhanced-card";
import { FlagCacheManager } from "~/components/FlagCacheManager";
import { RealTimeClock } from "~/components/ui/real-time-clock";
import { api } from "~/trpc/react";
import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { SignInButton, useUser, UserButton } from "~/context/auth-context";
import {
  Settings,
  Clock,
  TrendingUp,
  Bot,
  Database,
  Upload,
  Monitor,
  Code,
  Gamepad2,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { useAdminState } from "./_hooks/useAdminState";
import { useAdminHandlers } from "./_hooks/useAdminHandlers";
import { useBotSync } from "./_hooks/useBotSync";

import { SYSTEM_OWNER_IDS, isSystemOwner } from "~/lib/system-owner-constants";

export default function AdminPage() {
  // All hooks must be called unconditionally and at the top
  usePageTitle({ title: "Admin" });

  const { user, isLoaded } = useUser();

  // State management from extracted hooks
  const {
    config,
    setConfig,
    timeState,
    setTimeState,
    importState,
    setImportState,
    actionState,
    setActionState,
    selectedSection,
    setSelectedSection,
    collapsedCards,
    setCollapsedCards,
  } = useAdminState();

  const toggleCardCollapse = useCallback(
    (cardId: string) => {
      setCollapsedCards((prev) => ({
        ...prev,
        [cardId]: !prev[cardId],
      }));
    },
    [setCollapsedCards]
  );

  // TRPC Queries - all called unconditionally
  const {
    data: systemStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: false,
  });
  const {
    data: botStatus,
    isLoading: botStatusLoading,
    refetch: refetchBotStatus,
  } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000, // Refresh every 15 seconds
    refetchOnWindowFocus: false,
  });
  const {
    data: configData,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = api.admin.getConfig.useQuery();
  const {
    data: calculationLogs,
    isLoading: logsLoading,
    error: logsError,
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
        globalGrowthFactor: configData.globalGrowthFactor || 1.0,
        autoUpdate: configData.autoUpdate ?? true,
        botSyncEnabled: configData.botSyncEnabled ?? true,
        timeMultiplier: configData.timeMultiplier || 2.0,
      });
    }
  }, [configData, setConfig]);

  // Bot sync from extracted hook
  useBotSync({
    botStatus,
    timeMultiplier: config.timeMultiplier,
    botSyncEnabled: config.botSyncEnabled,
    autoSyncPending: actionState.autoSyncPending,
    setActionState,
    setTimeMultiplier: (value) => setConfig((prev) => ({ ...prev, timeMultiplier: value })),
    refetchStatus,
    refetchBotStatus,
  });

  // Handlers from extracted hook
  const {
    handleSaveConfig,
    handleForceCalculation,
    handleSetCustomTime,
    handleResetToRealTime,
    handleTimeMultiplierChange,
    handleSyncEpoch,
    handleSyncBot,
    handleSyncFromBot,
    handlePauseBot,
    handleResumeBot,
    handleClearOverrides,
    handleFileSelect,
    handleImportConfirm,
    handleImportClose,
    handleRefreshStatus,
  } = useAdminHandlers({
    config,
    timeState,
    importState,
    setActionState,
    setConfig,
    setImportState,
    saveConfigMutation,
    forceCalculationMutation,
    setCustomTimeMutation,
    analyzeImportMutation,
    importDataMutation,
    syncEpochMutation,
    syncBotMutation,
    pauseBotMutation,
    resumeBotMutation,
    clearBotOverridesMutation,
    refetchConfig,
    refetchStatus,
    refetchBotStatus,
  });

  // Early returns after all hooks are called
  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole =
    typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            You do not have permission to view this page.
          </p>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminErrorBoundary>
        <div className="bg-background text-foreground flex min-h-screen">
          {/* Admin Sidebar - extracted component */}
          <AdminSidebar selectedSection={selectedSection} onSectionChange={setSelectedSection} />
          <main className="min-h-screen flex-1 px-2 py-6 md:px-8">
            <div className="mx-auto max-w-[1400px]">
              {selectedSection === "overview" && (
                <>
                  <div className="space-y-8">
                    {/* Enhanced Header Section */}
                    <div className="glass-card-parent border-primary/20 from-primary/5 to-primary/10 rounded-xl border-2 bg-gradient-to-br via-transparent p-6">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        {/* Left: Title and description */}
                        <div className="flex-1">
                          <div className="mb-3 flex items-center gap-4">
                            <div className="bg-primary/10 border-primary/20 rounded-xl border p-3">
                              <Settings className="text-primary h-8 w-8" />
                            </div>
                            <div>
                              <h1 className="text-foreground text-3xl font-bold md:text-4xl">
                                System Administration
                              </h1>
                              <p className="text-primary/80 text-lg font-medium">
                                Administrative System Control
                              </p>
                            </div>
                          </div>
                          <p className="text-muted-foreground max-w-2xl text-base md:text-lg">
                            Comprehensive administrative control over all systems including
                            calculations, time management, economic modifiers, and real-time
                            monitoring.
                          </p>
                          {/* Real-time status indicators */}
                          <div className="mt-4 flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5">
                              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                System Online
                              </span>
                            </div>
                            <RealTimeClock className="bg-card/80 border-border rounded-full px-4 py-1.5 backdrop-blur-sm" />
                          </div>

                          {/* Quick Actions - moved from below */}
                          <div className="mt-6">
                            <h4 className="text-foreground mb-3 text-sm font-semibold">
                              Quick Actions
                            </h4>
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              {[
                                {
                                  icon: Monitor,
                                  label: "System Monitor",
                                  section: "system",
                                  color: "indigo",
                                },
                                {
                                  icon: Code,
                                  label: "Formula Editor",
                                  section: "formulas",
                                  color: "emerald",
                                },
                                {
                                  icon: Gamepad2,
                                  label: "Storyteller",
                                  section: "storyteller",
                                  color: "purple",
                                },
                                {
                                  icon: Upload,
                                  label: "Data Import",
                                  section: "import",
                                  color: "rose",
                                },
                              ].map((item) => (
                                <button
                                  key={item.section}
                                  onClick={() => setSelectedSection(item.section)}
                                  className="glass-card-child group border-primary/20 bg-primary/5 hover:bg-primary/10 rounded-xl border-2 bg-gradient-to-br p-3 text-left transition-all duration-200 hover:scale-105"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="bg-primary/10 border-primary/20 group-hover:bg-primary/20 rounded-lg border p-1.5 transition-colors">
                                      <item.icon className="text-primary h-4 w-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-foreground group-hover:text-primary text-sm font-medium transition-colors">
                                        {item.label}
                                      </h5>
                                      <p className="text-muted-foreground text-xs">Quick access</p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Right: Enhanced status dashboard */}
                        <div className="flex min-w-[320px] flex-col gap-4">
                          {/* Key metrics grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card-child rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-4">
                              <div className="mb-2 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-medium tracking-wider text-blue-700 uppercase dark:text-blue-300">
                                  IxTime
                                </span>
                              </div>
                              {statusLoading ? (
                                <Skeleton className="h-6 w-full" />
                              ) : (
                                <div className="text-foreground text-sm font-bold">
                                  {systemStatus?.ixTime?.formattedIxTime || "N/A"}
                                </div>
                              )}
                            </div>
                            <div className="glass-card-child rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
                              <div className="mb-2 flex items-center gap-2">
                                <Bot className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium tracking-wider text-green-700 uppercase dark:text-green-300">
                                  Bot
                                </span>
                              </div>
                              {botStatusLoading ? (
                                <Skeleton className="h-6 w-full" />
                              ) : (
                                <div
                                  className={`text-sm font-bold ${botStatus?.botHealth?.available ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                                >
                                  {botStatus?.botHealth?.available ? "Connected" : "Disconnected"}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="glass-card-child rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-purple-600/5 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-indigo-500" />
                                <span className="text-xs font-medium tracking-wider text-indigo-700 uppercase dark:text-indigo-300">
                                  Growth Factor
                                </span>
                              </div>
                              {configLoading ? (
                                <Skeleton className="h-8 w-16" />
                              ) : (
                                <div className="text-foreground text-lg font-bold">
                                  +{((config.globalGrowthFactor - 1) * 100).toFixed(1)}%
                                </div>
                              )}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                              <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                              <span>Economic multiplier active</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced control panels grid */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
                              onCustomDateChange={(value) =>
                                setTimeState((prev) => ({ ...prev, customDate: value }))
                              }
                              onCustomTimeChange={(value) =>
                                setTimeState((prev) => ({ ...prev, customTime: value }))
                              }
                              onSetCustomTime={handleSetCustomTime}
                              onResetToRealTime={handleResetToRealTime}
                              onSyncEpoch={handleSyncEpoch}
                              onSyncFromBot={handleSyncFromBot}
                              setTimePending={actionState.setTimePending}
                              syncEpochPending={actionState.syncEpochPending}
                              autoSyncPending={actionState.autoSyncPending}
                              lastBotSync={actionState.lastBotSync}
                            />
                          ),
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
                          ),
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
                              <div className="glass-card-child rounded-lg border border-purple-500/10 p-4">
                                <h4 className="text-foreground mb-2 flex items-center gap-2 text-sm font-semibold">
                                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                  Performance Monitor
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cache Hit Rate:</span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      94.2%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Memory Usage:</span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      67MB
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ),
                        },
                      ].map((card) => {
                        const isCollapsed = collapsedCards[card.id];
                        const colorClasses = {
                          blue: "border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/5",
                          green:
                            "border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-600/5",
                          purple:
                            "border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-purple-600/5",
                        };
                        const iconColorClasses = {
                          blue: "bg-blue-500/10 border-blue-500/20 text-blue-500",
                          green: "bg-green-500/10 border-green-500/20 text-green-500",
                          purple: "bg-purple-500/10 border-purple-500/20 text-purple-500",
                        };
                        const descColorClasses = {
                          blue: "text-blue-700/70 dark:text-blue-300/70",
                          green: "text-green-700/70 dark:text-green-300/70",
                          purple: "text-purple-700/70 dark:text-purple-300/70",
                        };

                        return (
                          <div
                            key={card.id}
                            className={`glass-card-parent rounded-xl border-2 transition-all duration-300 ${colorClasses[card.color as keyof typeof colorClasses]} ${
                              isCollapsed ? "min-h-[120px]" : "min-h-[400px]"
                            }`}
                          >
                            {/* Header - always visible */}
                            <div className={`p-6 ${isCollapsed ? "pb-6" : "pb-4"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`rounded-lg border p-2 ${iconColorClasses[card.color as keyof typeof iconColorClasses]}`}
                                  >
                                    <card.icon className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h3 className="text-foreground text-lg font-bold">
                                      {card.title}
                                    </h3>
                                    {!isCollapsed && (
                                      <p
                                        className={`text-sm ${descColorClasses[card.color as keyof typeof descColorClasses]}`}
                                      >
                                        {card.description}
                                      </p>
                                    )}
                                    {isCollapsed && (
                                      <p className="text-muted-foreground text-xs">
                                        Click to expand
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCardCollapse(card.id)}
                                  className="h-8 w-8 flex-shrink-0 p-0 hover:bg-white/10"
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
                    onCustomDateChange={(value) =>
                      setTimeState((prev) => ({ ...prev, customDate: value }))
                    }
                    onCustomTimeChange={(value) =>
                      setTimeState((prev) => ({ ...prev, customTime: value }))
                    }
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
                      onGlobalGrowthFactorChange={(value) =>
                        setConfig((prev) => ({ ...prev, globalGrowthFactor: value }))
                      }
                      onAutoUpdateChange={(value) =>
                        setConfig((prev) => ({ ...prev, autoUpdate: value }))
                      }
                      onBotSyncEnabledChange={(value) =>
                        setConfig((prev) => ({ ...prev, botSyncEnabled: value }))
                      }
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
