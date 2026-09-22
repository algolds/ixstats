"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Xmark,
  Shield,
  User,
  Activity,
  ArrowRight,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useSportsFocus } from "./SportsFocusProvider";
import { getSportTheme } from "~/lib/sports/theming";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

// ─── Attribute badge styling ────────────────────────────────────────────────
function attributeBadgeClass(value: number): string {
  if (value >= 90) return "bg-amber-400/20 text-amber-500 dark:text-amber-400 border-amber-400/40";
  if (value >= 80) return "bg-emerald-400/20 text-emerald-500 dark:text-emerald-400 border-emerald-400/40";
  if (value >= 70) return "bg-blue-400/20 text-blue-500 dark:text-blue-400 border-blue-400/40";
  return "bg-muted/60 text-muted-foreground border-border/40";
}

// ─── Career stage styling ───────────────────────────────────────────────────
const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  developing: { label: "Developing", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  prime: { label: "Prime", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  plateau: { label: "Plateau", className: "border-border/60 bg-muted/60 text-muted-foreground" },
  declining: { label: "Declining", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  retired: { label: "Retired", className: "border-border/40 bg-muted/40 text-muted-foreground/60" },
};

// ─── Organization (Club) Focus View ─────────────────────────────────────────
function OrganizationFocusContent({
  organizationId,
  sportPreset,
}: {
  organizationId: string;
  sportPreset?: string;
}) {
  const router = useRouter();
  const { focusAthlete, clearFocus } = useSportsFocus();

  const { data: team, isLoading } = api.sports.getTeam.useQuery(
    { id: organizationId },
    { enabled: !!organizationId }
  );

  const theme = getSportTheme(sportPreset || team?.league?.sportPreset);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Shield className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-xs font-semibold">Club information unavailable</p>
      </div>
    );
  }

  const activePlayers = team.players ?? [];
  const topPlayers = [...activePlayers]
    .sort((a, b) => {
      const rA = (a.ratings as Record<string, number> | null)?.overall ?? 50;
      const rB = (b.ratings as Record<string, number> | null)?.overall ?? 50;
      return rB - rA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Club Identity Header */}
      <div className="flex items-center gap-3.5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/50 shadow-md text-2xl font-black"
          style={{ backgroundColor: team.color ? `${team.color}20` : "rgba(255,255,255,0.05)" }}
        >
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="h-full w-full object-cover" />
          ) : (
            <span>{theme.emoji}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-black tracking-tight text-foreground">
              {team.name}
            </h3>
          </div>
          <p className="truncate text-xs text-muted-foreground font-medium">
            {team.shortName ?? team.city ?? theme.name}
            {team.city ? ` · ${team.city}` : ""}
          </p>
        </div>
      </div>

      {/* Quick Club Action */}
      <Button
        onClick={() => {
          clearFocus();
          router.push(withBasePath(`/myclub/${team.id}`));
        }}
        data-cuelume-press="subtle"
        className="w-full justify-between rounded-xl border border-border/40 bg-card hover:bg-muted/40 text-foreground font-bold text-xs py-2 px-3 shadow-sm transition active:scale-[0.98] cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-400" />
          Open Club Headquarters
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>

      {/* Top Squad Athletes Preview */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Key Athletes ({activePlayers.length})
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-semibold">Click to focus</span>
        </div>

        <div className="space-y-1.5">
          {topPlayers.map((player) => {
            const ratings = (player.ratings as Record<string, number> | null) ?? {};
            const ovr = ratings.overall ?? 50;

            return (
              <button
                key={player.id}
                type="button"
                onClick={() => focusAthlete(player.id)}
                data-cuelume-press="subtle"
                className="w-full flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/40 p-2.5 transition text-left active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-7 w-7 rounded-lg overflow-hidden border border-border/30 bg-muted/40 shrink-0">
                    <img
                      src={getPlayerPhotoUrl(player)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      {player.firstName} {player.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {player.position} · Age {player.age}
                    </p>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-black px-1.5 py-0.5", attributeBadgeClass(ovr))}
                >
                  {ovr}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Athlete Focus View ─────────────────────────────────────────────────────
function AthleteFocusContent({
  athleteId,
  sportPreset,
}: {
  athleteId: string;
  sportPreset?: string;
}) {
  const { focusOrganization } = useSportsFocus();

  const { data: athlete, isLoading } = api.sports.getPlayer.useQuery(
    { id: athleteId },
    { enabled: !!athleteId }
  );

  const ratings = (athlete?.ratings as Record<string, number> | null) ?? {};
  const overall = ratings.overall ?? 50;

  const stage = (athlete?.careerStage ?? "prime").toLowerCase();
  const stageInfo = CAREER_STAGE_STYLES[stage] ?? CAREER_STAGE_STYLES.prime;

  // Filter skills for display
  const skillKeys = Object.keys(ratings)
    .filter((k) => !["overall", "wins", "losses", "draws", "form", "morale"].includes(k))
    .slice(0, 6);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <User className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-xs font-semibold">Athlete information unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Athlete Identity Header */}
      <div className="flex items-center gap-3.5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-muted/40 shadow-md">
          <img
            src={getPlayerPhotoUrl(athlete)}
            alt={`${athlete.firstName} ${athlete.lastName}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-base font-black tracking-tight text-foreground">
              {athlete.firstName} {athlete.lastName}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] font-bold border-border/50">
              {athlete.position}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] font-bold", stageInfo?.className)}>
              {stageInfo?.label ?? "Active"}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Age {athlete.age}
            </span>
          </div>
        </div>

        <div className="text-right">
          <Badge
            variant="outline"
            className={cn("text-sm font-black px-2 py-0.5", attributeBadgeClass(overall))}
          >
            {overall}
          </Badge>
          <span className="block text-[9px] font-bold text-muted-foreground mt-0.5">OVR</span>
        </div>
      </div>

      {/* Team Link */}
      {athlete.team && (
        <button
          type="button"
          onClick={() => athlete.team && focusOrganization(athlete.team.id)}
          data-cuelume-press="subtle"
          className="w-full flex items-center justify-between rounded-xl border border-border/40 bg-card hover:bg-muted/40 p-2.5 transition text-left active:scale-[0.98] cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-foreground truncate">
              {athlete.team.name}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold">Focus Club →</span>
        </button>
      )}

      {/* Ratings & Skills Matrix */}
      {skillKeys.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
            Attributes & Skills
          </span>
          <div className="grid grid-cols-2 gap-2">
            {skillKeys.map((key) => {
              const val = ratings[key] ?? 50;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 px-3 py-2"
                >
                  <span className="text-[11px] font-medium capitalize text-muted-foreground">
                    {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-black",
                      val >= 80 ? "text-emerald-400" : val >= 70 ? "text-blue-400" : "text-foreground"
                    )}
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Match Focus View ───────────────────────────────────────────────────────
function MatchFocusContent({ matchId }: { matchId: string }) {
  const { focusOrganization } = useSportsFocus();
  const { data: match, isLoading } = api.sports.getMatchDetails.useQuery(
    { matchId },
    { enabled: !!matchId }
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Activity className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
        <p className="text-xs font-semibold">Match details unavailable</p>
      </div>
    );
  }

  const isCompleted = match.status === "completed";

  return (
    <div className="space-y-5">
      {/* Match Scoreboard Snippet */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-4 text-center space-y-3">
        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
          {isCompleted ? "Full Time" : `Matchday ${match.matchDay ?? 1}`}
        </Badge>

        <div className="flex items-center justify-between gap-4 px-2">
          {/* Home */}
          <button
            type="button"
            onClick={() => focusOrganization(match.homeTeam.id)}
            data-cuelume-press="subtle"
            className="flex-1 text-center min-w-0 group hover:underline cursor-pointer active:scale-[0.98]"
          >
            <p className="text-xs font-bold text-foreground group-hover:text-primary truncate">
              {match.homeTeam.name}
            </p>
            <span className="text-[9px] text-muted-foreground">Focus Club →</span>
          </button>

          {/* Score */}
          <div className="text-xl font-black text-foreground tracking-tight px-3 py-1 rounded-xl bg-muted/40 border border-border/40">
            {isCompleted ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : "VS"}
          </div>

          {/* Away */}
          <button
            type="button"
            onClick={() => focusOrganization(match.awayTeam.id)}
            data-cuelume-press="subtle"
            className="flex-1 text-center min-w-0 group hover:underline cursor-pointer active:scale-[0.98]"
          >
            <p className="text-xs font-bold text-foreground group-hover:text-primary truncate">
              {match.awayTeam.name}
            </p>
            <span className="text-[9px] text-muted-foreground">Focus Club →</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Primary SportsFocusPanel (Desktop Docked Rail) ─────────────────────────
export function SportsFocusPanel({
  sportPreset,
  className,
}: {
  sportPreset?: string;
  className?: string;
}) {
  const { focus, clearFocus } = useSportsFocus();

  if (!focus) return null;

  return (
    <aside
      className={cn(
        "facet-hierarchy-parent w-80 xl:w-96 shrink-0 rounded-3xl border border-border/40 bg-card/85 p-5 shadow-xl backdrop-blur-2xl transition-all duration-300",
        className
      )}
    >
      {/* Header bar with dismiss */}
      <div className="flex items-center justify-between border-b border-border/20 pb-3.5 mb-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5"
          >
            {focus.type} Focus
          </Badge>
        </div>

        <button
          type="button"
          onClick={clearFocus}
          data-cuelume-press="subtle"
          className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition active:scale-[0.95] cursor-pointer"
          title="Close Focus"
        >
          <Xmark className="h-4 w-4" />
        </button>
      </div>

      {/* Body switched on focus.type */}
      {focus.type === "organization" && (
        <OrganizationFocusContent organizationId={focus.id} sportPreset={sportPreset} />
      )}

      {focus.type === "athlete" && (
        <AthleteFocusContent athleteId={focus.id} sportPreset={sportPreset} />
      )}

      {focus.type === "match" && <MatchFocusContent matchId={focus.id} />}
    </aside>
  );
}

// ─── Mobile SportsFocusSheet (Fallback for <1024px Viewports) ───────────────
export function SportsFocusSheet({ sportPreset }: { sportPreset?: string }) {
  const { focus, clearFocus } = useSportsFocus();

  return (
    <Sheet open={!!focus} onOpenChange={(open) => !open && clearFocus()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] rounded-t-3xl border-t border-border/40 bg-card/95 backdrop-blur-2xl p-6 overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            {focus?.type} Focus
          </SheetTitle>
        </SheetHeader>

        {focus?.type === "organization" && (
          <OrganizationFocusContent organizationId={focus.id} sportPreset={sportPreset} />
        )}

        {focus?.type === "athlete" && (
          <AthleteFocusContent athleteId={focus.id} sportPreset={sportPreset} />
        )}

        {focus?.type === "match" && <MatchFocusContent matchId={focus.id} />}
      </SheetContent>
    </Sheet>
  );
}
export default SportsFocusPanel;
