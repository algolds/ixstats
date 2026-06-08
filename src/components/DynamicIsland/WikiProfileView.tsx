import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { navigateWithBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  User,
  Trophy,
  Flame,
  Bookmark,
  ChevronRight,
  X,
  FileText,
  Crown,
  History,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { PreText } from "~/components/ui/pretext";
import { CountryActionsMenu } from "~/components/countries/CountryActionsMenu";
import { cn } from "~/lib/utils";

interface PausedSession {
  title: string;
  scrollPercent: number;
  updatedAt: number;
}

interface WikiProfileViewProps {
  onClose: () => void;
}

export function WikiProfileView({ onClose }: WikiProfileViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const { recentArticles, restoreSession } = useWikiContext();

  const [activeTab, setActiveTab] = useState<"workspace" | "profile">("workspace");
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  const [pausedSessions, setPausedSessions] = useState<PausedSession[]>([]);

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
    <div className="p-4">
      {/* Header */}
      <div className="border-border/50 mb-4 flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-foreground/5 flex gap-1.5 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("workspace")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all select-none",
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
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all select-none",
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
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
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
                        className="flex items-center gap-1 rounded bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600 transition-colors hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300 dark:hover:bg-blue-500/30"
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
          <div className="border-border/50 bg-foreground/[0.02] flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="ring-foreground/15 h-10 w-10 rounded-full object-cover ring-2"
                />
              ) : (
                <div className="bg-foreground/5 flex h-10 w-10 items-center justify-center rounded-full text-base">
                  👤
                </div>
              )}
              <div>
                <div className="text-foreground text-sm font-bold">
                  {wikiUsername || "Wiki Profile"}
                </div>
                <div className="text-muted-foreground/80 text-[10px]">Worldbuilding Editor</div>
              </div>
            </div>

            {lorewardStats && (
              <div className="border-border/50 flex gap-4 border-l pl-4">
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
                        `/w/special/user/${encodeURIComponent(wikiUsername)}`,
                        router
                      );
                    }}
                    className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
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
                    onClick={() => setActionsMenuOpen(true)}
                    className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
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
                      className="bg-foreground/[0.02] border-border/50 text-foreground hover:bg-foreground/[0.04] flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all"
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

      {userProfile?.countryId && userProfile?.country?.name && (
        <CountryActionsMenu
          targetCountryId={userProfile.countryId}
          targetCountryName={userProfile.country.name}
          viewerCountryId={userProfile.countryId}
          isOpen={actionsMenuOpen}
          onClose={() => setActionsMenuOpen(false)}
          isOwnCountry={true}
        />
      )}
    </div>
  );
}
