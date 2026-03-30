import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { DynamicContainer } from "../ui/dynamic-island";
import { Button } from "../ui/button";

import { useToastQueueStore } from "~/stores/toastQueueStore";
import {
  Clock,
  Calendar,
  Search,
  Bell,
  Settings,
  Crown,
  Target,
  User,
  BarChart3,
  Users,
  Activity,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency } from "~/lib/chart-utils";
import { useUser } from "~/context/auth-context";
import { useIxTime } from "~/contexts/IxTimeContext";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useGlobalNotificationBridge } from "~/services/GlobalNotificationBridge";
import { usePermissions } from "~/hooks/usePermissions";
import { withBasePath } from "~/lib/base-path";
import type { CompactViewProps } from "./types";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { BookOpen } from "lucide-react";
import { HealthRing } from "../ui/health-ring";
import { getNationUrl } from "~/lib/slug-utils";
import { debugLog } from "~/lib/console-utils";
import { CrisisIndicator } from "./CrisisIndicator";

// Helper functions
const getGreeting = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hour = date.getUTCHours();

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getTimeDisplay = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

function CompactViewComponent({
  isSticky,
  isCollapsed,
  setIsCollapsed,
  setIsUserInteracting,
  timeDisplayMode,
  setTimeDisplayMode,
  onSwitchMode,
  isOnWikiPage,
  crisisEvents,
}: CompactViewProps) {
  const { user, isLoaded } = useUser();
  const { articleTitle, activeSectionId, tocEntries } = useWikiContext();

  // Get user role information
  const { user: roleUser, permissions } = usePermissions();

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Fetch activity rings data for user's country - use the working endpoint!
  const { data: activityRingsData, isLoading: ringsLoading } =
    api.countries.getActivityRingsData.useQuery(
      { countryId: userProfile?.countryId ?? "" },
      { enabled: !!userProfile?.countryId }
    );

  // Debug logging - only in development
  React.useEffect(() => {
    if (activityRingsData) {
      debugLog("CompactView", "Activity Rings Data:", {
        economicVitality: activityRingsData.economicVitality,
        populationWellbeing: activityRingsData.populationWellbeing,
        diplomaticStanding: activityRingsData.diplomaticStanding,
        governmentalEfficiency: activityRingsData.governmentalEfficiency,
      });
    }
  }, [activityRingsData]);
  const { ixTimeTimestamp } = useIxTime();
  const activeSectionName = activeSectionId
    ? tocEntries.find((e) => e.id === activeSectionId)?.text ?? null
    : null;
  const [mounted, setMounted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const previousNotificationCountRef = useRef(0);

  // Current time state
  const [currentTime, setCurrentTime] = useState({
    greeting: "Good morning",
    timeDisplay: "",
  });

  // Economic metric display state - cycles between population, gdpPerCapita, totalGdp
  const [economicMetric, setEconomicMetric] = useState<"population" | "gdpPerCapita" | "totalGdp">(
    "gdpPerCapita"
  );

  // Cycle through economic metrics
  const cycleEconomicMetric = () => {
    setEconomicMetric((current) => {
      if (current === "population") return "gdpPerCapita";
      if (current === "gdpPerCapita") return "totalGdp";
      return "population";
    });
  };

  // Get current economic metric display
  const getEconomicMetricDisplay = () => {
    if (!userProfile?.country) return { label: "GDP/Capita", value: "$0" };

    const country = userProfile.country;
    switch (economicMetric) {
      case "population":
        const pop = country.currentPopulation || 0;
        return {
          label: "Population",
          value: pop >= 1000000 ? `${(pop / 1000000).toFixed(1)}M` : `${(pop / 1000).toFixed(1)}K`,
        };
      case "totalGdp":
        const gdp = country.currentTotalGdp || 0;
        return {
          label: "Total GDP",
          value:
            gdp >= 1000000000000
              ? `$${(gdp / 1000000000000).toFixed(1)}T`
              : gdp >= 1000000000
                ? `$${(gdp / 1000000000).toFixed(1)}B`
                : formatCurrency(gdp),
        };
      case "gdpPerCapita":
      default:
        return {
          label: "GDP/Capita",
          value: formatCurrency(country.currentGdpPerCapita || 0),
        };
    }
  };

  // ─── Notification Peek: briefly show toast title in the DI pill ───
  const [peekText, setPeekText] = useState<string | null>(null);
  const toastQueue = useToastQueueStore((s) => s.queue);
  const lastSeenToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (toastQueue.length === 0) return;
    const latest = toastQueue[0];
    if (!latest || latest.id === lastSeenToastRef.current) return;
    // Only peek for medium+ priority
    if (latest.priority === "low") {
      lastSeenToastRef.current = latest.id;
      return;
    }
    lastSeenToastRef.current = latest.id;
    setPeekText(latest.title);
    const timer = setTimeout(() => setPeekText(null), 2500);
    return () => clearTimeout(timer);
  }, [toastQueue]);

  // Enhanced notification system integration
  const enhancedStats = useNotificationStore((state) => state.stats);
  const notifications = useNotificationStore((state) => state.notifications);
  const { getStats } = useGlobalNotificationBridge();

  // Get executive notifications context
  const { unreadCount: executiveUnreadCount, isExecutiveMode } = useExecutiveNotifications();

  // Get bridge statistics
  const bridgeStats = getStats();

  // Standard notifications count
  const { data: notificationsData } = api.notifications.getUserNotifications.useQuery(
    {
      limit: 5,
      unreadOnly: false,
    },
    {
      enabled: !!user?.id,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const liveNotificationCount = notifications.filter(
    (n) => n.status !== "read" && n.status !== "dismissed"
  ).length;
  const totalUnreadCount =
    unreadNotifications +
    (isExecutiveMode ? executiveUnreadCount : 0) +
    enhancedUnreadCount +
    liveNotificationCount;

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return "loading";
    if (!user) return "unauthenticated";
    if (!userProfile?.countryId) return "needs-setup";
    return "complete";
  };
  const setupStatus = getSetupStatus();

  // Time updates
  useEffect(() => {
    const greeting = getGreeting(ixTimeTimestamp);
    const timeDisplay = getTimeDisplay(ixTimeTimestamp);

    setCurrentTime((prev) => {
      if (prev.timeDisplay !== timeDisplay) {
        return { greeting, timeDisplay };
      }
      return prev;
    });
  }, [ixTimeTimestamp]);

  useEffect(() => {
    setMounted(true);
    debugLog("CompactView", "Mounted with isSticky:", isSticky, "isCollapsed:", isCollapsed);
    // Initialize previous count
    previousNotificationCountRef.current = totalUnreadCount;
  }, []);

  // Flash animation when new notifications arrive
  useEffect(() => {
    if (mounted && totalUnreadCount > previousNotificationCountRef.current) {
      debugLog("CompactView", "New notification detected! Flashing dynamic island");
      setIsFlashing(true);

      // Stop flashing after animation completes
      const timeout = setTimeout(() => {
        setIsFlashing(false);
      }, 1000); // 1 second flash duration

      // Update the previous count
      previousNotificationCountRef.current = totalUnreadCount;

      return () => clearTimeout(timeout);
    } else if (mounted) {
      // Update count without flashing if count decreased (notifications dismissed)
      previousNotificationCountRef.current = totalUnreadCount;
    }
  }, [totalUnreadCount, mounted]);

  // Debug sticky state changes - only in development
  useEffect(() => {
    debugLog("CompactView", "State change - isSticky:", isSticky, "isCollapsed:", isCollapsed);
  }, [isSticky, isCollapsed]);

  // No scroll-based scaling - just transition between two states
  const sizeScale = 1;

  if (!mounted) return null;

  return (
    <TooltipProvider>
      <div
        onMouseEnter={() => {
          if (isSticky) {
            setIsCollapsed(false);
            setIsUserInteracting(true);
          }
        }}
        onMouseLeave={() => {
          if (isSticky) {
            setIsUserInteracting(false);
          }
        }}
      >
        <div
          className="h-full w-full"
          style={{
            transform: `scale(${sizeScale})`,
            transformOrigin: "center",
          }}
        >
          <DynamicContainer
            className={`flex w-full items-center justify-between transition-all duration-300 ${
              isSticky ? "px-3 py-1.5" : "px-4 py-2"
            } ${isFlashing ? "animate-flash-notification" : ""}`}
          >
            {/* IX Logo - Home Button */}
            <div className="flex items-center justify-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => (window.location.href = createAbsoluteUrl("/"))}
                    className={`group relative flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${
                      isSticky ? "h-6 w-6" : "h-7 w-7"
                    }`}
                  >
                    {/* Gradient glow animation - only on hover */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/30 to-blue-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/10 via-indigo-500/20 to-purple-400/10 opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-100" />

                    <img
                      src={withBasePath("/images/ix-logo.svg")}
                      alt="IxLogo"
                      className={`relative z-10 ${isSticky ? "h-4 w-4" : "h-5 w-5"} opacity-80 brightness-100 filter transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:drop-shadow-lg dark:brightness-0 dark:invert`}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Home</TooltipContent>
              </Tooltip>
            </div>

            {/* Time Display / Notification Peek - horizontal layout */}
            <div className="flex flex-1 items-center justify-center overflow-hidden">
              {/* Sticky mode: peek text OR wiki context */}
              {isSticky && peekText && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="sticky-peek"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex items-center gap-1.5 px-2 py-0.5"
                  >
                    <Bell className="h-3 w-3 text-blue-400 animate-pulse" />
                    <span className="text-foreground/90 text-[11px] font-medium truncate max-w-[160px]">
                      {peekText}
                    </span>
                  </motion.div>
                </AnimatePresence>
              )}
              {isSticky && !peekText && isOnWikiPage && articleTitle && (
                <button
                  onClick={() => onSwitchMode("wiki")}
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 cursor-pointer max-w-[160px]"
                  title="Open wiki mode"
                >
                  <BookOpen className="h-2.5 w-2.5 text-blue-400 opacity-70 flex-shrink-0" />
                  <span className="text-foreground/80 text-[10px] font-medium truncate">
                    {articleTitle}
                  </span>
                  {activeSectionName && (
                    <>
                      <span className="text-foreground/25 text-[9px]">›</span>
                      <span className="text-foreground/50 text-[9px] truncate max-w-[60px]">
                        {activeSectionName}
                      </span>
                    </>
                  )}
                </button>
              )}
              {!isSticky && (
                <AnimatePresence mode="wait">
                  {peekText ? (
                    <motion.div
                      key="peek"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="flex items-center gap-1.5 px-2 py-1"
                    >
                      <Bell className="h-3 w-3 text-blue-400 animate-pulse" />
                      <span className="text-foreground/90 text-xs font-medium truncate max-w-[200px]">
                        {peekText}
                      </span>
                    </motion.div>
                  ) : (
                <motion.div
                  key="time"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex items-center gap-2"
                >
                  {/* Time Display - cycles through modes */}
                  <button
                    onClick={() => {
                      const currentMode = timeDisplayMode;
                      setTimeDisplayMode(
                        currentMode === "time" ? "date" : currentMode === "date" ? "both" : "time"
                      );
                    }}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 cursor-pointer rounded-md transition-colors"
                  >
                    {timeDisplayMode === "time" && (
                      <>
                        <Clock className="h-3 w-3 text-blue-400 opacity-70" />
                        <span className="text-foreground/80 text-xs leading-none font-medium">
                          {currentTime.timeDisplay}
                        </span>
                      </>
                    )}
                    {timeDisplayMode === "date" && (
                      <>
                        <Calendar className="h-3 w-3 text-blue-400 opacity-70" />
                        <span className="text-foreground/80 text-xs leading-none font-medium">
                          {new Date(ixTimeTimestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </>
                    )}
                    {timeDisplayMode === "both" && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-blue-400 opacity-70" />
                        <span className="text-foreground/80 text-xs leading-none font-medium">
                          {currentTime.timeDisplay}
                        </span>
                        <span className="text-foreground/30 text-xs">·</span>
                        <span className="text-foreground/70 text-[10px] leading-none">
                          {new Date(ixTimeTimestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Greeting — shows wiki context when on a wiki page */}
                  {isOnWikiPage && articleTitle ? (
                    <button
                      onClick={() => onSwitchMode("wiki")}
                      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 cursor-pointer max-w-[180px]"
                      title="Open wiki mode (Tab)"
                    >
                      <BookOpen className="h-3 w-3 text-blue-400 opacity-70 flex-shrink-0" />
                      <span className="text-foreground/80 text-xs font-medium truncate">
                        {articleTitle}
                      </span>
                      {activeSectionName && (
                        <>
                          <span className="text-foreground/25 text-[10px]">›</span>
                          <span className="text-foreground/50 text-[10px] truncate max-w-[80px]">
                            {activeSectionName}
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                  <Popover>
                    <PopoverTrigger>
                      <span className="text-foreground/70 text-xs font-medium hover:text-foreground/90 cursor-pointer px-1.5 py-0.5 rounded transition-colors hover:bg-white/10 whitespace-nowrap">
                        {currentTime.greeting}
                        {user?.firstName ? `, ${user.firstName}` : ""}
                      </span>
                    </PopoverTrigger>
                    <PopoverContent
                        side="bottom"
                        align="center"
                        className="bg-card/95 border-border z-[10002] mt-2 w-96 rounded-xl p-4 shadow-2xl backdrop-blur-xl"
                        sideOffset={8}
                      >
                        {setupStatus === "complete" && userProfile?.country ? (
                          <div className="space-y-6">
                            {/* Header with flag and country info */}
                            <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/15 p-4 dark:border-amber-200/20 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-yellow-500/10">
                              <div className="absolute inset-0 opacity-40 dark:opacity-30">
                                <SimpleFlag
                                  countryName={userProfile.country.name}
                                  className="h-full w-full scale-110 object-cover blur-sm"
                                  showPlaceholder={false}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 dark:from-black/40 dark:via-transparent dark:to-black/40" />
                              </div>
                              <div className="relative z-10 flex items-center gap-3">
                                <div className="rounded-xl border border-amber-400/50 bg-amber-500/30 p-2 backdrop-blur-sm dark:border-amber-300/30 dark:bg-amber-500/20">
                                  <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                  <div className="font-bold text-white drop-shadow-lg">
                                    {" "}
                                    MyCountry Premium
                                  </div>
                                  <div className="text-sm font-medium text-amber-200 dark:text-amber-100">
                                    {userProfile.country.name}
                                  </div>
                                </div>
                                <button
                                  onClick={cycleEconomicMetric}
                                  className="group ml-auto cursor-pointer rounded-lg px-3 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
                                  title="Click to cycle: Population → GDP/Capita → Total GDP"
                                >
                                  <div className="text-xs text-amber-300 opacity-90 transition-opacity group-hover:opacity-100 dark:text-amber-200 dark:opacity-80">
                                    {getEconomicMetricDisplay().label}
                                  </div>
                                  <div className="font-bold text-amber-200 transition-colors group-hover:text-amber-100 dark:text-amber-100 dark:group-hover:text-white">
                                    {getEconomicMetricDisplay().value}
                                  </div>
                                </button>
                              </div>
                            </div>

                            {/* Live National Vitality Rings */}
                            {activityRingsData && !ringsLoading ? (
                              <div className="grid grid-cols-4 gap-3">
                                <div className="flex flex-col items-center gap-2 text-center">
                                  <HealthRing
                                    value={activityRingsData.economicVitality || 0}
                                    size={56}
                                    color="#22c55e"
                                    label="Economic"
                                  />
                                  <div className="text-[10px] font-medium text-green-700 dark:text-green-300">
                                    Economic {activityRingsData.economicVitality}%
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-2 text-center">
                                  <HealthRing
                                    value={activityRingsData.populationWellbeing || 0}
                                    size={56}
                                    color="#3b82f6"
                                    label="Population"
                                  />
                                  <div className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                    Population {activityRingsData.populationWellbeing}%
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-2 text-center">
                                  <HealthRing
                                    value={activityRingsData.diplomaticStanding || 0}
                                    size={56}
                                    color="#a855f7"
                                    label="Diplomatic"
                                  />
                                  <div className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
                                    Diplomatic {activityRingsData.diplomaticStanding}%
                                  </div>
                                </div>

                                <div className="flex flex-col items-center gap-2 text-center">
                                  <HealthRing
                                    value={activityRingsData.governmentalEfficiency || 0}
                                    size={56}
                                    color="#f97316"
                                    label="Government"
                                  />
                                  <div className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
                                    Government {activityRingsData.governmentalEfficiency}%
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-3 gap-4">
                                <div className="group cursor-pointer rounded-2xl border border-green-300/40 bg-gradient-to-br from-green-500/20 to-emerald-500/10 p-4 text-center dark:border-green-200/20 dark:from-green-500/10 dark:to-emerald-500/5">
                                  <BarChart3 className="mx-auto mb-3 h-7 w-7 text-green-600 dark:text-green-400" />
                                  <div className="mb-2 text-xs font-medium text-green-700 dark:text-green-300">
                                    Loading...
                                  </div>
                                </div>
                                <div className="group cursor-pointer rounded-2xl border border-blue-300/40 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 p-4 text-center dark:border-blue-200/20 dark:from-blue-500/10 dark:to-cyan-500/5">
                                  <Users className="mx-auto mb-3 h-7 w-7 text-blue-600 dark:text-blue-400" />
                                  <div className="mb-2 text-xs font-medium text-blue-700 dark:text-blue-300">
                                    Loading...
                                  </div>
                                </div>
                                <div className="group cursor-pointer rounded-2xl border border-purple-300/40 bg-gradient-to-br from-purple-500/20 to-indigo-500/10 p-4 text-center dark:border-purple-200/20 dark:from-purple-500/10 dark:to-indigo-500/5">
                                  <Activity className="mx-auto mb-3 h-7 w-7 text-purple-600 dark:text-purple-400" />
                                  <div className="mb-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                                    Loading...
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                size="sm"
                                onClick={() =>
                                  userProfile?.country &&
                                  (window.location.href = createAbsoluteUrl(
                                    getNationUrl(userProfile.country.name)
                                  ))
                                }
                                className="group relative overflow-hidden border border-amber-400/50 bg-gradient-to-r from-amber-500/30 to-orange-500/25 text-amber-800 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-amber-500/70 hover:from-amber-500/40 hover:to-orange-500/35 hover:text-amber-900 hover:shadow-lg dark:border-amber-300/30 dark:from-amber-500/20 dark:to-orange-500/20 dark:text-amber-200 dark:hover:border-amber-300/50 dark:hover:from-amber-500/30 dark:hover:to-orange-500/30 dark:hover:text-amber-100"
                              >
                                <Crown className="relative z-10 mr-2 h-4 w-4" />
                                <span className="relative z-10 font-medium">Profile</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  (window.location.href = createAbsoluteUrl("/mycountry"))
                                }
                                className="group relative overflow-hidden border border-blue-400/50 bg-gradient-to-r from-blue-500/30 to-cyan-500/25 text-blue-800 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:border-blue-500/70 hover:from-blue-500/40 hover:to-cyan-500/35 hover:text-blue-900 hover:shadow-lg dark:border-blue-300/30 dark:from-blue-500/20 dark:to-cyan-500/20 dark:text-blue-200 dark:hover:border-blue-300/50 dark:hover:from-blue-500/30 dark:hover:to-cyan-500/30 dark:hover:text-blue-100"
                              >
                                <Target className="relative z-10 mr-2 h-4 w-4" />
                                <span className="relative z-10 font-medium">MyCountry</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 text-center">
                            <div className="bg-muted/30 rounded-xl p-4">
                              <User className="mx-auto mb-3 h-12 w-12 text-blue-400" />
                              <div className="text-muted-foreground mb-2">Welcome to IxStats!</div>
                              <div className="text-muted-foreground mb-4 text-sm">
                                Sign in to access your personalized dashboard
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  (window.location.href = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
                                }
                                className="text-muted-foreground hover:text-foreground border-border hover:border-accent hover:bg-accent/10"
                              >
                                Sign In
                              </Button>
                            </div>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Action buttons - icons only with hover tooltips */}
            <div className={`flex items-center justify-center ${isSticky ? "gap-1" : "gap-1.5"}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSwitchMode("search")}
                    className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center justify-center rounded-lg transition-all ${
                      isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                    }`}
                  >
                    <Search
                      className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Search</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSwitchMode("notifications")}
                    className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${
                      isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                    }`}
                  >
                    <Bell
                      className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                    />
                    <AnimatePresence>
                      {totalUnreadCount > 0 && (
                        <motion.div
                          key={totalUnreadCount}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          className={`absolute flex items-center justify-center rounded-full border-0 bg-gradient-to-r from-red-500 to-pink-500 text-[10px] font-bold text-white shadow-lg ${
                            isSticky
                              ? "-top-0.5 -right-0.5 h-2.5 w-2.5 p-0"
                              : "-top-1 -right-1 h-3 w-3 p-0"
                          }`}
                        >
                          {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Alerts</TooltipContent>
              </Tooltip>

              {crisisEvents && crisisEvents.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-center ${isSticky ? "h-6 w-6" : "h-7 w-7"}`}>
                      <CrisisIndicator
                        crises={crisisEvents}
                        variant="compact"
                        onClick={() => onSwitchMode("crisis")}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Crisis Monitor</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSwitchMode("settings")}
                    className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center justify-center rounded-lg transition-all ${
                      isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                    }`}
                  >
                    <Settings
                      className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Settings</TooltipContent>
              </Tooltip>
            </div>
          </DynamicContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

export const CompactView = React.memo(CompactViewComponent);
