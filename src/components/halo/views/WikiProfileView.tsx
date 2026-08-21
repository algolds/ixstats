import React, { useState, useEffect } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  Trophy,
  Flame,
  ChevronRight,
  X,
  FileText,
  Crown,
  History,
  ArrowLeft,
  Building2,
  ScrollText,
  Handshake,
  Map,
  Wallet,
  Scale,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import * as LucideIcons from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PausedSession {
  title: string;
  scrollPercent: number;
  updatedAt: number;
}

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
  const CrownIcon = (LucideIcons as any)[chatBadge?.icon ?? ""] || Crown;

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

  const handleResumeSession = (title: string) => {
    onClose();
    restoreSession(title);
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
            <div className="border-border/50 mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-foreground/5 flex gap-1.5 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab("workspace")}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all select-none",
                      activeTab === "workspace"
                        ? "bg-foreground/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Workspace</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all select-none",
                      activeTab === "profile"
                        ? "bg-foreground/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Wiki Profile</span>
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            {activeTab === "workspace" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left Column: Paused/Saved Sessions */}
                <div className="space-y-3">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
                    <History className="h-3 w-3" />
                    <span>Saved & Paused Sessions</span>
                  </div>

                  {pausedSessions.length === 0 ? (
                    <div className="border-foreground/30 bg-foreground/[0.02] flex flex-col items-center justify-center rounded-xl border px-4 py-8 text-center">
                      <BookOpen className="text-muted-foreground/45 mb-2 h-6 w-6" />
                      <span className="text-muted-foreground text-xs">No paused sessions yet</span>
                      <span className="text-muted-foreground/60 mt-1 text-[10px]">
                        Your reading/editing progress will appear here.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pausedSessions.map((session) => (
                        <div
                          key={session.title}
                          className="border-foreground/30 bg-foreground/[0.02] hover:bg-foreground/[0.04] flex flex-col gap-2 rounded-xl border p-3 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-foreground truncate text-xs font-semibold">
                              {session.title}
                            </span>
                            <button
                              onClick={() => handleResumeSession(session.title)}
                              className="flex cursor-pointer items-center gap-1 rounded bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
                            >
                              Resume
                            </button>
                          </div>
                          {/* Progress indicator */}
                          <div className="flex items-center gap-2">
                            <div className="bg-foreground/10 h-1 flex-1 rounded-full">
                              <div
                                className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                                style={{ width: `${session.scrollPercent}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground text-[9px] font-bold tabular-nums">
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
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
                    <FileText className="h-3 w-3" />
                    <span>Wiki Scratchpad</span>
                  </div>
                  <div className="relative flex-1">
                    <textarea
                      value={scratchpad}
                      onChange={handleScratchpadChange}
                      placeholder="Jot down quick worldbuilding notes, drafts, task lists, or article revisions here... (auto-saves)"
                      className="border-foreground/30 bg-foreground/[0.02] text-foreground placeholder:text-muted-foreground/55 focus:border-foreground/50 focus:bg-foreground/[0.03] min-h-[140px] w-full resize-none rounded-xl border p-3 text-xs transition-all focus:outline-none"
                      style={{ scrollbarWidth: "thin" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-4">
                {/* Wiki Profile Stats */}
                <div className="border-border/50 bg-foreground/[0.02] relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl border p-4">
                  {/* Neon Frame Overlay */}
                  <NeonFrameOverlay neonFrame={neonFrame} className="rounded-xl" />

                  <div className="relative z-10 flex items-center gap-3">
                    <AvatarGlow
                      avatarGlow={avatarGlow}
                      roundedClass="rounded-full"
                      className="h-10 w-10 bg-indigo-950/60 shadow-md"
                    >
                      {user?.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="bg-foreground/5 flex h-full w-full items-center justify-center rounded-full text-base">
                          👤
                        </div>
                      )}
                    </AvatarGlow>
                    <div>
                      <div className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                        <span>{wikiUsername || "Wiki Profile"}</span>
                        {chatBadge.enabled && (
                          <CrownIcon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: chatBadge.color }}
                          />
                        )}
                      </div>
                      <div className="text-muted-foreground/80 text-[10px]">
                        Worldbuilding Editor
                      </div>
                    </div>
                  </div>

                  {lorewardStats && (
                    <div className="border-border/50 relative z-10 flex gap-4 border-l pl-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="h-4 w-4 text-amber-500" />
                          <span className="text-foreground text-sm font-bold">
                            {lorewardStats.stats?.totalScore ?? 0}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                          Score
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-4 w-4 text-orange-500" />
                          <span className="text-foreground text-sm font-bold">
                            {lorewardStats.stats?.currentStreak ?? 0}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
                          Streak
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Actions & Recent */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Quick Actions
                    </div>
                    <div className="space-y-1">
                      {wikiUsername && (
                        <button
                          onClick={() => {
                            onClose();
                            navigateWithBasePath(
                              `/wiki/user/${encodeURIComponent(wikiUsername)}`,
                              router
                            );
                          }}
                          className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-blue-500" />
                            <span>My Contributions</span>
                          </div>
                          <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
                        </button>
                      )}
                      {userProfile?.countryId && (
                        <button
                          onClick={() => setView("country-actions")}
                          className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <Crown className="h-3.5 w-3.5 text-amber-500" />
                            <span>Country Actions</span>
                          </div>
                          <ChevronRight className="text-muted-foreground/50 h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Recent Pages Visited
                    </div>
                    {recentArticles.length === 0 ? (
                      <div className="border-border/50 bg-foreground/[0.01] text-muted-foreground/75 rounded-lg border py-4 text-center text-xs">
                        No pages visited recently
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {recentArticles.slice(0, 3).map((title) => (
                          <button
                            key={title}
                            onClick={() => {
                              onClose();
                              restoreSession(title);
                            }}
                            className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all"
                          >
                            <History className="h-3.5 w-3.5 text-blue-500" />
                            <span className="truncate">{title}</span>
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
            <div className="border-border/50 mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setView("tabs")}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex flex-col">
                  <h3 className="text-foreground flex items-center gap-1.5 text-sm font-bold">
                    <Crown className="h-4 w-4 text-amber-400" />
                    Country Management
                  </h3>
                  <span className="text-muted-foreground/60 text-[10px] font-semibold">
                    {countryName}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
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
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-orange-500/15 p-4 text-center text-xs font-semibold text-amber-300 transition-all hover:from-amber-500/25 hover:to-orange-500/25 active:scale-95"
              >
                <Building2 className="h-5 w-5 text-amber-400" />
                <span>MyCountry Dashboard</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/executive", router);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 p-4 text-center text-xs font-semibold text-indigo-300 transition-all hover:from-indigo-500/25 hover:to-violet-500/25 active:scale-95"
              >
                <ScrollText className="h-5 w-5 text-indigo-400" />
                <span>Executive Actions</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/diplomacy", router);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/15 to-fuchsia-500/15 p-4 text-center text-xs font-semibold text-purple-300 transition-all hover:from-purple-500/25 hover:to-fuchsia-500/25 active:scale-95"
              >
                <Handshake className="h-5 w-5 text-purple-400" />
                <span>Manage Diplomacy</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/editor", router);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/15 to-blue-500/15 p-4 text-center text-xs font-semibold text-sky-300 transition-all hover:from-sky-500/25 hover:to-blue-500/25 active:scale-95"
              >
                <Map className="h-5 w-5 text-sky-400" />
                <span>Map & Editor</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/vault", router);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 to-rose-500/15 p-4 text-center text-xs font-semibold text-pink-300 transition-all hover:from-pink-500/25 hover:to-rose-500/25 active:scale-95"
              >
                <Wallet className="h-5 w-5 text-pink-400" />
                <span>IxVault Cards</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigateWithBasePath("/mycountry/politics", router);
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-teal-500/20 bg-gradient-to-br from-teal-500/15 to-emerald-500/15 p-4 text-center text-xs font-semibold text-teal-300 transition-all hover:from-teal-500/25 hover:to-emerald-500/25 active:scale-95"
              >
                <Scale className="h-5 w-5 text-teal-400" />
                <span>Politics & Elections</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
