import React, { useState, useEffect, useRef } from "react";
import { DynamicContainer } from "../ui/dynamic-island";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Bell,
  Settings,
  TrendingUp,
  Users,
  Activity,
  Crown,
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useGlobalNotificationBridge } from "~/services/GlobalNotificationBridge";
import { createAbsoluteUrl } from "~/lib/url-utils";
import type { ViewMode, TimeDisplayMode } from "./types";

interface MyCountryCompactViewProps {
  section: "overview" | "executive" | "diplomacy" | "intelligence" | "defense";
  isSticky: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsUserInteracting: (interacting: boolean) => void;
  timeDisplayMode: TimeDisplayMode;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  onSwitchMode: (mode: ViewMode) => void;
  onToggleDIMode?: () => void;
}

interface VitalMetric {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function MyCountryCompactViewComponent({
  section,
  isSticky,
  isCollapsed,
  setIsCollapsed,
  setIsUserInteracting,
  timeDisplayMode,
  setTimeDisplayMode,
  onSwitchMode,
  onToggleDIMode,
}: MyCountryCompactViewProps) {
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [currentVitalIndex, setCurrentVitalIndex] = useState(0);
  const [isRotating, setIsRotating] = useState(true);
  const rotationTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Get user profile (includes country data)
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Use country data from userProfile
  const countryData = userProfile?.country;

  // Get activity rings data for government efficiency
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId ?? "" },
    { enabled: !!userProfile?.countryId }
  );

  // Crisis events data from unified intelligence
  const { data: crisisEvents } = api.unifiedIntelligence.getCrisisEvents.useQuery();

  // Notification system integration
  const enhancedStats = useNotificationStore((state) => state.stats);
  const notifications = useNotificationStore((state) => state.notifications);
  const { getStats } = useGlobalNotificationBridge();
  const { unreadCount: executiveUnreadCount, isExecutiveMode } = useExecutiveNotifications();
  const bridgeStats = getStats();

  const { data: notificationsData } = api.notifications.getUserNotifications.useQuery(
    { limit: 5, unreadOnly: false },
    { enabled: !!user?.id, staleTime: 5 * 60 * 1000 }
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

  // Active crisis events count
  const activeCrisisCount = crisisEvents?.filter((e) => e.responseStatus === "monitoring" || e.responseStatus === "deployed" || e.responseStatus === "coordinating").length || 0;

  // Build vital metrics array
  const vitals: VitalMetric[] = React.useMemo(() => {
    if (!countryData) {
      return [
        { label: "GDP", value: "$0", icon: TrendingUp, color: "text-green-500" },
        { label: "Pop", value: "0", icon: Users, color: "text-blue-500" },
        { label: "Growth", value: "0%", icon: Activity, color: "text-purple-500" },
        { label: "Gov", value: "0%", icon: Crown, color: "text-amber-500" },
      ];
    }

    const gdpPerCapita = countryData.currentGdpPerCapita || 0;
    const population = countryData.currentPopulation || 0;
    const growth = (countryData as any).adjustedGdpGrowth || (countryData as any).currentGrowthRate || 0;
    const govEfficiency = activityRingsData?.governmentalEfficiency || 0;

    return [
      {
        label: "GDP",
        value: formatCurrency(gdpPerCapita),
        icon: TrendingUp,
        color: "text-green-500",
      },
      {
        label: "Pop",
        value: formatPopulation(population),
        icon: Users,
        color: "text-blue-500",
      },
      {
        label: "Growth",
        value: `${(growth * 100).toFixed(1)}%`,
        icon: Activity,
        color: growth >= 0 ? "text-purple-500" : "text-red-500",
      },
      {
        label: "Gov",
        value: `${govEfficiency}%`,
        icon: Crown,
        color: "text-amber-500",
      },
    ];
  }, [countryData, activityRingsData]);

  // Rotation effect - cycle through vitals every 5 seconds
  useEffect(() => {
    if (!isRotating) return;

    rotationTimerRef.current = setInterval(() => {
      setCurrentVitalIndex((prev) => (prev + 1) % vitals.length);
    }, 5000);

    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, [isRotating, vitals.length]);

  // Pause rotation on interaction
  const handleVitalClick = () => {
    setIsRotating(false);
    setCurrentVitalIndex((prev) => (prev + 1) % vitals.length);

    // Resume rotation after 10 seconds of no interaction
    setTimeout(() => setIsRotating(true), 10000);
  };

  useEffect(() => {
    setMounted(true);
  }, [section, countryData, isSticky]);

  if (!mounted) return null;

  // If no country data yet, show loading state
  if (!countryData) {
    return (
      <DynamicContainer className="flex h-auto items-center justify-center px-6 py-6">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </DynamicContainer>
    );
  }

  const currentVital = vitals[currentVitalIndex];
  const VitalIcon = currentVital?.icon || TrendingUp;

  return (
    <TooltipProvider>
      <div
        onMouseEnter={() => {
          if (isSticky) {
            setIsCollapsed(false);
            setIsUserInteracting(true);
            setIsRotating(false);
          }
        }}
        onMouseLeave={() => {
          if (isSticky) {
            setIsUserInteracting(false);
            setIsRotating(true);
          }
        }}
      >
        <DynamicContainer
          className={`relative flex h-auto min-h-fit w-full items-center justify-between transition-all duration-300 ${
            isSticky ? "px-3 py-2" : "px-6 py-6"
          } ${isSticky ? "w-auto" : "w-full"}`}
        >
          {/* Flag Background Overlay - Subtle depth hint (70% DI / 30% Flag) */}
          <div className="absolute inset-0 overflow-hidden rounded-[46px] pointer-events-none">
            <SimpleFlag
              countryName={countryData.name}
              className="h-full w-full object-cover opacity-30 blur-sm"
              showPlaceholder={false}
            />
            {/* Subtle vignette for depth - doesn't block DI background */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/15" />
          </div>

          {/* Content Layer (relative to overlay) */}
          <div className="relative z-10 flex w-full items-center justify-between">
          {/* LEFT: Flag/Home Toggle + MyCountry® badge */}
          <div className="flex items-center gap-2">
            {/* Flag/Home Toggle - Click to switch DI modes */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (onToggleDIMode) {
                      onToggleDIMode();
                    }
                  }}
                  className={`relative flex items-center justify-center rounded-lg transition-all duration-300 hover:scale-110 active:scale-95 ${
                    isSticky ? "h-6 w-6" : "h-8 w-8"
                  }`}
                >
                  <SimpleFlag
                    countryName={countryData.name}
                    className="h-full w-full rounded object-cover"
                    showPlaceholder={false}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold">{countryData.name}</span>
                  <span className="text-xs text-muted-foreground">Click to use regular Dynamic Island</span>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* MyCountry® Badge */}
            <Badge className="border-amber-400/50 bg-gradient-to-r from-amber-500/30 to-orange-500/25 text-amber-800 dark:border-amber-300/30 dark:from-amber-500/20 dark:to-orange-500/20 dark:text-amber-200">
              <Crown className="mr-1 h-3 w-3" />
              <span className="text-[10px] font-bold">MyCountry®</span>
            </Badge>
          </div>

          {/* CENTER: Rotating vital (always shown) */}
          <div className="flex flex-1 items-center justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleVitalClick}
                  className="group flex items-center gap-2 rounded-md px-3 py-1.5 transition-all hover:bg-white/10"
                >
                  <VitalIcon className={`h-4 w-4 ${currentVital?.color}`} />
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-medium text-foreground/60">
                      {currentVital?.label}
                    </span>
                    <span className={`text-sm font-bold ${currentVital?.color}`}>
                      {currentVital?.value}
                    </span>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Click to cycle through vitals
                <br />
                <span className="text-xs text-muted-foreground">
                  Auto-rotates every 5 seconds
                </span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* RIGHT: Notifications + Crisis + Settings */}
          <div className={`flex items-center justify-center ${isSticky ? "gap-1" : "gap-2"}`}>
            {/* Notifications Bell */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSwitchMode("notifications")}
                  className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${
                    isSticky ? "h-7 w-7 p-0" : "h-8 w-8 p-0"
                  }`}
                >
                  <Bell className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-4 w-4"}`} />
                  {totalUnreadCount > 0 && (
                    <Badge
                      className={`absolute flex animate-pulse items-center justify-center rounded-full border-0 bg-gradient-to-r from-red-500 to-pink-500 text-[10px] text-white shadow-lg ${
                        isSticky ? "-top-0.5 -right-0.5 h-2.5 w-2.5 p-0" : "-top-1 -right-1 h-3 w-3 p-0"
                      }`}
                    >
                      {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Alerts</TooltipContent>
            </Tooltip>

            {/* Crisis Indicator */}
            {activeCrisisCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      (window.location.href = createAbsoluteUrl("/mycountry/executive?tab=crisis"))
                    }
                    className={`text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 relative flex items-center justify-center rounded-lg transition-all ${
                      isSticky ? "h-7 w-7 p-0" : "h-8 w-8 p-0"
                    }`}
                  >
                    <AlertTriangle
                      className={`animate-pulse transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-4 w-4"}`}
                    />
                    <Badge
                      className={`absolute flex items-center justify-center rounded-full border-0 bg-gradient-to-r from-orange-500 to-red-500 text-[10px] text-white shadow-lg ${
                        isSticky ? "-top-0.5 -right-0.5 h-2.5 w-2.5 p-0" : "-top-1 -right-1 h-3 w-3 p-0"
                      }`}
                    >
                      {activeCrisisCount}
                    </Badge>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {activeCrisisCount} Active {activeCrisisCount === 1 ? "Crisis" : "Crises"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSwitchMode("settings")}
                  className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center justify-center rounded-lg transition-all ${
                    isSticky ? "h-7 w-7 p-0" : "h-8 w-8 p-0"
                  }`}
                >
                  <Settings
                    className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-4 w-4"}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
          </div>
          </div>
        </DynamicContainer>
      </div>
    </TooltipProvider>
  );
}

export const MyCountryCompactView = React.memo(MyCountryCompactViewComponent);
