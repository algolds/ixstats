import React, { useState, useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
import { ixstatesHref } from "~/lib/system/wikios-standalone";
import { useRouter } from "next/navigation";
import {
  OpenBook as BookOpen,
  User,
  Trophy,
  FireFlame as Flame,
  NavArrowRight as ChevronRight,
  Xmark as X,
  Page as FileText,
  Crown,
  ClockRotateRight as History,
  ArrowLeft,
  City as Building2,
  Page as ScrollText,
  Community as Handshake,
  Map,
  Wallet,
  ScaleFrameEnlarge as Scale,
} from "iconoir-react";
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

interface WikiProfileViewProps {
  onClose: () => void;
}

export function WikiProfileView({ onClose }: WikiProfileViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const { recentArticles, restoreSession } = useWikiContext();

  const [activeTab, setActiveTab] = useState<"workspace" | "profile">("profile");
  const [view, setView] = useState<"tabs" | "country-actions">("tabs");
  const [scratchpad, setScratchpad] = useState("");
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);

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

  const wikiUsername =
    userProfile?.wikiUsername ??
    (user?.username
      ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
      : (user?.firstName ?? ""));

  // Load localStorage data
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem("wikios:scratchpad") || "";
      // oxlint-disable-next-line
      setScratchpad(savedNotes);

      const savedSessions = localStorage.getItem("wikios:pausedSessions");
      if (savedSessions) {
        setPausedSessions(JSON.parse(savedSessions));
      }
    } catch {
      // ignore SSR or restricted storage
    }
  }, []);

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
    <div className="overflow-hidden p-4">
      <AnimatePresence mode="wait">
        {view === "tabs" ? (
          <motion.div
            key="tabs"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tweenFast}
          >
            <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="text-label-secondary hover:text-label"
              >
                <X aria-hidden />
              </Button>
            </div>

            {/* Content */}
            {activeTab === "workspace" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left Column: Paused/Saved Sessions */}
                <div className="space-y-3">
                  <div className="text-label-secondary text-eyebrow flex items-center gap-2">
                    <History className="h-3 w-3" />
                    <span>Saved and paused sessions</span>
                  </div>

                  {pausedSessions.length === 0 ? (
                    <div className="border-separator bg-fill-4 rounded-row flex flex-col items-center justify-center border px-4 py-8 text-center">
                      <BookOpen className="text-label-tertiary mb-2 h-6 w-6" />
                      <span className="text-label-secondary text-footnote">
                        No paused sessions yet
                      </span>
                      <span className="text-label-secondary text-footnote mt-1">
                        Your reading/editing progress will appear here.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pausedSessions.map((session) => (
                        <div
                          key={pageRefPath(session)}
                          className="border-separator bg-fill-4 hover:bg-fill-3 rounded-row flex flex-col gap-2 border p-3 transition-colors"
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
                </div>

                {/* Right Column: Quick Notes / Scratchpad */}
                <div className="flex flex-col space-y-2">
                  <div className="text-label-secondary text-eyebrow flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    <span>Wiki scratchpad</span>
                  </div>
                  <div className="relative flex-1">
                    <textarea
                      value={scratchpad}
                      onChange={handleScratchpadChange}
                      placeholder="Jot down quick worldbuilding notes, drafts, task lists, or article revisions here... (auto-saves)"
                      className="border-separator bg-fill-4 text-label placeholder:text-label-tertiary focus:border-separator focus:bg-fill-3 rounded-row text-footnote min-h-[140px] w-full resize-none border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:outline-none"
                      style={{ scrollbarWidth: "thin" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Wiki Profile Stats */}
                <div className="border-separator bg-fill-4 rounded-row relative flex flex-wrap items-center justify-between gap-4 overflow-hidden border p-4">
                  {/* Neon Frame Overlay */}
                  <NeonFrameOverlay neonFrame={neonFrame} className="rounded-row" />

                  <div className="relative z-10 flex items-center gap-3">
                    <AvatarGlow
                      avatarGlow={avatarGlow}
                      roundedClass="rounded-full"
                      className="bg-indigo/60 shadow-card h-10 w-10"
                    >
                      {user?.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="bg-fill-4 text-body flex h-full w-full items-center justify-center rounded-full">
                          👤
                        </div>
                      )}
                    </AvatarGlow>
                    <div>
                      <div className="text-label text-headline flex items-center gap-2">
                        <span>{wikiUsername || "Wiki profile"}</span>
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
                    <div className="border-separator relative z-10 flex gap-4 border-l pl-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                          <Trophy className="text-yellow h-4 w-4" />
                          <span className="text-label text-headline">
                            {lorewardStats.stats?.totalScore ?? 0}
                          </span>
                        </div>
                        <span className="text-label-secondary text-eyebrow">Score</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                          <Flame className="text-orange h-4 w-4" />
                          <span className="text-label text-headline">
                            {lorewardStats.stats?.currentStreak ?? 0}
                          </span>
                        </div>
                        <span className="text-label-secondary text-eyebrow">Streak</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick actions & Recent */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-subhead text-label-secondary">Quick actions</div>
                    <div className="space-y-1">
                      {wikiUsername && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            onClose();
                            navigateWithBasePath(getWikiProfilePath(wikiUsername), router);
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
                  </div>

                  <div className="space-y-2">
                    <div className="text-subhead text-label-secondary">Recently visited pages</div>
                    {recentArticles.length === 0 ? (
                      <div className="border-separator text-label-secondary rounded-control text-footnote border py-4 text-center">
                        No pages visited recently
                      </div>
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
                  </div>
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
          >
            {/* Country actions Header */}
            <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
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
                <div className="flex flex-col">
                  <h3 className="text-label text-headline flex items-center gap-2">
                    <Crown className="text-yellow h-4 w-4" />
                    Country Management
                  </h3>
                  <span className="text-label-secondary text-caption">{countryName}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="text-label-secondary hover:text-label"
              >
                <X aria-hidden />
              </Button>
            </div>

            {/* Grid of Actions */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/mycountry"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <Building2 className="text-yellow h-5 w-5" />
                <span>MyCountry Dashboard</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/mycountry/executive"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <ScrollText className="text-indigo h-5 w-5" />
                <span>Executive actions</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/mycountry/diplomacy"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <Handshake className="text-teal h-5 w-5" />
                <span>Manage diplomacy</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/mycountry/editor"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <Map className="text-blue h-5 w-5" />
                <span>Map and editor</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/vault"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <Wallet className="text-yellow h-5 w-5" />
                <span>IxVault Cards</span>
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  navigateWithBasePath(ixstatesHref("/mycountry/politics"), router);
                }}
                className="h-auto w-full flex-col gap-2 p-4 text-center"
              >
                <Scale className="text-indigo h-5 w-5" />
                <span>Politics and elections</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
