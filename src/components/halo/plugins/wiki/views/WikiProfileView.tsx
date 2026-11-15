import React, { useState } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { assetUrl, navigateWithBasePath } from "~/lib/base-path";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { useRouter } from "next/navigation";
import {
  OpenBook as BookOpen,
  User,
  Trophy,
  FireFlame as Flame,
  NavArrowRight as ChevronRight,
  Page as FileText,
  Crown,
  ClockRotateRight as History,
  ArrowLeft,
  ProfileCircle,
} from "iconoir-react";
import { getCountryActions } from "~/components/halo/country-actions";
import {
  HaloCloseButton,
  HaloEmpty,
  HaloViewHeader,
  HaloWell,
} from "~/components/halo/views/shared/HaloViewParts";
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { resolveChatBadgeIcon } from "~/components/ui/chat-badge-icon";
import { motion, AnimatePresence } from "motion/react";
import type { PausedSession } from "../types";
import { pageRefPath } from "~/lib/wiki-os/page-ref";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { tweenFast } from "~/lib/design/motion";

// This view is loaded with `ssr: false` (WikiHalo), so its first render is already in the browser.
function readScratchpad(): string {
  try {
    return localStorage.getItem("wikios:scratchpad") || "";
  } catch {
    return ""; // restricted storage
  }
}

function readPausedSessions(): PausedSession[] {
  try {
    const savedSessions = localStorage.getItem("wikios:pausedSessions");
    return savedSessions ? (JSON.parse(savedSessions) as PausedSession[]) : [];
  } catch {
    return []; // restricted storage or invalid JSON
  }
}

interface WikiProfileViewProps {
  onClose: () => void;
}

export function WikiProfileView({ onClose }: WikiProfileViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const { recentArticles, restoreSession } = useWikiContext();

  const [activeTab, setActiveTab] = useState<"workspace" | "profile">("profile");
  const [view, setView] = useState<"tabs" | "country-actions">("tabs");
  const [scratchpad, setScratchpad] = useState(readScratchpad);
  const [pausedSessions] = useState(readPausedSessions);

  // Active cosmetics
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = resolveChatBadgeIcon(chatBadge?.icon);

  // API query
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
  });

  const countryName = userProfile?.country?.name ?? "";
  const { data: lorewardStats } = api.lorewards.getUserStats.useQuery(
    { username: countryName },
    { enabled: !!countryName, staleTime: 60_000 }
  );

  // The passport handle names the player and their contributions; an old wiki name is never shown.
  const handle = userProfile?.handle ?? null;
  const profileName =
    handle ??
    (user?.username
      ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
      : (user?.firstName ?? ""));

  // Handle Scratchpad Change & Auto-Save
  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setScratchpad(val);
    try {
      localStorage.setItem("wikios:scratchpad", val);
    } catch {
      // ignore
    }
  };

  const handleResumeSession = (session: PausedSession) => {
    onClose();
    restoreSession(session);
  };

  return (
    <div className="overflow-hidden p-3">
      <AnimatePresence mode="wait">
        {view === "tabs" ? (
          <motion.div
            key="tabs"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tweenFast}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="flex items-center gap-3">
                <SegmentedControl
                  aria-label="Wiki panel"
                  asTabs
                  size="sm"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  options={[
                    { value: "workspace", label: "Workspace", icon: <FileText aria-hidden /> },
                    { value: "profile", label: "Wiki profile", icon: <User aria-hidden /> },
                  ]}
                />
              </div>
              <HaloCloseButton onClick={onClose} />
            </div>

            {/* Content */}
            {activeTab === "workspace" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Left Column: Paused/Saved Sessions */}
                <HaloWell className="space-y-3">
                  <div className="text-label-secondary text-footnote flex items-center gap-2">
                    <History className="h-3 w-3" />
                    <span>Saved and paused sessions</span>
                  </div>

                  {pausedSessions.length === 0 ? (
                    <HaloEmpty
                      icon={<BookOpen />}
                      title="No paused sessions yet"
                      message="Your reading/editing progress will appear here."
                      className="py-6"
                    />
                  ) : (
                    <div className="space-y-2">
                      {pausedSessions.map((session) => (
                        <div
                          key={pageRefPath(session)}
                          className="bg-fill-4 hover:bg-fill-3 rounded-control flex flex-col gap-2 p-3 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-label text-caption truncate font-semibold">
                              {session.title}
                            </span>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResumeSession(session)}
                            >
                              Resume
                            </Button>
                          </div>
                          {/* Progress indicator */}
                          <div className="flex items-center gap-2">
                            <div className="bg-fill-3 h-1 flex-1 rounded-full">
                              <div
                                className="bg-blue h-full rounded-full"
                                style={{ width: `${session.scrollPercent}%` }}
                              />
                            </div>
                            <span className="text-label-secondary text-caption font-semibold tabular-nums">
                              {session.scrollPercent}% read
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </HaloWell>

                {/* Right Column: Quick Notes / Scratchpad */}
                <HaloWell className="flex flex-col space-y-2">
                  <div className="text-label-secondary text-footnote flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span>Wiki scratchpad</span>
                  </div>
                  <div className="relative flex-1">
                    <textarea
                      value={scratchpad}
                      onChange={handleScratchpadChange}
                      placeholder="Jot down quick worldbuilding notes, drafts, task lists, or article revisions here… (auto-saves)"
                      className="bg-fill-4 text-label placeholder:text-label-tertiary focus:bg-fill-3 rounded-control text-footnote focus-visible:outline-tint min-h-[140px] w-full resize-none p-3 transition-[color,background-color,box-shadow,opacity,scale,translate] outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ scrollbarWidth: "thin" }}
                    />
                  </div>
                </HaloWell>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-3">
                {/* Wiki Profile Stats */}
                <HaloWell className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden p-4">
                  {/* Neon Frame Overlay */}
                  <NeonFrameOverlay neonFrame={neonFrame} className="rounded-row" />

                  <div className="z-raised relative flex items-center gap-3">
                    <AvatarGlow
                      avatarGlow={avatarGlow}
                      roundedClass="rounded-full"
                      className="bg-indigo/60 h-10 w-10"
                    >
                      {user?.imageUrl ? (
                        <img
                          src={assetUrl(user.imageUrl) ?? undefined}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="bg-fill-4 flex h-full w-full items-center justify-center rounded-full">
                          <ProfileCircle aria-hidden className="text-label-secondary size-6" />
                        </div>
                      )}
                    </AvatarGlow>
                    <div>
                      <div className="text-label text-headline flex items-center gap-2">
                        <span>{profileName || "Wiki profile"}</span>
                        {chatBadge.enabled && (
                          <CrownIcon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: chatBadge.color }}
                          />
                        )}
                      </div>
                      <div className="text-label-secondary text-footnote">Worldbuilding editor</div>
                    </div>
                  </div>

                  {lorewardStats && (
                    <div className="z-raised relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                          <Trophy className="text-yellow h-4 w-4" />
                          <span className="text-label text-headline">
                            {lorewardStats.stats?.totalScore ?? 0}
                          </span>
                        </div>
                        <span className="text-label-secondary text-footnote">Score</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                          <Flame className="text-orange h-4 w-4" />
                          <span className="text-label text-headline">
                            {lorewardStats.stats?.currentStreak ?? 0}
                          </span>
                        </div>
                        <span className="text-label-secondary text-footnote">Streak</span>
                      </div>
                    </div>
                  )}
                </HaloWell>

                {/* Quick actions & Recent */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <HaloWell className="space-y-2">
                    <div className="text-subhead text-label-secondary">Quick actions</div>
                    <div className="space-y-1">
                      {handle && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            onClose();
                            navigateWithBasePath(getWikiProfilePath(handle), router);
                          }}
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <User className="text-blue h-3.5 w-3.5" />
                            <span>My contributions</span>
                          </div>
                          <ChevronRight className="text-label-tertiary h-3.5 w-3.5" />
                        </Button>
                      )}
                      {userProfile?.countryId && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setView("country-actions")}
                          className="w-full justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="text-yellow h-3.5 w-3.5" />
                            <span>Country actions</span>
                          </div>
                          <ChevronRight className="text-label-tertiary h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </HaloWell>

                  <HaloWell className="space-y-2">
                    <div className="text-subhead text-label-secondary">Recently visited pages</div>
                    {recentArticles.length === 0 ? (
                      <HaloEmpty title="No pages visited recently" className="py-4" />
                    ) : (
                      <div className="space-y-1">
                        {recentArticles.slice(0, 3).map((page) => (
                          <Button
                            type="button"
                            variant="secondary"
                            key={pageRefPath(page)}
                            onClick={() => {
                              onClose();
                              restoreSession(page);
                            }}
                            className="w-full justify-start"
                          >
                            <History className="text-blue h-3.5 w-3.5" />
                            <span className="truncate">{page.title}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </HaloWell>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="country-actions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tweenFast}
            className="space-y-3"
          >
            <HaloViewHeader
              leading={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setView("tabs")}
                  className="text-label-secondary hover:text-label"
                  aria-label="Back"
                >
                  <ArrowLeft aria-hidden />
                </Button>
              }
              title={
                <span className="flex flex-col">
                  <span className="inline-flex items-center gap-2">
                    <Crown className="text-yellow h-4 w-4 shrink-0" />
                    <span>Country management</span>
                  </span>
                  {countryName && (
                    <span className="text-label-secondary text-caption font-normal">
                      {countryName}
                    </span>
                  )}
                </span>
              }
              onClose={onClose}
            />

            {/* Grid of Actions */}
            <HaloWell>
              <div className="grid grid-cols-2 gap-2">
                {getCountryActions([
                  "overview",
                  "executive",
                  "diplomacy",
                  "map-editor",
                  "vault",
                  "politics",
                ]).map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.id}
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        onClose();
                        navigateWithBasePath(ixstatesHref(action.path), router);
                      }}
                      className="h-auto w-full flex-col gap-2 p-4 text-center"
                    >
                      <Icon
                        aria-hidden
                        data-app={action.dataApp}
                        className={cn(action.iconClass, "h-5 w-5")}
                      />
                      <span>{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </HaloWell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
