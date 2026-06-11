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
  return `.${Math.round(r * 1000)
    .toString()
    .padStart(3, "0")}`;
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
    case "amber":
      return "text-amber-500";
    case "slate":
      return "text-slate-400";
    case "cyan":
      return "text-cyan-500";
    case "green":
      return "text-emerald-500";
    case "purple":
      return "text-purple-500";
    case "pink":
      return "text-pink-500";
    case "red":
      return "text-red-500";
    default:
      return "text-amber-500";
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
  const [subTab, setSubTab] = useState<"standings" | "calendar" | "awards" | "resources">(
    "standings"
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState<boolean>(false);

  // Awards tab states
  const [awardsSearch, setAwardsSearch] = useState("");
  const [awardsCategory, setAwardsCategory] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: allAwards, isLoading: isAwardsLoading } =
    api.lorewards.getAllArticleAwards.useQuery({
      limit: 100,
      category: awardsCategory === "ALL" ? undefined : awardsCategory,
    });

  const handleCopyText = (text: string, id: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(id);
        notify.success("Copied to Clipboard", `${label} template copied successfully.`);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
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

  const selectedDayEntry =
    selectedDay !== null && winnersCalendar ? winnersCalendar[selectedDay] : null;
  const selectedDateStr =
    selectedDay !== null
      ? `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
      : "";

  const filteredAwards = (allAwards || []).filter((a: WikiArticleAward) => {
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
      <div className="border-border/40 flex justify-center border-b pb-px dark:border-white/5">
        <div className="flex flex-wrap justify-center gap-2 md:gap-4">
          {[
            { id: "standings" as const, label: "Standings", icon: Trophy },
            { id: "calendar" as const, label: "Calendar", icon: Calendar },
            { id: "awards" as const, label: "Article Awards", icon: Sparkles },
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
                    : "text-muted-foreground hover:text-foreground border-transparent"
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
          <div className="mx-auto max-w-xl space-y-1 text-center">
            <h3 className="text-foreground flex items-center justify-center gap-2 text-lg font-black tracking-tight">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top 15 Loremasters
            </h3>
            <p className="text-muted-foreground text-xs">
              The elite ranking of active wiki contributors, evaluated via Daily Wins, Career Bytes,
              and Total Edits.
            </p>
          </div>

          {isUfcLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-amber-555 h-6 w-6 animate-spin" />
            </div>
          ) : ufcLeaderboard && ufcLeaderboard.length > 0 ? (
            <div className="mx-auto max-w-5xl space-y-6">
              {/* Undisputed Champion Card */}
              {(() => {
                const champ = ufcLeaderboard[0];
                if (!champ) return null;
                const champRankScore = Math.round(champ.rankScore);
                return (
                  <div className="via-card/50 to-background/40 group relative overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/15 p-6 shadow-[0_0_25px_rgba(245,158,11,0.08)] backdrop-blur-md">
                    {/* Background flag watermark */}
                    {(champ.countryName || champ.username) && (
                      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden rounded-2xl">
                        <UnifiedCountryFlag
                          countryName={champ.countryName || champ.username}
                          fitContainer={true}
                          showTooltip={false}
                          rounded={false}
                          className="h-full w-full object-cover opacity-12 brightness-[0.6] transition-all duration-500 group-hover:scale-105 dark:opacity-[0.08]"
                        />
                        <div className="from-background/40 to-background/40 absolute inset-0 bg-gradient-to-r via-transparent" />
                      </div>
                    )}
                    {/* Decorative background glow */}
                    <div className="pointer-events-none absolute top-0 right-0 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl transition-colors duration-500 group-hover:bg-amber-500/10" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-amber-600/5 blur-2xl" />

                    <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20">
                            <Crown className="h-8 w-8 animate-pulse text-amber-500" />
                          </div>
                          <span className="absolute -top-1 -left-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black tracking-wider text-black uppercase shadow-md">
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
                            <h4 className="text-foreground text-xl font-black tracking-tight">
                              {champ.username}
                            </h4>
                          </div>
                          <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            Specialty:{" "}
                            <span className="font-bold text-amber-400">{champ.specialty}</span>
                          </p>
                          <div className="text-muted-foreground/80 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs font-bold">
                            <span>
                              Record:{" "}
                              <span
                                className="text-foreground font-black"
                                title="Wins - Runner-ups - Major Edits (Edits >= 5KB)"
                              >
                                {champ.dailyWins}-{champ.dailyRunnerUps}-{champ.majorEdits || 0}
                              </span>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              Stats:{" "}
                              <span
                                className="font-extrabold text-amber-500"
                                title="Major Edit Rate (Edits >= 5KB / Total Edits)"
                              >
                                {formatSlashRate(champ.majorEditRate)}
                              </span>
                              <span className="text-muted-foreground/40">/</span>
                              <span className="text-foreground" title="Average Bytes per Edit">
                                {champ.avgBytesPerEdit
                                  ? champ.avgBytesPerEdit >= 1000
                                    ? `${(champ.avgBytesPerEdit / 1000).toFixed(1)}K`
                                    : `${champ.avgBytesPerEdit}B`
                                  : "0B"}
                              </span>
                              <span className="text-muted-foreground/40">/</span>
                              <span
                                className="font-extrabold text-red-500"
                                title="Peak Contribution (Largest Edit)"
                              >
                                {champ.largestEdit
                                  ? champ.largestEdit >= 1000
                                    ? `${(champ.largestEdit / 1000).toFixed(0)}K`
                                    : `${champ.largestEdit}B`
                                  : "0B"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 grid grid-cols-2 gap-4 rounded-xl border border-white/40 bg-white/60 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] backdrop-blur-md sm:grid-cols-4 dark:border-white/10 dark:bg-black/40">
                        <div className="text-center sm:text-left">
                          <span className="text-muted-foreground dark:text-muted-foreground/80 block text-[10px] font-black tracking-wider uppercase">
                            Rank Score
                          </span>
                          <span className="font-mono text-lg font-black text-amber-500">
                            <NumberFlowDisplay value={champRankScore} decimalPlaces={0} /> pts
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-muted-foreground dark:text-muted-foreground/80 block text-[10px] font-black tracking-wider uppercase">
                            Career Edits
                          </span>
                          <span className="text-foreground font-mono text-lg font-black">
                            <NumberFlowDisplay value={champ.totalEdits} decimalPlaces={0} />
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-muted-foreground dark:text-muted-foreground/80 block text-[10px] font-black tracking-wider uppercase">
                            Career Bytes
                          </span>
                          <span className="text-foreground font-mono text-lg font-black">
                            <NumberFlowDisplay value={champ.totalBytes || 0} format="compact" />
                          </span>
                        </div>
                        <div className="text-center sm:text-left">
                          <span className="text-muted-foreground dark:text-muted-foreground/80 block text-[10px] font-black tracking-wider uppercase">
                            Peak Edit
                          </span>
                          <span className="text-foreground font-mono text-lg font-black">
                            <NumberFlowDisplay value={champ.largestEdit || 0} format="compact" />
                          </span>
                        </div>
                      </div>
                    </div>

                    {champ.lastEditPage && champ.lastEditPage !== "None" && (
                      <div className="border-border/20 relative z-10 mt-4 flex flex-col gap-2 border-t pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-muted-foreground">
                          Last active in:{" "}
                          <Link
                            href={`/w/${encodeURIComponent(champ.lastEditPage)}`}
                            className="font-bold text-amber-400 hover:underline"
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {ufcLeaderboard.slice(1).map((user, idx) => {
                  const rank = idx + 2;
                  const rankScore = Math.round(user.rankScore);
                  const movement = user.rankMovement;

                  return (
                    <CutoutCard
                      key={user.username}
                      className={cn(
                        cutoutCardSurfaceClassName,
                        "border-border/50 bg-card/45 group flex items-center justify-between rounded-xl p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/20 hover:shadow-lg"
                      )}
                      texture="none"
                      trackPointerHover={false}
                    >
                      {/* Background flag watermark */}
                      {(user.countryName || user.username) && (
                        <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden rounded-xl">
                          <UnifiedCountryFlag
                            countryName={user.countryName || user.username}
                            fitContainer={true}
                            showTooltip={false}
                            rounded={false}
                            className="h-full w-full object-cover opacity-[0.06] brightness-[0.75] transition-all duration-500 group-hover:scale-105 dark:opacity-[0.04]"
                          />
                        </div>
                      )}
                      <div className="relative z-10 flex w-full items-center gap-4">
                        {/* Rank + movement */}
                        <div className="flex w-10 shrink-0 flex-col items-center justify-center">
                          <span className="text-muted-foreground/60 text-2xl font-black tracking-tight">
                            #{rank}
                          </span>
                          <div className="mt-0.5 flex items-center gap-0.5">
                            {movement === "new" ? (
                              <span className="py-0.2 rounded bg-emerald-500/10 px-1 text-[9px] font-black text-emerald-500 uppercase">
                                NEW
                              </span>
                            ) : typeof movement === "number" && movement > 0 ? (
                              <span className="flex items-center text-xs font-bold text-emerald-500">
                                <ArrowUp className="h-3 w-3" />
                                {movement}
                              </span>
                            ) : typeof movement === "number" && movement < 0 ? (
                              <span className="flex items-center text-xs font-bold text-red-500">
                                <ArrowDown className="h-3 w-3" />
                                {Math.abs(movement)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">
                                <Minus className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* User details */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <UnifiedCountryFlag
                              countryName={user.countryName || user.username}
                              size="xs"
                              showTooltip={false}
                            />
                            <h5 className="text-foreground truncate text-sm font-bold">
                              {user.username}
                            </h5>
                          </div>

                          <p className="text-muted-foreground truncate text-[11px]">
                            {user.specialty}
                          </p>

                          <div className="text-muted-foreground/70 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px]">
                            <span>
                              Rec:{" "}
                              <strong
                                className="text-foreground/90"
                                title="Wins - Runner-ups - Major Edits (Edits >= 5KB)"
                              >
                                {user.dailyWins}-{user.dailyRunnerUps}-{user.majorEdits || 0}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              Stats:{" "}
                              <strong
                                className="font-extrabold text-amber-500/90"
                                title="Major Edit Rate"
                              >
                                {formatSlashRate(user.majorEditRate)}
                              </strong>
                              <span className="opacity-40">/</span>
                              <strong
                                className="text-foreground/90 font-bold"
                                title="Avg Bytes per Edit"
                              >
                                {user.avgBytesPerEdit
                                  ? user.avgBytesPerEdit >= 1000
                                    ? `${(user.avgBytesPerEdit / 1000).toFixed(1)}K`
                                    : `${user.avgBytesPerEdit}B`
                                  : "0B"}
                              </strong>
                              <span className="opacity-40">/</span>
                              <strong
                                className="font-extrabold text-red-500"
                                title="Peak Contribution (Largest Edit)"
                              >
                                {user.largestEdit
                                  ? user.largestEdit >= 1000
                                    ? `${(user.largestEdit / 1000).toFixed(0)}K`
                                    : `${user.largestEdit}B`
                                  : "0B"}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Score:{" "}
                              <strong className="font-bold text-amber-500">
                                <NumberFlowDisplay value={rankScore} decimalPlaces={0} />
                              </strong>
                            </span>
                          </div>

                          {user.lastEditPage && user.lastEditPage !== "None" && (
                            <div className="text-muted-foreground/60 max-w-full truncate text-[10px]">
                              Last active in:{" "}
                              <Link
                                href={`/w/${encodeURIComponent(user.lastEditPage)}`}
                                className="text-amber-500/80 hover:text-amber-500 hover:underline"
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
            <div className="text-muted-foreground py-8 text-center text-xs">
              No contenders standings available. Make wiki edits to get listed!
            </div>
          )}
        </div>
      )}

      {/* ── SUBTAB: CALENDAR ── */}
      {subTab === "calendar" && (
        <div className="mx-auto max-w-5xl space-y-4">
          <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
            <TextureCardContent className="space-y-4 p-6">
              <div className="border-border/40 flex items-center justify-between border-b pb-4 dark:border-white/5">
                <div>
                  <h4 className="text-foreground flex items-center gap-2 text-sm font-black tracking-wider uppercase">
                    <Calendar className="h-4 w-4 text-amber-500" />
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
                    className="border-border/50 h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[100px] text-center text-xs font-bold">
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
                    className="border-border/50 h-8 w-8"
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
                    <div className="text-muted-foreground grid grid-cols-7 gap-2 text-center text-[10px] font-black tracking-wider uppercase">
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
                              className="h-24 rounded-lg border border-transparent bg-black/5 opacity-30 dark:bg-black/15"
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
                              "group relative flex h-24 flex-col justify-between overflow-hidden rounded-xl border p-2 text-left transition-all duration-200 select-none",
                              isWinner
                                ? "border-amber-500/25 bg-amber-500/5 hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-amber-500/10 hover:shadow-md"
                                : "border-border/40 bg-card/30 hover:border-border/80 hover:bg-card/50"
                            )}
                          >
                            {/* Background flag watermark */}
                            {isWinner && (entry.winnerCountryName || entry.winnerUser) && (
                              <div className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden rounded-xl">
                                <UnifiedCountryFlag
                                  countryName={entry.winnerCountryName || entry.winnerUser}
                                  fitContainer={true}
                                  showTooltip={false}
                                  rounded={false}
                                  className="h-full w-full object-cover opacity-[0.06] brightness-[0.75] transition-all duration-500 group-hover:scale-105 dark:opacity-[0.04]"
                                />
                              </div>
                            )}

                            <span
                              className={cn(
                                "relative z-10 font-mono text-xs font-black",
                                isWinner ? "text-amber-500" : "text-muted-foreground"
                              )}
                            >
                              {day}
                            </span>

                            {isWinner ? (
                              <div className="relative z-10 w-full min-w-0 space-y-1">
                                <div className="flex min-w-0 items-center gap-1">
                                  <UnifiedCountryFlag
                                    countryName={entry.winnerCountryName || entry.winnerUser!}
                                    size="xs"
                                    showTooltip={false}
                                  />
                                  <span className="text-foreground block flex-1 truncate text-[10px] font-bold">
                                    {entry.winnerUser}
                                  </span>
                                </div>
                                {entry.winnerPage && (
                                  <span className="block truncate text-[9px] leading-none font-medium text-amber-500/80">
                                    {entry.winnerPage}
                                  </span>
                                )}
                                {entry.winnerScore !== null && (
                                  <span className="text-muted-foreground block font-mono text-[8px]">
                                    Score: {entry.winnerScore}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 relative z-10 text-[9px] italic">
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
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center dark:border-white/5">
            <div>
              <h4 className="text-foreground flex items-center gap-2 text-sm font-black tracking-wider uppercase">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Article Awards & Milestones
              </h4>
              <p className="text-muted-foreground text-xs">
                Explore recognized articles, collaborations, and community milestones.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={awardsSearch}
                  onChange={(e) => setAwardsSearch(e.target.value)}
                  className="border-border/50 text-foreground placeholder:text-muted-foreground w-48 rounded-lg border bg-black/10 py-1.5 pr-3 pl-8 text-xs focus:ring-1 focus:ring-amber-500/50 focus:outline-none dark:bg-black/35"
                />
              </div>
              <div className="border-border/50 flex flex-wrap rounded-lg border bg-black/10 p-0.5 dark:bg-black/35">
                {[
                  "ALL",
                  "FEATURED",
                  "COLLABORATION",
                  "PEER_REVIEW",
                  "SPECIAL",
                  "EDITOR_MILESTONE",
                ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setAwardsCategory(cat)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[10px] font-bold transition-all",
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredAwards.map((a: WikiArticleAward) => (
                <CutoutCard
                  key={a.id}
                  className={cn(
                    cutoutCardSurfaceClassName,
                    "border-border/50 bg-card/45 flex flex-col justify-between rounded-xl p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/20 hover:shadow-lg"
                  )}
                  texture="none"
                  trackPointerHover={false}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[9px] font-black tracking-wider uppercase",
                          getCategoryStyles(a.category)
                        )}
                      >
                        {getCategoryLabel(a.category)}
                      </span>
                      <span className="text-muted-foreground font-mono text-[10px]">
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
                          <h5 className="text-foreground flex items-center gap-2 text-sm font-extrabold tracking-tight">
                            <IconComp
                              className={cn(
                                "h-4.5 w-4.5 shrink-0",
                                !isCustomHex && getColorClass(colorVal)
                              )}
                              style={customStyle}
                            />
                            {a.name}
                          </h5>
                        );
                      })()}
                      <Link
                        href={`/w/${a.pageSlug}`}
                        className="group flex w-fit items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
                      >
                        {a.pageTitle}
                        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </div>

                    {a.description && (
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {a.description}
                      </p>
                    )}
                  </div>

                  {a.recipientUsers && a.recipientUsers.length > 0 && (
                    <div className="border-border/20 mt-4 flex flex-wrap items-center gap-1.5 border-t pt-3 dark:border-white/5">
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Contributors:
                      </span>
                      {a.recipientUsers.map((u: string) => (
                        <span
                          key={u}
                          className="bg-muted/30 text-foreground border-border/10 rounded border px-2 py-0.5 text-[10px] font-semibold"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  )}
                </CutoutCard>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-12 text-center text-xs">
              No matching article awards found.
            </div>
          )}
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
