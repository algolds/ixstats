import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HaloContainer } from "../HaloPrimitives";

import { useToastQueueStore } from "~/stores/toastQueueStore";
import { Search, Bell, Settings, ProfileCircle } from "iconoir-react";
import { HaloIconButton } from "./compact/HaloIconButton";
import { NarratorProgress } from "./compact/NarratorProgress";
import { useUser } from "~/context/auth-context";
import { useContextHour } from "~/hooks/useContextHour";
import { greetingForHour } from "~/lib/time/greeting";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { useHydrated } from "~/hooks/useHydrated";
import type { CompactViewProps } from "../types";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";

import { PreText } from "~/components/ui/pretext";
import { soundEffects } from "~/lib/sound/cuelume";
import { springSnappy } from "~/lib/design/motion";
import { assetUrl } from "~/lib/base-path";
import { wikiAccent } from "~/components/halo/plugins/wiki/accent";

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
  const { activeSectionId, tocEntries, narratorState, themeColors } = useWikiContext();

  const isNarratorActive = !!(
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const narratorProgressPercent = isNarratorActive
    ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
    : 0;

  const narratorAccent = wikiAccent(themeColors);

  const hour = useContextHour();
  const activeSectionName = activeSectionId
    ? (tocEntries.find((e) => e.id === activeSectionId)?.text ?? null)
    : null;

  const mounted = useHydrated();

  const [currentTime, setCurrentTime] = useState({ greeting: "Good morning" });

  // Notification peek

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

  // Notification counts

  const enhancedStats = useNotificationStore((s) => s.stats);
  const notifications = useNotificationStore((s) => s.notifications);

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
  const notificationUnreadCount = unreadNotifications + enhancedUnreadCount + liveNotificationCount;
  const totalUnreadCount = notificationUnreadCount + messageUnreadCount;

  // Time

  useEffect(() => {
    if (hour === null) return;
    const greeting = greetingForHour(hour);
    setCurrentTime((prev) => (prev.greeting !== greeting ? { greeting } : prev));
  }, [hour]);

  if (!mounted) return null;

  return (
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
        <HaloContainer
          className={`duration-fast flex w-full items-center justify-center gap-1 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] ${
            isSticky ? "px-3 py-2" : "px-4 py-2"
          }`}
        >
          {/* Sticky: peek text or wiki breadcrumb */}
          {isSticky && peekText && (
            <AnimatePresence mode="wait">
              <motion.div
                key="sticky-peek"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={springSnappy}
                className="flex items-center gap-2 px-2 py-0.5"
              >
                <Bell className="text-yellow h-3 w-3" />
                <span className="text-label text-caption max-w-[160px] truncate whitespace-nowrap">
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
                className={`rounded-control-sm hover:bg-fill-2 focus-visible:outline-tint duration-fast flex min-w-0 flex-1 cursor-pointer items-center gap-2 overflow-hidden px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 ${
                  activeSectionName ? "max-w-[220px]" : "max-w-[160px]"
                }`}
                title={`Open ${activePlugin.id} mode`}
              >
                {pluginCenter}
              </div>
            ) : (
              <div
                className={`duration-fast flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] ${
                  activeSectionName ? "max-w-[220px]" : "max-w-[160px]"
                }`}
              >
                {pluginCenter}
              </div>
            ))}

          {/* Non-sticky: peek or time/context */}
          {!isSticky && (
            <AnimatePresence mode="wait">
              {peekText ? (
                <motion.div
                  key="peek"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={springSnappy}
                  className="flex items-center gap-2 px-2 py-1"
                >
                  <Bell className="text-yellow h-3 w-3" />
                  <span className="text-label text-caption max-w-[200px] truncate whitespace-nowrap">
                    <PreText whiteSpace="nowrap">{peekText}</PreText>
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="time-and-greeting"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={springSnappy}
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
                        className="rounded-control-sm hover:bg-fill-2 focus-visible:outline-tint duration-fast flex max-w-[160px] min-w-0 cursor-pointer items-center gap-2 overflow-hidden px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 sm:max-w-[200px]"
                        title={`Open ${activePlugin.id} mode`}
                      >
                        {pluginCenter}
                      </div>
                    ) : (
                      <div className="duration-fast flex max-w-[160px] min-w-0 items-center gap-2 overflow-hidden px-2 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] sm:max-w-[200px]">
                        {pluginCenter}
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchMode("mycountry")}
                      className="text-label hover:bg-fill-4 hover:text-label rounded-control-sm text-caption focus-visible:outline-tint flex cursor-pointer items-center gap-2 px-2 py-0.5 transition-colors outline-none focus-visible:outline-2 focus-visible:-outline-offset-2"
                    >
                      {user?.imageUrl ? (
                        <img
                          src={assetUrl(user.imageUrl) ?? undefined}
                          alt=""
                          className="ring-separator h-4 w-4 rounded-full object-cover ring-1"
                        />
                      ) : (
                        <ProfileCircle aria-hidden className="text-label-secondary size-4" />
                      )}
                      <span className="sr-only sm:hidden">Open MyCountry</span>
                      <PreText className="hidden text-inherit sm:inline" whiteSpace="nowrap">
                        {`${currentTime.greeting}${user?.firstName ? `, ${user.firstName}` : ""}`}
                      </PreText>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Right-Side Action Icons Group with Optional Narrator Progress Underneath */}
          <div className="relative flex shrink-0 flex-col items-center justify-center">
            <div className="flex items-center gap-0.5">
              <HaloIconButton
                label="Search"
                icon={Search}
                onClick={() => {
                  soundEffects.scan();
                  onSwitchMode("search");
                }}
              />

              {isLoaded && isSignedIn && (
                <HaloIconButton
                  label="Notifications"
                  icon={Bell}
                  badge={totalUnreadCount}
                  iconClassName={totalUnreadCount > 0 ? "text-yellow" : undefined}
                  onClick={() => {
                    soundEffects.bloom();
                    onSwitchMode("notifications");
                  }}
                />
              )}

              <HaloIconButton
                label="Settings"
                icon={Settings}
                onClick={() => {
                  soundEffects.bloom();
                  onSwitchMode("settings");
                }}
              />

              {/* Plugin-injected action buttons */}
              {pluginActions?.map((action) => (
                <HaloIconButton
                  key={action.id}
                  label={action.label}
                  icon={action.icon}
                  badge={action.badge}
                  onClick={action.onClick}
                />
              ))}

              {/* Plugin badge dot */}
              {pluginBadge && (
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: pluginBadge.color }}
                />
              )}
            </div>

            {isNarratorActive && (
              <NarratorProgress value={narratorProgressPercent} color={narratorAccent} />
            )}
          </div>
        </HaloContainer>
      </div>
    </div>
  );
}

export const CompactView = React.memo(CompactViewComponent);
