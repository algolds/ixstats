"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Trophy, Calendar, ArrowLeft, Swords, MapPin } from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import Link from "next/link";
import Standings from "~/components/sports/standings/Standings1";
import { ScheduleView } from "~/components/myleague/ScheduleView";
import { BracketView } from "~/components/myleague/BracketView";
import { RaceResults } from "~/components/myleague/RaceResults";
import MatchDetailModal from "~/components/myleague/MatchDetailModal";
import { getSportColors, type SportPresetKey } from "~/lib/sports/presets";

export default function SeasonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string;
  const seasonId = params?.seasonId as string;

  const [activeTab, setActiveTab] = useState<"standings" | "schedule" | "bracket" | "races">(
    "standings"
  );
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  const { data: season, isLoading } = api.sports.getSeason.useQuery(
    { id: seasonId ?? "" },
    { enabled: !!seasonId }
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <div className="grid grid-cols-4 gap-6">
          <Skeleton className="col-span-1 h-12" />
          <Skeleton className="col-span-3 h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-12 text-center">
        <Trophy className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
        <h2 className="text-foreground text-2xl font-bold">Season Not Found</h2>
        <p className="text-muted-foreground mt-2">
          The requested season details could not be loaded.
        </p>
        <Button className="mt-6" onClick={() => router.push(withBasePath(`/myleague/${leagueId}`))}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to League
        </Button>
      </div>
    );
  }

  const league = season.league;
  const archetype = league.archetype;
  const sportColors = getSportColors(league.sportPreset as SportPresetKey);

  // Format Standings data
  const standingsData = season.standings.map((s) => ({
    id: s.id,
    teamId: s.teamId,
    teamName: s.team.name,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    points: s.points,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    rank: s.position,
    division: s.division ?? undefined,
    conference: s.conference ?? undefined,
    color: s.team.color ?? "#3b82f6",
    logo: s.team.logo,
    wikiSlug: s.team.wikiSlug,
  }));

  // Format Matches data for ScheduleView
  const matchesData = season.matches.map((m) => ({
    id: m.id,
    matchDay: m.matchDay,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    homeTeamId: m.homeTeam.id,
    awayTeamId: m.awayTeam.id,
    homeScore: m.homeScore ?? undefined,
    awayScore: m.awayScore ?? undefined,
    status: m.status,
    homeColor: m.homeTeam.color ?? undefined,
    awayColor: m.awayTeam.color ?? undefined,
    homeTeam: { logo: m.homeTeam.logo, wikiSlug: m.homeTeam.wikiSlug },
    awayTeam: { logo: m.awayTeam.logo, wikiSlug: m.awayTeam.wikiSlug },
  }));

  const handleMatchClick = (matchId: string) => {
    setSelectedMatchId(matchId);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      {/* Back to League */}
      <div>
        <Link
          href={withBasePath(`/myleague/${leagueId}?tab=history`)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to League History
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="border-border/40 bg-card/60 relative overflow-hidden rounded-3xl border p-6 shadow-xl backdrop-blur-md">
        {/* Glow overlay */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full blur-[100px]"
          style={{ backgroundColor: `hsla(${sportColors.accentColor}, 0.15)` }}
        />

        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border px-3 py-1 text-xs font-bold uppercase"
                style={{
                  backgroundColor: `hsla(${sportColors.accentColor}, 0.1)`,
                  color: `hsl(${sportColors.highlightColor})`,
                  borderColor: `hsla(${sportColors.accentColor}, 0.2)`,
                }}
              >
                Season {season.seasonNumber} History
              </span>
              {season.status === "completed" && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 uppercase">
                  Completed
                </span>
              )}
            </div>
            <h1 className="text-foreground mt-3 text-3xl font-extrabold tracking-tight">
              {league.name}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-semibold">
              Archetype:{" "}
              <span
                className="animate-pulse font-bold capitalize"
                style={{ color: `hsl(${sportColors.highlightColor})` }}
              >
                {archetype.replace("_", " ")}
              </span>
            </p>
          </div>

          {season.champion && (
            <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                <Trophy className="h-6 w-6 animate-pulse text-amber-400" />
              </div>
              <div>
                <span className="block text-[10px] font-black tracking-wider text-amber-400/80 uppercase">
                  Champion
                </span>
                <span className="text-foreground text-lg font-black">{season.champion.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Sidebar Nav Tabs */}
        <div className="space-y-2">
          <button
            onClick={() => setActiveTab("standings")}
            className={cn(
              "w-full cursor-pointer rounded-xl border p-3 text-left text-sm font-bold transition-all outline-none",
              activeTab === "standings"
                ? "border-slate-700 bg-slate-800 text-slate-100 shadow-md shadow-slate-900/5"
                : "text-muted-foreground hover:text-foreground border-transparent hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Standings
            </span>
          </button>

          {archetype !== "circuit" && archetype !== "bracket" && (
            <button
              onClick={() => setActiveTab("schedule")}
              className={cn(
                "w-full cursor-pointer rounded-xl border p-3 text-left text-sm font-bold transition-all outline-none",
                activeTab === "schedule"
                  ? "border-slate-700 bg-slate-800 text-slate-100 shadow-md shadow-slate-900/5"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:bg-white/5"
              )}
            >
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Schedule & Matches
              </span>
            </button>
          )}

          {archetype === "bracket" && (
            <button
              onClick={() => setActiveTab("bracket")}
              className={cn(
                "w-full cursor-pointer rounded-xl border p-3 text-left text-sm font-bold transition-all outline-none",
                activeTab === "bracket"
                  ? "border-slate-700 bg-slate-800 text-slate-100 shadow-md shadow-slate-900/5"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:bg-white/5"
              )}
            >
              <span className="flex items-center gap-2">
                <Swords className="h-4 w-4" />
                Bracket
              </span>
            </button>
          )}

          {archetype === "circuit" && (
            <button
              onClick={() => setActiveTab("races")}
              className={cn(
                "w-full cursor-pointer rounded-xl border p-3 text-left text-sm font-bold transition-all outline-none",
                activeTab === "races"
                  ? "border-slate-700 bg-slate-800 text-slate-100 shadow-md shadow-slate-900/5"
                  : "text-muted-foreground hover:text-foreground border-transparent hover:bg-white/5"
              )}
            >
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Race Results
              </span>
            </button>
          )}
        </div>

        {/* Content Panel */}
        <div className="col-span-1 md:col-span-3">
          {activeTab === "standings" && (
            <Standings
              title="Season Final Standings"
              standings={standingsData}
              promotionCount={league.promotionCount}
              relegationCount={league.relegationCount}
            />
          )}

          {activeTab === "schedule" && (
            <ScheduleView
              matches={matchesData}
              archetype={archetype}
              onMatchClick={handleMatchClick}
            />
          )}

          {activeTab === "bracket" && seasonId && <BracketView seasonId={seasonId} />}

          {activeTab === "races" && seasonId && <RaceResults seasonId={seasonId} />}
        </div>
      </div>

      {/* Match Detail Modal */}
      <MatchDetailModal
        matchId={selectedMatchId}
        isOpen={!!selectedMatchId}
        onClose={() => setSelectedMatchId(null)}
        sportColors={sportColors}
      />
    </div>
  );
}
