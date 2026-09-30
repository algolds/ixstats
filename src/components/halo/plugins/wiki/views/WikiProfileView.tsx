import React, { useState, useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
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
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import * as IconoirIcons from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import type { PausedSession } from "../types";
import { pageRefPath } from "~/lib/wiki-os/page-ref";
import { getWikiProfilePath } from "~/lib/wiki-os/profile-url";

export interface WikiProfileViewProps {
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
  const CrownIcon = (IconoirIcons as any)[chatBadge?.icon ?? ""] || Crown;

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
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            {/* Header */}
            <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-fill-4 rounded-control flex gap-1.5 p-1">
                  <button
                    onClick={() => setActiveTab("workspace")}
                    className={cn(
                      "rounded-control-sm text-caption flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
                      activeTab === "workspace"
                        ? "bg-fill-3 text-label shadow-card"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Workspace</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={cn(
                      "rounded-control-sm text-caption flex cursor-pointer items-center gap-1.5 px-3 py-1.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none",
                      activeTab === "profile"
                        ? "bg-fill-3 text-label shadow-card"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Wiki Profile</span>
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control-sm flex h-7 w-7 cursor-pointer items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            {activeTab === "workspace" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left Column: Paused/Saved Sessions */}
                <div className="space-y-3">
                  <div className="text-label-secondary text-eyebrow flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    <span>Saved & Paused Sessions</span>
                  </div>

                  {pausedSessions.length === 0 ? (
                    <div className="border-separator bg-foreground/[0.02] rounded-row flex flex-col items-center justify-center border px-4 py-8 text-center">
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
                          className="border-separator bg-foreground/[0.02] hover:bg-foreground/[0.04] rounded-row flex flex-col gap-2 border p-3 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-label text-caption truncate font-semibold">
                              {session.title}
                            </span>
                            <button
                              onClick={() => handleResumeSession(session)}
                              className="rounded-control-sm bg-blue/10 text-caption text-blue hover:bg-blue/20 flex cursor-pointer items-center gap-1 px-2 py-1 font-semibold transition-colors"
                            >
                              Resume
                            </button>
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
                  <div className="text-label-secondary text-eyebrow flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    <span>Wiki Scratchpad</span>
                  </div>
                  <div className="relative flex-1">
                    <textarea
                      value={scratchpad}
                      onChange={handleScratchpadChange}
                      placeholder="Jot down quick worldbuilding notes, drafts, task lists, or article revisions here... (auto-saves)"
                      className="border-separator bg-foreground/[0.02] text-label placeholder:text-label-tertiary focus:border-separator focus:bg-foreground/[0.03] rounded-row text-footnote min-h-[140px] w-full resize-none border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] focus:outline-none"
                      style={{ scrollbarWidth: "thin" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Wiki Profile Stats */}
                <div className="border-separator bg-foreground/[0.02] rounded-row relative flex flex-wrap items-center justify-between gap-4 overflow-hidden border p-4">
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
                      <div className="text-label text-headline flex items-center gap-1.5">
                        <span>{wikiUsername || "Wiki Profile"}</span>
                        {chatBadge.enabled && (
                          <CrownIcon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: chatBadge.color }}
                          />
                        )}
                      </div>
                      <div className="text-label-secondary text-footnote">Worldbuilding Editor</div>
                    </div>
                  </div>

                  {lorewardStats && (
                    <div className="border-separator relative z-10 flex gap-4 border-l pl-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="text-yellow h-4 w-4" />
                          <span className="text-label text-headline">
                            {lorewardStats.stats?.totalScore ?? 0}
                          </span>
                        </div>
                        <span className="text-label-secondary text-eyebrow">Score</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
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

                {/* Quick Actions & Recent */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-subhead text-label-secondary">Quick Actions</div>
                    <div className="space-y-1">
                      {wikiUsername && (
                        <button
                          onClick={() => {
                            onClose();
                            navigateWithBasePath(getWikiProfilePath(wikiUsername), router);
                          }}
                          className="bg-foreground/[0.02] border-separator text-label hover:bg-foreground/[0.04] rounded-control text-caption flex w-full cursor-pointer items-center justify-between border px-3 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                        >
                          <div className="flex items-center gap-2">
                            <User className="text-blue h-3.5 w-3.5" />
                            <span>My Contributions</span>
                          </div>
                          <ChevronRight className="text-label-tertiary h-3.5 w-3.5" />
                        </button>
                      )}
                      {userProfile?.countryId && (
                        <button
                          onClick={() => setView("country-actions")}
                          className="bg-foreground/[0.02] border-separator text-label hover:bg-foreground/[0.04] rounded-control text-caption flex w-full cursor-pointer items-center justify-between border px-3 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="text-yellow h-3.5 w-3.5" />
                            <span>Country Actions</span>
                          </div>
                          <ChevronRight className="text-label-tertiary h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-subhead text-label-secondary">Recent Pages Visited</div>
                    {recentArticles.length === 0 ? (
                      <div className="border-separator bg-foreground/[0.01] text-label-secondary rounded-control text-footnote border py-4 text-center">
                        No pages visited recently
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {recentArticles.slice(0, 3).map((page) => (
                          <button
                            key={pageRefPath(page)}
                            onClick={() => {
                              onClose();
                              restoreSession(page);
                            }}
                            className="bg-foreground/[0.02] border-separator text-label hover:bg-foreground/[0.04] rounded-control text-caption flex w-full cursor-pointer items-center gap-2 border px-3 py-2 text-left font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                          >
                            <History className="text-blue h-3.5 w-3.5" />
                            <span className="truncate">{page.title}</span>
                          </button>
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
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            {/* Country Actions Header */}
            <div className="border-separator mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setView("tabs")}
                  className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control-sm flex h-7 w-7 cursor-pointer items-center justify-center transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex flex-col">
                  <h3 className="text-label text-headline flex items-center gap-1.5">
                    <Crown className="text-yellow h-4 w-4" />
                    Country Management
                  </h3>
                  <span className="text-label-secondary text-caption">{countryName}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-label-secondary hover:text-label hover:bg-fill-4 rounded-control-sm flex h-7 w-7 cursor-pointer items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grid of Actions */}
            <div className="grid grid-cols-2 gap-3 py-1">
              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry", router);
                }}
                className="bg-yellow/15 hover:bg-yellow/25 text-caption text-yellow rounded-row flex cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center transition-[background-color,scale] active:scale-[0.98]"
              >
                <Building2 className="text-yellow h-5 w-5" />
                <span>MyCountry Dashboard</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/executive", router);
                }}
                className="bg-indigo/15 hover:bg-indigo/25 text-caption text-indigo rounded-row flex cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center transition-[background-color,scale] active:scale-[0.98]"
              >
                <ScrollText className="text-indigo h-5 w-5" />
                <span>Executive Actions</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/diplomacy", router);
                }}
                className="rounded-row border-teal/20 bg-teal/10 text-caption text-teal hover:bg-teal/20 flex cursor-pointer flex-col items-center justify-center gap-2 border p-4 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <Handshake className="text-teal h-5 w-5" />
                <span>Manage Diplomacy</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/editor", router);
                }}
                className="rounded-row border-blue/20 bg-blue/10 text-caption text-blue hover:bg-blue/20 flex cursor-pointer flex-col items-center justify-center gap-2 border p-4 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <Map className="text-blue h-5 w-5" />
                <span>Map & Editor</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/vault", router);
                }}
                className="rounded-row border-yellow/20 bg-yellow/10 text-caption text-yellow hover:bg-yellow/20 flex cursor-pointer flex-col items-center justify-center gap-2 border p-4 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <Wallet className="text-yellow h-5 w-5" />
                <span>IxVault Cards</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/politics", router);
                }}
                className="rounded-row border-indigo/20 bg-indigo/10 text-caption text-indigo hover:bg-indigo/20 flex cursor-pointer flex-col items-center justify-center gap-2 border p-4 text-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
              >
                <Scale className="text-indigo h-5 w-5" />
                <span>Politics & Elections</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
