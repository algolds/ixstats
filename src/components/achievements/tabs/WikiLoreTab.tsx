"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TabsContent } from "~/components/ui/tabs";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { Button } from "~/components/ui/button";
import { CutoutCard, cutoutCardSurfaceClassName } from "~/components/ui/cutout-card";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { WikiLoreDayModal } from "../WikiLoreDayModal";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Trophy,
  Loader2,
  Crown,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpen,
  ExternalLink,
  Code,
  Copy,
  Check,
  Medal,
  Star,
  Shield,
  Award,
  Users,
} from "lucide-react";
import { cn } from "~/lib/utils";

const INFOBOX_TEMPLATE = `{{Infobox nation
| name         = {{PAGENAME}}
| image_flag   = Flag-{{PAGENAME}}.svg
| motto        = "Unity and Progress"
| capital      = Capital City
| population   = 120,000,000
| gdp          = 4.2 Trillion
}}`;

const MEDAL_TEMPLATE = `{{Lore medal|type=silver|user=YourUsername|date=2026-06-08}}`;

const formatSlashRate = (rate: number | null | undefined) => {
  const r = rate || 0;
  if (r >= 1) return "1.000";
  return `.${Math.round(r * 1000).toString().padStart(3, "0")}`;
};

const getCategoryStyles = (cat: string) => {
  switch (cat) {
    case "FEATURED":
      return "bg-amber-500/10 text-amber-500 border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    case "COLLABORATION":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20";
    case "PEER_REVIEW":
      return "bg-green-500/10 text-green-500 border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20";
    case "SPECIAL":
      return "bg-purple-500/10 text-purple-500 border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
    case "EDITOR_MILESTONE":
      return "bg-pink-500/10 text-pink-500 border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";
  }
};

const getCategoryLabel = (cat: string) => {
  switch (cat) {
    case "ALL":
      return "All";
    case "FEATURED":
      return "Featured";
    case "COLLABORATION":
      return "Collaboration";
    case "PEER_REVIEW":
      return "Peer Review";
    case "SPECIAL":
      return "Special";
    case "EDITOR_MILESTONE":
      return "Milestone";
    default:
      return cat.replace("_", " ");
  }
};

const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case "trophy":
      return Trophy;
    case "medal":
      return Medal;
    case "star":
      return Star;
    case "crown":
      return Crown;
    case "shield":
      return Shield;
    case "award":
      return Award;
    case "users":
      return Users;
    case "check":
      return Check;
    case "sparkles":
    default:
      return Sparkles;
  }
};

const getColorClass = (colorName?: string) => {
  switch (colorName) {
    case "amber": return "text-amber-500";
    case "slate": return "text-slate-400";
    case "cyan": return "text-cyan-500";
    case "green": return "text-emerald-500";
    case "purple": return "text-purple-500";
    case "pink": return "text-pink-500";
    case "red": return "text-red-500";
    default: return "text-amber-500";
  }
};

interface WikiArticleAward {
  id: string;
  pageTitle: string;
  pageSlug: string;
  category: string;
  name: string;
  description: string | null;
  recipientUsers: string[];
  awardedAt: string;
  metadata: string | null;
}

interface WikiLoreTabProps {
  ufcLeaderboard: any[] | undefined;
  isUfcLoading: boolean;
  winnersCalendar: any;
  calendarYear: number;
  setCalendarYear: React.Dispatch<React.SetStateAction<number>>;
  calendarMonth: number;
  setCalendarMonth: React.Dispatch<React.SetStateAction<number>>;
  isAdmin: boolean;
}

export function WikiLoreTab({
  ufcLeaderboard,
  isUfcLoading,
  winnersCalendar,
  calendarYear,
  setCalendarYear,
  calendarMonth,
  setCalendarMonth,
  isAdmin,
}: WikiLoreTabProps) {
  const notify = useNotify();
  const [subTab, setSubTab] = useState<"standings" | "calendar" | "awards" | "resources">("standings");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);

  // Awards tab states
  const [awardsSearch, setAwardsSearch] = useState("");
  const [awardsCategory, setAwardsCategory] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: allAwards, isLoading: isAwardsLoading } = api.lorewards.getAllArticleAwards.useQuery({
    limit: 100,
    category: awardsCategory === "ALL" ? undefined : awardsCategory,
  });

  const handleCopyText = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      notify.success("Copied to Clipboard", `${label} template copied successfully.`);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch((err) => {
      console.error("Failed to copy:", err);
    });
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((prev) => prev - 1);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((prev) => prev + 1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  const selectedDayEntry = selectedDay !== null && winnersCalendar ? winnersCalendar[selectedDay] : null;
  const selectedDateStr = selectedDay !== null
    ? `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : "";

  const filteredAwards = (allAwards || [])
    .filter((a: WikiArticleAward) => {
      const matchSearch =
        a.pageTitle.toLowerCase().includes(awardsSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(awardsSearch.toLowerCase()) ||
        a.recipientUsers.some((u: string) => u.toLowerCase().includes(awardsSearch.toLowerCase()));
      const matchCategory = awardsCategory === "ALL" || a.category === awardsCategory;
      return matchSearch && matchCategory;
    });

  return (
    <TabsContent value="wiki-lore" className="space-y-6 outline-none">
      {/* Sub-tabs Navigation */}
      <div className="flex justify-center border-b border-border/40 pb-px dark:border-white/5">
        <div className="flex flex-wrap gap-2 md:gap-4 justify-center">
          {[
            { id: "standings" as const, label: "Standings", icon: Trophy },
            { id: "calendar" as const, label: "Calendar", icon: Calendar },
            { id: "awards" as const, label: "Article Awards", icon: Sparkles },
            { id: "resources" as const, label: "Editor Resources", icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-bold transition-all outline-none",
                  isActive
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SUBTAB: STANDINGS ── */}
      {subTab === "standings" && (
        <div className="space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h3 className="text-foreground text-lg font-black tracking-tight flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top 15 Loremasters
            </h3>
            <p className="text-muted-foreground text-xs">
              The elite ranking of active wiki contributors, evaluated via Daily Wins, Career Bytes, and Total Edits.
            </p>
          </div>

          {isUfcLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-amber-555 h-6 w-6 animate-spin" />
            </div>
          ) : ufcLeaderboard && ufcLeaderboard.length > 0 ? (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Undisputed Champion Card */}
              {(() => {
                const champ = ufcLeaderboard[0];
                if (!champ) return null;
                const champRankScore = Math.round(champ.rankScore);
                return (
                  <div className="relative border border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-card/50 to-background/40 rounded-2xl p-6 shadow-[0_0_25px_rgba(245,158,11,0.08)] backdrop-blur-md overflow-hidden group">
                    {/* Background flag watermark */}
                    {(champ.countryName || champ.username) && (
                      <div className="absolute inset-0 z-0 h-full w-full overflow-hidden pointer-events-none rounded-2xl">
                        <UnifiedCountryFlag
                          countryName={champ.countryName || champ.username}
                          fitContainer={true}
                          showTooltip={false}
                          rounded={false}
                          className="h-full w-full object-cover opacity-12 dark:opacity-[0.08] brightness-[0.6] transition-all duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-background/40 via-transparent to-background/40" />
                      </div>
                    )}
                    {/* Decorative background glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-500" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-600/5 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-amber-500/10 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Crown className="w-8 h-8 text-amber-500 animate-pulse" />
                          </div>
                          <span className="absolute -top-1 -left-1 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md">
                            Champ
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <UnifiedCountryFlag
                              countryName={champ.countryName || champ.username}
                              size="sm"
                              showTooltip={false}
                            />
                            <h4 className="text-xl font-black text-foreground tracking-tight">
                              {champ.username}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Specialty: <span className="text-amber-400 font-bold">{champ.specialty}</span>
                          </p>
                          <div className="text-xs font-mono font-bold text-muted-foreground/80 flex flex-wrap gap-x-3 gap-y-1 mt-1.5 items-center">
                            <span>
                              Record:{" "}
                              <span className="text-foreground font-black" title="Wins - Runner-ups - Major Edits (Edits >= 5KB)">
                                {champ.dailyWins}-{champ.dailyRunnerUps}-{champ.majorEdits || 0}
                              </span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Stats:{" "}
                              <span className="text-amber-500 font-extrabold" title="Major Edit Rate (Edits >= 5KB / Total Edits)">
                                {formatSlashRate(champ.majorEditRate)}
                              </span>
                              <span className="text-muted-foreground/40">/</span>
                              <span className="text-foreground" title="Average Bytes per Edit">
                                {champ.avgBytesPerEdit ? (champ.avgBytesPerEdit >= 1000 ? `${(champ.avgBytesPerEdit / 1000).toFixed(1)}K` : `${champ.avgBytesPerEdit}B`) : "0B"}
                              </span>
                              <span className="text-muted-foreground/40">/</span>
                              <span className="text-red-500 font-extrabold" title="Peak Contribution (Largest Edit)">
                                {champ.largestEdit ? (champ.largestEdit >= 1000 ? `${(champ.largestEdit / 1000).toFixed(0)}K` : `${champ.largestEdit}B`) : "0B"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/60 dark:bg-black/40 p-4 rounded-xl border border-white/40 dark:border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-md relative z-10">
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80 font-black uppercase tracking-wider block">
                            Rank Score
                          </span>
                          <span className="text-lg font-black text-amber-500 font-mono">
                            <NumberFlowDisplay value={champRankScore} decimalPlaces={0} /> pts
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80 font-black uppercase tracking-wider block">
                            Career Edits
                          </span>
                          <span className="text-lg font-black text-foreground font-mono">
                            <NumberFlowDisplay value={champ.totalEdits} decimalPlaces={0} />
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80 font-black uppercase tracking-wider block">
                            Career Bytes
                          </span>
                          <span className="text-lg font-black text-foreground font-mono">
                            <NumberFlowDisplay value={champ.totalBytes || 0} format="compact" />
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground/80 font-black uppercase tracking-wider block">
                            Peak Edit
                          </span>
                          <span className="text-lg font-black text-foreground font-mono">
                            <NumberFlowDisplay value={champ.largestEdit || 0} format="compact" />
                          </span>
                        </div>
                      </div>
                    </div>

                    {champ.lastEditPage && champ.lastEditPage !== "None" && (
                      <div className="mt-4 pt-4 border-t border-border/20 relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2">
                        <div className="text-muted-foreground">
                          Last active in:{" "}
                          <Link
                            href={`/w/${encodeURIComponent(champ.lastEditPage)}`}
                            className="text-amber-400 font-bold hover:underline"
                          >
                            {champ.lastEditPage}
                          </Link>
                        </div>
                        <div className="text-muted-foreground/60 font-medium">
                          Active Date: {champ.lastEditDate}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contenders list */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ufcLeaderboard.slice(1).map((user, idx) => {
                  const rank = idx + 2;
                  const rankScore = Math.round(user.rankScore);
                  const movement = user.rankMovement;

                  return (
                    <CutoutCard
                      key={user.username}
                      className={cn(
                        cutoutCardSurfaceClassName,
                        "border-border/50 bg-card/45 rounded-xl p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/20 hover:shadow-lg flex items-center justify-between group"
                      )}
                      texture="none"
                      trackPointerHover={false}
                    >
                      {/* Background flag watermark */}
                      {(user.countryName || user.username) && (
                        <div className="absolute inset-0 z-0 h-full w-full overflow-hidden pointer-events-none rounded-xl">
                          <UnifiedCountryFlag
                            countryName={user.countryName || user.username}
                            fitContainer={true}
                            showTooltip={false}
                            rounded={false}
                            className="h-full w-full object-cover opacity-[0.06] dark:opacity-[0.04] brightness-[0.75] transition-all duration-500 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-4 w-full relative z-10">
                        {/* Rank + movement */}
                        <div className="flex flex-col items-center justify-center w-10 shrink-0">
                          <span className="text-2xl font-black text-muted-foreground/60 tracking-tight">
                            #{rank}
                          </span>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {movement === "new" ? (
                              <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded uppercase">
                                NEW
                              </span>
                            ) : typeof movement === "number" && movement > 0 ? (
                              <span className="text-emerald-500 text-xs font-bold flex items-center">
                                <ArrowUp className="w-3 h-3" />
                                {movement}
                              </span>
                            ) : typeof movement === "number" && movement < 0 ? (
                              <span className="text-red-500 text-xs font-bold flex items-center">
                                <ArrowDown className="w-3 h-3" />
                                {Math.abs(movement)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">
                                <Minus className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* User details */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <UnifiedCountryFlag
                              countryName={user.countryName || user.username}
                              size="xs"
                              showTooltip={false}
                            />
                            <h5 className="font-bold text-foreground truncate text-sm">
                              {user.username}
                            </h5>
                          </div>

                          <p className="text-[11px] text-muted-foreground truncate">
                            {user.specialty}
                          </p>

                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-mono text-muted-foreground/70">
                            <span>
                              Rec:{" "}
                              <strong className="text-foreground/90" title="Wins - Runner-ups - Major Edits (Edits >= 5KB)">
                                {user.dailyWins}-{user.dailyRunnerUps}-{user.majorEdits || 0}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              Stats:{" "}
                              <strong className="text-amber-500/90 font-extrabold" title="Major Edit Rate">
                                {formatSlashRate(user.majorEditRate)}
                              </strong>
                              <span className="opacity-40">/</span>
                              <strong className="text-foreground/90 font-bold" title="Avg Bytes per Edit">
                                {user.avgBytesPerEdit ? (user.avgBytesPerEdit >= 1000 ? `${(user.avgBytesPerEdit / 1000).toFixed(1)}K` : `${user.avgBytesPerEdit}B`) : "0B"}
                              </strong>
                              <span className="opacity-40">/</span>
                              <strong className="text-red-500 font-extrabold" title="Peak Contribution (Largest Edit)">
                                {user.largestEdit ? (user.largestEdit >= 1000 ? `${(user.largestEdit / 1000).toFixed(0)}K` : `${user.largestEdit}B`) : "0B"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Score: <strong className="text-amber-500 font-bold"><NumberFlowDisplay value={rankScore} decimalPlaces={0} /></strong>
                            </span>
                          </div>

                          {user.lastEditPage && user.lastEditPage !== "None" && (
                            <div className="text-[10px] text-muted-foreground/60 truncate max-w-full">
                              Last active in:{" "}
                              <Link
                                href={`/w/${encodeURIComponent(user.lastEditPage)}`}
                                className="text-amber-500/80 hover:underline hover:text-amber-500"
                              >
                                {user.lastEditPage}
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </CutoutCard>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No contenders standings available. Make wiki edits to get listed!
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB: CALENDAR ── */}
      {subTab === "calendar" && (
        <div className="max-w-5xl mx-auto space-y-4">
          <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
            <TextureCardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border/40 pb-4 dark:border-white/5">
                <div>
                  <h4 className="text-foreground text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    Calendar
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Past daily winners and runners-up for{" "}
                    {(() => {
                      const MONTH_NAMES = [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ];
                      return MONTH_NAMES[calendarMonth - 1];
                    })()}{" "}
                    {calendarYear}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-8 w-8 border-border/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-bold min-w-[100px] text-center">
                    {(() => {
                      const MONTH_NAMES = [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ];
                      return MONTH_NAMES[calendarMonth - 1];
                    })()}{" "}
                    {calendarYear}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-8 w-8 border-border/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {(() => {
                const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
                const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m - 1, 1).getDay();
                const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
                const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth);

                const cells = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push({ type: "empty" as const, key: `empty-${i}` });
                }
                for (let day = 1; day <= daysInMonth; day++) {
                  const entry = winnersCalendar ? winnersCalendar[day] : null;
                  cells.push({
                    type: "day" as const,
                    day,
                    entry,
                    key: `day-${day}`,
                  });
                }

                const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      {weekDays.map((wd) => (
                        <div key={wd} className="py-1">
                          {wd}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {cells.map((cell) => {
                        if (cell.type === "empty") {
                          return (
                            <div
                              key={cell.key}
                              className="h-24 rounded-lg bg-black/5 dark:bg-black/15 opacity-30 border border-transparent"
                            />
                          );
                        }

                        const day = cell.day!;
                        const entry = cell.entry;
                        const isWinner = !!entry?.winnerUser;

                        return (
                          <button
                            key={cell.key}
                            onClick={() => {
                              setSelectedDay(day);
                              setCalendarModalOpen(true);
                            }}
                            className={cn(
                              "h-24 rounded-xl p-2 text-left flex flex-col justify-between border transition-all duration-200 select-none relative overflow-hidden group",
                              isWinner
                                ? "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 hover:shadow-md hover:-translate-y-0.5"
                                : "border-border/40 bg-card/30 hover:border-border/80 hover:bg-card/50"
                            )}
                          >
                            {/* Background flag watermark */}
                            {isWinner && (entry.winnerCountryName || entry.winnerUser) && (
                              <div className="absolute inset-0 z-0 h-full w-full overflow-hidden pointer-events-none rounded-xl">
                                <UnifiedCountryFlag
                                  countryName={entry.winnerCountryName || entry.winnerUser}
                                  fitContainer={true}
                                  showTooltip={false}
                                  rounded={false}
                                  className="h-full w-full object-cover opacity-[0.06] dark:opacity-[0.04] brightness-[0.75] transition-all duration-500 group-hover:scale-105"
                                />
                              </div>
                            )}

                            <span
                              className={cn(
                                "text-xs font-black font-mono relative z-10",
                                isWinner ? "text-amber-500" : "text-muted-foreground"
                              )}
                            >
                              {day}
                            </span>

                            {isWinner ? (
                              <div className="space-y-1 w-full min-w-0 relative z-10">
                                <div className="flex items-center gap-1 min-w-0">
                                  <UnifiedCountryFlag
                                    countryName={entry.winnerCountryName || entry.winnerUser!}
                                    size="xs"
                                    showTooltip={false}
                                  />
                                  <span className="text-[10px] font-bold text-foreground truncate block flex-1">
                                    {entry.winnerUser}
                                  </span>
                                </div>
                                {entry.winnerPage && (
                                  <span className="text-[9px] text-amber-500/80 font-medium truncate block leading-none">
                                    {entry.winnerPage}
                                  </span>
                                )}
                                {entry.winnerScore !== null && (
                                  <span className="text-[8px] font-mono text-muted-foreground block">
                                    Score: {entry.winnerScore}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-muted-foreground/40 italic relative z-10">
                                No winner
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </TextureCardContent>
          </TextureCard>
        </div>
      )}

      {/* ── SUBTAB: ARTICLE AWARDS ── */}
      {subTab === "awards" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4 dark:border-white/5">
            <div>
              <h4 className="text-foreground text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Article Awards & Milestones
              </h4>
              <p className="text-muted-foreground text-xs">
                Explore recognized articles, collaborations, and community milestones.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={awardsSearch}
                  onChange={(e) => setAwardsSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-black/10 dark:bg-black/35 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 w-48"
                />
              </div>
              <div className="flex flex-wrap rounded-lg border border-border/50 bg-black/10 p-0.5 dark:bg-black/35">
                {["ALL", "FEATURED", "COLLABORATION", "PEER_REVIEW", "SPECIAL", "EDITOR_MILESTONE"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAwardsCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                      awardsCategory === cat
                        ? "bg-amber-500 text-black shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isAwardsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-amber-555 h-6 w-6 animate-spin" />
            </div>
          ) : filteredAwards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAwards.map((a: WikiArticleAward) => (
                <CutoutCard
                  key={a.id}
                  className={cn(
                    cutoutCardSurfaceClassName,
                    "border-border/50 bg-card/45 rounded-xl p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/20 hover:shadow-lg flex flex-col justify-between"
                  )}
                  texture="none"
                  trackPointerHover={false}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider", getCategoryStyles(a.category))}>
                        {getCategoryLabel(a.category)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(a.awardedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {(() => {
                        let iconName = "sparkles";
                        let colorVal = "amber";
                        let customStyle: React.CSSProperties = {};
                        let isCustomHex = false;

                        if (a.metadata) {
                          try {
                            const meta = JSON.parse(a.metadata);
                            if (meta.icon) iconName = meta.icon;
                            if (meta.color) {
                              colorVal = meta.color;
                              if (colorVal.startsWith("#")) {
                                isCustomHex = true;
                                customStyle = { color: colorVal };
                              }
                            }
                          } catch (e) {
                            // ignore
                          }
                        }

                        // Fallback defaults based on category if metadata doesn't exist
                        if (!a.metadata) {
                          if (a.category === "FEATURED") {
                            iconName = "trophy";
                            colorVal = "amber";
                          } else if (a.category === "COLLABORATION") {
                            iconName = "users";
                            colorVal = "cyan";
                          } else if (a.category === "PEER_REVIEW") {
                            iconName = "check";
                            colorVal = "green";
                          } else if (a.category === "SPECIAL") {
                            iconName = "star";
                            colorVal = "purple";
                          } else {
                            iconName = "sparkles";
                            colorVal = "pink";
                          }
                        }

                        const IconComp = getIconComponent(iconName);

                        return (
                          <h5 className="font-extrabold text-foreground text-sm tracking-tight flex items-center gap-2">
                            <IconComp
                              className={cn("w-4.5 h-4.5 shrink-0", !isCustomHex && getColorClass(colorVal))}
                              style={customStyle}
                            />
                            {a.name}
                          </h5>
                        );
                      })()}
                      <Link
                        href={`/w/${a.pageSlug}`}
                        className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1 group w-fit"
                      >
                        {a.pageTitle}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </div>

                    {a.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {a.description}
                      </p>
                    )}
                  </div>

                  {a.recipientUsers && a.recipientUsers.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/20 dark:border-white/5 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        Contributors:
                      </span>
                      {a.recipientUsers.map((u: string) => (
                        <span key={u} className="px-2 py-0.5 rounded bg-muted/30 text-foreground text-[10px] font-semibold border border-border/10">
                          {u}
                        </span>
                      ))}
                    </div>
                  )}
                </CutoutCard>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No matching article awards found.
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB: EDITOR RESOURCES ── */}
      {subTab === "resources" && (
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="border-b border-border/40 pb-4 dark:border-white/5">
            <h4 className="text-foreground text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" />
              Editor Resources & Scoring Guide
            </h4>
            <p className="text-muted-foreground text-xs">
              Cheatsheets, guidelines, templates, and formulas to help you write high-quality lore edits.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Quick Links & Scoring Guide */}
            <div className="lg:col-span-2 space-y-6">
              {/* Scoring Guide Card */}
              <TextureCard className="border-border/40 bg-card/40 backdrop-blur-md">
                <TextureCardContent className="p-5 space-y-4">
                  <h5 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    How Wiki Contributions Are Scored
                  </h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Lore points and rankings are calculated using database records from MediaWiki. The scoring system incentivizes both high frequency and structural depth (large edits).
                  </p>

                  <div className="space-y-3 bg-card/40 border border-border/30 rounded-xl p-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">
                        Rank Score Formula
                      </span>
                      <div className="font-mono text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20 leading-relaxed overflow-x-auto whitespace-pre shadow-[inset_0_1px_1px_rgba(245,158,11,0.05)]">
{`Rank Score = (Wins * 100) + (Runner-Ups * 40) + (Current Streak * 15) 
             + (Total Bytes * 0.01) + (Largest Edit * 0.05)`}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="text-xs space-y-1">
                        <strong className="text-foreground block font-bold">Daily Wins (+100 pts)</strong>
                        <span className="text-muted-foreground leading-snug block">
                          Awarded to the top edit of the day. Evaluated dynamically by the scoring cron.
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        <strong className="text-foreground block font-bold">Major Edit Rate (MER)</strong>
                        <span className="text-muted-foreground leading-snug block">
                          Percentage of edits exceeding 5,000 bytes. Displayed as a batting average (e.g. <code className="bg-muted-foreground/10 px-1.5 py-0.5 rounded font-mono text-[10.5px] text-amber-600 dark:text-amber-400 border border-border/20">.125</code>).
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h6 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Lore Medal Upgrades
                    </h6>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-500/5 border border-slate-500/20 rounded-lg p-2.5 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-extrabold block">Silver Medal</span>
                        <span className="text-muted-foreground text-[10px]">10 Bronze Medals</span>
                      </div>
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 text-xs">
                        <span className="text-amber-500 font-extrabold block">Gold Medal</span>
                        <span className="text-muted-foreground text-[10px]">5 Silver Medals</span>
                      </div>
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5 text-xs">
                        <span className="text-purple-500 dark:text-purple-400 font-extrabold block">Burg Cross</span>
                        <span className="text-muted-foreground text-[10px]">5 Gold Medals</span>
                      </div>
                    </div>
                  </div>
                </TextureCardContent>
              </TextureCard>

              {/* Template Cheatsheet */}
              <TextureCard className="border-border/40 bg-card/40 backdrop-blur-md">
                <TextureCardContent className="p-5 space-y-4">
                  <h5 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                    <Code className="h-4 w-4 text-amber-500" />
                    Common Wiki Templates
                  </h5>
                  <p className="text-xs text-muted-foreground">
                    Copy-paste markdown/wikitext markup for standard infoboxes and indicators.
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-1.5 relative group/code">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-bold">1. Infobox Nation</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Wikitext</span>
                      </div>
                      <div className="relative">
                        <pre className="text-[11px] font-mono bg-muted/30 dark:bg-black/40 text-foreground/90 p-3.5 rounded-xl border border-border/45 overflow-x-auto pr-12 leading-relaxed shadow-inner">
{INFOBOX_TEMPLATE}
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                          onClick={() => handleCopyText(INFOBOX_TEMPLATE, "infobox", "Infobox Nation")}
                        >
                          {copiedId === "infobox" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5 relative group/code">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-bold">2. Lore Medal Ribbon</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Wikitext</span>
                      </div>
                      <div className="relative">
                        <pre className="text-[11px] font-mono bg-muted/30 dark:bg-black/40 text-foreground/90 p-3.5 rounded-xl border border-border/45 overflow-x-auto pr-12 leading-relaxed shadow-inner">
{MEDAL_TEMPLATE}
                        </pre>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all"
                          onClick={() => handleCopyText(MEDAL_TEMPLATE, "medal", "Lore Medal")}
                        >
                          {copiedId === "medal" ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TextureCardContent>
              </TextureCard>
            </div>

            {/* Right Column: Quick Links & Editing Rules */}
            <div className="space-y-6">
              {/* Quick Links Card */}
              <CutoutCard
                className={cn(
                  cutoutCardSurfaceClassName,
                  "border-border/50 bg-card/45 rounded-xl p-5 backdrop-blur-md"
                )}
                texture="none"
                trackPointerHover={false}
              >
                <h5 className="font-extrabold text-foreground text-sm mb-4 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-amber-500" />
                  Quick Wiki Links
                </h5>
                <div className="space-y-2">
                  {[
                    { title: "Wiki Main Page", href: "/w/Main_Page" },
                    { title: "Style Guidelines", href: "/w/Style_Guide" },
                    { title: "Sandbox Testing", href: "/w/Sandbox" },
                    { title: "Recent Changes", href: "/w/Special:RecentChanges" },
                    { title: "Lore Sandbox Editor", href: "/mycountry/editor" },
                  ].map((link) => (
                    <Link
                      key={link.title}
                      href={link.href}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/20 bg-muted/30 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all font-bold group"
                    >
                      {link.title}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </CutoutCard>

              {/* Editing Guidelines */}
              <CutoutCard
                className={cn(
                  cutoutCardSurfaceClassName,
                  "border-border/50 bg-card/45 rounded-xl p-5 backdrop-blur-md"
                )}
                texture="none"
                trackPointerHover={false}
              >
                <h5 className="font-extrabold text-foreground text-sm mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Lore Quality Rules
                </h5>
                <ul className="text-xs text-muted-foreground space-y-3 list-disc pl-4 leading-relaxed">
                  <li>
                    <strong className="text-foreground">Neutral Point of View:</strong> Always write from a neutral third-person perspective.
                  </li>
                  <li>
                    <strong className="text-foreground">Citations & Verification:</strong> Cite relevant nation builder decisions, diplomacy events, or intelligence briefs.
                  </li>
                  <li>
                    <strong className="text-foreground">Formatting:</strong> Use standard header hierarchies (<code className="bg-muted-foreground/10 px-1.5 py-0.5 rounded font-mono text-[10.5px] text-amber-600 dark:text-amber-400 border border-border/20">== Header ==</code>) and infoboxes.
                  </li>
                  <li>
                    <strong className="text-foreground">Anti-Plagiarism:</strong> Do not copy paste massive chunks of unedited external text. Original nation-building details only.
                  </li>
                </ul>
              </CutoutCard>
            </div>
          </div>
        </div>
      )}

      {/* Day Details Modal */}
      <WikiLoreDayModal
        isOpen={calendarModalOpen}
        onClose={() => {
          setCalendarModalOpen(false);
          setSelectedDay(null);
        }}
        dateStr={selectedDateStr}
        entry={selectedDayEntry}
        isAdmin={isAdmin}
      />
    </TabsContent>
  );
}
