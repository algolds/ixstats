import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/lib/utils";
import { DynamicContainer } from "~/components/ui/dynamic-island";
import { Button } from "~/components/ui/button";

import { useToastQueueStore } from "~/stores/toastQueueStore";
import { Search, Bell, Settings } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { useUser } from "~/context/auth-context";
import { useIxTimeStore } from "~/stores/ixtime-store";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { useExecutiveNotifications } from "~/context/ExecutiveNotificationContext";
import type { CompactViewProps } from "../types";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";

import { PreText } from "~/components/ui/pretext";
import { soundEffects } from "~/lib/sound/cuelume";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getGreeting = (ixTime: number): string => {
  const hour = new Date(ixTime).getUTCHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

// ─── Component ───────────────────────────────────────────────────────────────

function CompactViewComponent({
  mode,
  isSticky,
  isCollapsed: _isCollapsed,
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
  const {
    activeSectionId,
    tocEntries,
    narratorState,
    narratorActions,
    themeColors,
  } = useWikiContext();

  const isNarratorActive = !!(
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const narratorProgressPercent = isNarratorActive
    ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
    : 0;

  const narratorAccent = themeColors?.primary || activePlugin?.accentColor || "#3b82f6";

  const ixTimeTimestamp = useIxTimeStore((s) => Math.floor(s.ixTimeTimestamp / 30000) * 30000);
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
  const notificationUnreadCount =
    unreadNotifications +
    (isExecutiveMode ? executiveUnreadCount : 0) +
    enhancedUnreadCount +
    liveNotificationCount;
  const totalUnreadCount = notificationUnreadCount + messageUnreadCount;

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
            {/* ── Sticky: peek text or wiki breadcrumb ──────────────── */}
            {isSticky && peekText && (
              <AnimatePresence mode="wait">
                <motion.div
                  key="sticky-peek"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  className="flex items-center gap-1.5 px-2 py-0.5"
                >
                  <Bell className="h-3 w-3 animate-pulse text-amber-400" />
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (mode === `plugin:${pluginViewKey}`) {
                      onSwitchMode("compact");
                    } else {
                      onSwitchMode(`plugin:${pluginViewKey}`);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (mode === `plugin:${pluginViewKey}`) {
                        onSwitchMode("compact");
                      } else {
                        onSwitchMode(`plugin:${pluginViewKey}`);
                      }
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-all duration-300 hover:bg-white/10 ${
                    activeSectionName ? "max-w-[220px]" : "max-w-[160px]"
                  }`}
                  title={`Open ${activePlugin.id} mode`}
                >
                  {pluginCenter}
                </div>
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
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="flex items-center gap-1.5 px-2 py-1"
                  >
                    <Bell className="h-3 w-3 animate-pulse text-amber-400" />
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
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="flex items-center gap-1"
                  >
                    {/* Context switcher / Plugin center */}
                    {activePlugin && pluginCenter ? (
                      pluginViewKey ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (mode === `plugin:${pluginViewKey}`) {
                              onSwitchMode("compact");
                            } else {
                              onSwitchMode(`plugin:${pluginViewKey}`);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (mode === `plugin:${pluginViewKey}`) {
                                onSwitchMode("compact");
                              } else {
                                onSwitchMode(`plugin:${pluginViewKey}`);
                              }
                            }
                          }}
                          className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 transition-all duration-300 hover:bg-white/10 max-w-[160px] sm:max-w-[200px] min-w-0 overflow-hidden"
                          title={`Open ${activePlugin.id} mode`}
                        >
                          {pluginCenter}
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 px-1.5 transition-all duration-300 max-w-[160px] sm:max-w-[200px] min-w-0 overflow-hidden"
                        >
                          {pluginCenter}
                        </div>
                      )
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

            {/* ── Right-Side Action Icons Group with Optional Narrator Progress Underneath ── */}
            <div className="flex flex-col items-center justify-center relative shrink-0">
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-cuelume-hover="tick"
                      onClick={() => {
                        soundEffects.scan();
                        onSwitchMode("search");
                      }}
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
                        data-cuelume-hover="chime"
                        onClick={() => {
                          soundEffects.bloom();
                          onSwitchMode("notifications");
                        }}
                        className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${
                          isSticky ? "h-6 w-6 p-0" : "h-7 w-7 p-0"
                        }`}
                      >
                        <Bell
                          className={cn(
                            "transition-transform hover:scale-110",
                            totalUnreadCount > 0
                              ? "text-amber-400 dark:text-amber-300"
                              : "text-muted-foreground hover:text-foreground",
                            isSticky ? "h-3 w-3" : "h-3.5 w-3.5"
                          )}
                        />
                        <AnimatePresence>
                          {totalUnreadCount > 0 && (
                            <motion.div
                              key={`total-${totalUnreadCount}`}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              className={`absolute flex items-center justify-center rounded-full border-0 bg-amber-500 text-[10px] font-bold text-white shadow-lg ${
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
                    <TooltipContent side="bottom">
                      {totalUnreadCount > 0
                        ? `Alert Center (${totalUnreadCount} unread)`
                        : "Alert Center"}
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-cuelume-hover="tick"
                      onClick={() => {
                        soundEffects.bloom();
                        onSwitchMode("settings");
                      }}
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
                              className={`absolute flex items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white ${
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
              </div>

              {/* Sleek Hairline Narrator Progress Track Underneath the Icons Group */}
              {isNarratorActive && narratorActions && (
                <div
                  className="group/narrator-progress relative w-full h-[2.5px] rounded-full bg-foreground/15 dark:bg-white/15 overflow-hidden cursor-pointer mt-0.5 flex items-center transition-all hover:h-[3.5px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, clickX / rect.width));
                    const targetBlock = Math.min(
                      narratorState.totalBlocks - 1,
                      Math.max(0, Math.round(pct * (narratorState.totalBlocks - 1)))
                    );
                    narratorActions.jumpToBlock(targetBlock);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title={`Narrator Progress: ${Math.round(narratorProgressPercent)}% · Click to scrub`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${narratorProgressPercent}%`,
                      backgroundColor: narratorAccent,
                    }}
                  />
                </div>
              )}
            </div>
          </DynamicContainer>
        </div>
      </div>
    </TooltipProvider>
  );
}

export const CompactView = React.memo(CompactViewComponent);
