import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/lib/utils";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { DynamicContainer } from "../ui/dynamic-island";
import { Button } from "../ui/button";

import { useToastQueueStore } from "~/stores/toastQueueStore";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Calendar, Search, Bell, MessageCircle, BookOpen, Settings } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { useUser } from "~/context/auth-context";
import { useIxTime } from "~/contexts/IxTimeContext";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useGlobalNotificationBridge } from "~/services/GlobalNotificationBridge";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath } from "~/lib/base-path";
import IxLogoV2 from "~/app/_components/ix-logo-v2.svg";
import type { CompactViewProps } from "./types";
import { useRouter, usePathname } from "next/navigation";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { isStandaloneClient } from "~/lib/standalone-detection";

// Extracted sub-components
import { MapsProfileDropdown } from "./MapsProfileDropdown";
// eslint-disable-next-line unused-imports/no-unused-imports
import { WikiProfileButton as _WikiProfileButton } from "./WikiProfileButton";
import { PreText } from "~/components/ui/pretext";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";

const isStandalone = typeof window !== "undefined" && isStandaloneClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getGreeting = (ixTime: number): string => {
  const hour = new Date(ixTime).getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

// LivePillClock removed (static date display only in compact view)

// ─── Component ───────────────────────────────────────────────────────────────

function CompactViewComponent({
  mode,
  isSticky,
  isCollapsed,
  setIsCollapsed,
  setIsUserInteracting,
  onSwitchMode,
  activePlugin,
  pluginCenter,
  pluginActions,
  pluginBadge,
}: CompactViewProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const pluginViewKey = activePlugin?.expandedViews
    ? Object.keys(activePlugin.expandedViews)[0]
    : null;
  const { articleTitle, activeSectionId, tocEntries } = useWikiContext();
  const router = useRouter();
  const diPathname = usePathname();
  const isOnMapsPage = diPathname?.startsWith("/maps") || false;

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { ixTimeTimestamp } = useIxTime();
  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  const [mounted, setMounted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const previousNotificationCountRef = useRef(0);

  const [currentTime, setCurrentTime] = useState({ greeting: "Good morning" });

  // ─── Notification peek ─────────────────────────────────────────────────

  const [peekText, setPeekText] = useState<string | null>(null);
  const toastQueue = useToastQueueStore((s) => s.queue);
  const lastSeenToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (toastQueue.length === 0) return;
    const latest = toastQueue[0];
    if (!latest || latest.id === lastSeenToastRef.current) return;
    if (latest.priority === "low") {
      lastSeenToastRef.current = latest.id;
      return;
    }
    lastSeenToastRef.current = latest.id;
    setPeekText(latest.title);
    const timer = setTimeout(() => setPeekText(null), 2500);
    return () => clearTimeout(timer);
  }, [toastQueue]);

  // ─── Notification counts ───────────────────────────────────────────────

  const enhancedStats = useNotificationStore((s) => s.stats);
  const notifications = useNotificationStore((s) => s.notifications);
  const { getStats: _getStats } = useGlobalNotificationBridge();
  const { unreadCount: executiveUnreadCount, isExecutiveMode } = useExecutiveNotifications();

  const { data: notificationsData } = api.notifications.getUserNotifications.useQuery(
    { limit: 5, unreadOnly: false },
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
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();
  const totalUnreadCount =
    unreadNotifications +
    (isExecutiveMode ? executiveUnreadCount : 0) +
    enhancedUnreadCount +
    liveNotificationCount +
    messageUnreadCount;

  // ─── Time ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const greeting = getGreeting(ixTimeTimestamp);
    setCurrentTime((prev) => (prev.greeting !== greeting ? { greeting } : prev));
  }, [ixTimeTimestamp]);

  useEffect(() => {
    setMounted(true);
    previousNotificationCountRef.current = totalUnreadCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flash on new notifications
  useEffect(() => {
    if (!mounted) return;
    if (totalUnreadCount > previousNotificationCountRef.current) {
      setIsFlashing(true);
      const t = setTimeout(() => setIsFlashing(false), 1000);
      previousNotificationCountRef.current = totalUnreadCount;
      return () => clearTimeout(t);
    }
    previousNotificationCountRef.current = totalUnreadCount;
    return;
  }, [totalUnreadCount, mounted]);

  if (!mounted) return null;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div
        onMouseEnter={() => {
          if (isSticky || activePlugin?.id === "forum") {
            setIsCollapsed(false);
            setIsUserInteracting(true);
          }
        }}
        onMouseLeave={() => {
          if (isSticky || activePlugin?.id === "forum") {
            setIsUserInteracting(false);
          }
        }}
      >
        <div className="h-full w-full">
          <DynamicContainer
            className={`flex w-full items-center justify-center gap-1 transition-all duration-300 ${
              isSticky ? "px-3 py-1.5" : "px-4 py-2"
            } ${isFlashing ? "animate-flash-notification" : ""}`}
          >
            {/* ── IX Logo ──────────────────────────────────────── */}
            {(() => {
              const isWikiActive = activePlugin?.id === "wiki";
              if (isWikiActive) return null;

              // Hide on root and dashboard pages
              const isRootOrDashboard = diPathname === "/" || diPathname === "/dashboard";
              if (isRootOrDashboard) return null;
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() =>
                        (window.location.href = createAbsoluteUrl(isStandalone ? "/maps" : "/"))
                      }
                      className={cn(
                        "group relative flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95",
                        isWikiActive
                          ? "h-9 w-10 flex-col gap-0.5"
                          : isSticky
                            ? "h-6 w-6"
                            : "h-7 w-7"
                      )}
                    >
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/30 to-blue-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      {isWikiActive ? (
                        <div className="relative z-10 flex flex-col items-center justify-center gap-0 leading-none">
                          <img
                            src={IxLogoV2.src}
                            alt="IxLogo"
                            className="h-3 w-auto opacity-95 transition-all duration-300 group-hover:scale-110 dark:brightness-0 dark:invert"
                          />
                          <span
                            className="text-foreground mt-0.5 text-[10px] leading-none font-semibold tracking-[0.1em] antialiased"
                            style={{ fontFamily: "var(--font-playfair)" }}
                          >
                            WIKI
                          </span>
                        </div>
                      ) : activePlugin?.id === "builder" ? (
                        <div className="relative z-10 flex origin-center scale-60 items-center justify-center sm:scale-75">
                          <MyCountryLogo size="sm" variant="icon-only" animated={false} />
                        </div>
                      ) : (
                        <img
                          src={IxLogoV2.src}
                          alt="IxLogo"
                          className={cn(
                            "relative z-10 opacity-80 brightness-100 filter transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:drop-shadow-lg dark:brightness-0 dark:invert",
                            isSticky ? "h-4 w-4" : "h-5 w-5"
                          )}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {activePlugin?.id === "builder"
                      ? "Builder Home"
                      : isWikiActive
                        ? "Wiki Home"
                        : "Home"}
                  </TooltipContent>
                </Tooltip>
              );
            })()}

            {/* ── Sticky: peek text or wiki breadcrumb ──────────────── */}
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
                  <Bell className="h-3 w-3 animate-pulse text-blue-400" />
                  <span className="text-foreground/90 max-w-[160px] truncate text-[11px] font-medium whitespace-nowrap">
                    <PreText whiteSpace="nowrap">{peekText}</PreText>
                  </span>
                </motion.div>
              </AnimatePresence>
            )}

            {isSticky &&
              !peekText &&
              activePlugin &&
              pluginCenter &&
              (pluginViewKey ? (
                <button
                  onClick={() => {
                    if (mode === `plugin:${pluginViewKey}`) {
                      onSwitchMode("compact");
                    } else {
                      onSwitchMode(`plugin:${pluginViewKey}`);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-all duration-300 hover:bg-white/10 ${
                    activeSectionName ? "max-w-[220px]" : "max-w-[160px]"
                  }`}
                  title={`Open ${activePlugin.id} mode`}
                >
                  {pluginCenter}
                </button>
              ) : (
                <div
                  className={`flex items-center gap-1.5 px-1.5 py-0.5 transition-all duration-300 ${
                    activeSectionName ? "max-w-[220px]" : "max-w-[160px]"
                  }`}
                >
                  {pluginCenter}
                </div>
              ))}

            {/* ── Non-sticky: peek or time/context ─────────────────── */}
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
                    <Bell className="h-3 w-3 animate-pulse text-blue-400" />
                    <span className="text-foreground/90 max-w-[200px] truncate text-xs font-medium whitespace-nowrap">
                      <PreText whiteSpace="nowrap">{peekText}</PreText>
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="time-and-greeting"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className="flex items-center gap-1"
                  >
                    {/* Time/Date — hidden when plugin is active */}
                    {!activePlugin && (
                      <button
                        onClick={() => onSwitchMode("calendar")}
                        title="Open Calendar"
                        className="hover:bg-accent/50 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 transition-colors"
                      >
                        <Calendar className="h-3 w-3 text-blue-500 opacity-70" />
                        <PreText
                          className="text-foreground/80 inline text-[11px] font-semibold whitespace-nowrap tabular-nums"
                          whiteSpace="nowrap"
                        >
                          {new Date(ixTimeTimestamp).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </PreText>
                      </button>
                    )}

                    {/* Separator — only if no active plugin and user is authenticated/loaded */}
                    {!activePlugin && user && (
                      <span className="bg-border mx-0.5 h-3 w-px shrink-0" />
                    )}

                    {/* Context switcher / Plugin center */}
                    {activePlugin && pluginCenter ? (
                      pluginViewKey ? (
                        <button
                          onClick={() => {
                            if (mode === `plugin:${pluginViewKey}`) {
                              onSwitchMode("compact");
                            } else {
                              onSwitchMode(`plugin:${pluginViewKey}`);
                            }
                          }}
                          className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-all duration-300 hover:bg-white/10 ${
                            activeSectionName ? "max-w-[280px]" : "max-w-[220px]"
                          }`}
                          title={`Open ${activePlugin.id} mode`}
                        >
                          {pluginCenter}
                        </button>
                      ) : (
                        <div
                          className={`flex items-center gap-1.5 px-1.5 transition-all duration-300 ${
                            activeSectionName ? "max-w-[280px]" : "max-w-[220px]"
                          }`}
                        >
                          {pluginCenter}
                        </div>
                      )
                    ) : isOnMapsPage ? (
                      <MapsProfileDropdown
                        user={user}
                        isLoaded={isLoaded}
                        userProfile={userProfile}
                        greeting={currentTime.greeting}
                      />
                    ) : (
                      <button
                        onClick={() => onSwitchMode("mycountry")}
                        className="text-foreground/80 hover:bg-accent/10 hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors"
                      >
                        {user?.imageUrl ? (
                          <img
                            src={user.imageUrl}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover ring-1 ring-white/20"
                          />
                        ) : (
                          <span className="text-muted-foreground h-3 w-3 text-xs">👤</span>
                        )}
                        <PreText className="hidden text-inherit sm:inline" whiteSpace="nowrap">
                          {`${currentTime.greeting}${user?.firstName ? `, ${user.firstName}` : ""}`}
                        </PreText>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* ── Action buttons (Search + Bell + Settings) ───────── */}
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

            {isLoaded && isSignedIn && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (messageUnreadCount > 0) {
                        router.push("/messages");
                      } else {
                        onSwitchMode("notifications");
                      }
                    }}
                    className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${
                      isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                    }`}
                  >
                    {messageUnreadCount > 0 ? (
                      <MessageCircle
                        className={`text-blue-400 transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                      />
                    ) : (
                      <Bell
                        className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                      />
                    )}
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
                    className={`transition-transform hover:scale-110 hover:rotate-45 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>

            {/* Plugin-injected action buttons */}
            {pluginActions?.map((action) => {
              const ActionIcon = action.icon;
              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={action.onClick}
                      className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${
                        isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                      }`}
                    >
                      <ActionIcon
                        className={`transition-transform hover:scale-110 ${isSticky ? "h-3 w-3" : "h-3.5 w-3.5"}`}
                      />
                      {action.badge != null && action.badge > 0 && (
                        <span
                          className={`absolute flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-[8px] font-bold text-white ${
                            isSticky ? "-top-0.5 -right-0.5 h-2.5 w-2.5" : "-top-1 -right-1 h-3 w-3"
                          }`}
                        >
                          {action.badge > 9 ? "9+" : action.badge}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{action.label}</TooltipContent>
                </Tooltip>
              );
            })}

            {/* Plugin badge dot */}
            {pluginBadge && (
              <div
                className={`h-1.5 w-1.5 rounded-full ${pluginBadge.pulse ? "animate-pulse" : ""}`}
                style={{ backgroundColor: pluginBadge.color }}
              />
            )}
          </DynamicContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

export const CompactView = React.memo(CompactViewComponent);
