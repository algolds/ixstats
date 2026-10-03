"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Xmark, Shield, User, Activity, ArrowRight } from "iconoir-react";
import { api } from "~/trpc/react";
import { useSportsFocus } from "./SportsFocusProvider";
import { AthleteCareerHistory } from "./AthleteCareerHistory";
import { getSportTheme } from "~/lib/sports/theming";
import { getPlayerPhotoUrl } from "~/lib/sports/photos";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

// ─── Attribute badge styling ────────────────────────────────────────────────
function attributeBadgeClass(value: number): string {
  if (value >= 90) return "bg-yellow/20 text-yellow border-yellow/40";
  if (value >= 80) return "bg-green/20 text-green border-green/40";
  if (value >= 70) return "bg-blue/20 text-blue border-blue/40";
  return "bg-fill-3 text-label-secondary border-separator";
}

// ─── Career stage styling ───────────────────────────────────────────────────
const CAREER_STAGE_STYLES: Record<string, { label: string; className: string }> = {
  rookie: { label: "Rookie", className: "border-blue/30 bg-blue/10 text-blue" },
  developing: { label: "Developing", className: "border-green/30 bg-green/10 text-green" },
  prime: { label: "Prime", className: "border-yellow/30 bg-yellow/10 text-yellow" },
  plateau: { label: "Plateau", className: "border-separator bg-fill-3 text-label-secondary" },
  declining: { label: "Declining", className: "border-red/30 bg-red/10 text-red" },
  retired: { label: "Retired", className: "border-separator bg-fill-3 text-label-tertiary" },
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
          <Skeleton className="rounded-card h-14 w-14" />
          <div className="flex-1 space-y-2">
            <Skeleton className="rounded-control h-5 w-32" />
            <Skeleton className="rounded-control-sm h-4 w-20" />
          </div>
        </div>
        <Skeleton className="rounded-card h-28 w-full" />
        <Skeleton className="rounded-card h-48 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-label-secondary py-12 text-center">
        <Shield className="text-label-tertiary mx-auto mb-2 h-10 w-10" />
        <p className="text-footnote font-semibold">Club information unavailable</p>
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
      <div className="flex items-center gap-4">
        <div
          className="rounded-card border-separator shadow-card text-title-1 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border"
          style={{ backgroundColor: team.color ? `${team.color}20` : "rgba(255,255,255,0.05)" }}
        >
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="h-full w-full object-cover" />
          ) : (
            <span>{theme.emoji}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-headline text-label truncate">{team.name}</h3>
          </div>
          <p className="text-footnote text-label-secondary truncate font-medium">
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
        className="rounded-row border-separator bg-surface hover:bg-fill-3 text-label text-footnote shadow-card w-full cursor-pointer justify-between border px-3 py-2 font-semibold transition"
      >
        <span className="flex items-center gap-2">
          <Shield className="text-teal h-4 w-4" />
          Open club headquarters
        </span>
        <ArrowRight className="text-label-secondary h-3.5 w-3.5" />
      </Button>

      {/* Top Squad Athletes Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-eyebrow text-label-secondary">
            Key Athletes ({activePlayers.length})
          </span>
          <span className="text-footnote text-label-tertiary font-semibold">Click to focus</span>
        </div>

        <FacetListSection aria-label="Top players">
          {topPlayers.map((player) => {
            const ratings = (player.ratings as Record<string, number> | null) ?? {};
            const ovr = ratings.overall ?? 50;

            return (
              <FacetRow
                key={player.id}
                onClick={() => focusAthlete(player.id)}
                leading={
                  <span className="rounded-control border-separator bg-fill-3 block h-7 w-7 shrink-0 overflow-hidden border">
                    <img
                      src={getPlayerPhotoUrl(player)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                }
                title={
                  <span className="text-footnote block truncate font-semibold">
                    {player.firstName} {player.lastName}
                  </span>
                }
                subtitle={`${player.position} · Age ${player.age}`}
                trailing={
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-footnote px-2 py-0.5 font-semibold tabular-nums",
                      attributeBadgeClass(ovr)
                    )}
                  >
                    {ovr}
                  </Badge>
                }
                accessory="chevron"
              />
            );
          })}
        </FacetListSection>
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
          <Skeleton className="rounded-card h-16 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="rounded-control h-5 w-32" />
            <Skeleton className="rounded-control-sm h-4 w-24" />
          </div>
        </div>
        <Skeleton className="rounded-card h-24 w-full" />
        <Skeleton className="rounded-card h-40 w-full" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="text-label-secondary py-12 text-center">
        <User className="text-label-tertiary mx-auto mb-2 h-10 w-10" />
        <p className="text-footnote font-semibold">Athlete information unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Athlete Identity Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-card border-separator bg-fill-3 shadow-card relative h-16 w-16 shrink-0 overflow-hidden border">
          <img
            src={getPlayerPhotoUrl(athlete)}
            alt={`${athlete.firstName} ${athlete.lastName}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-headline text-label truncate">
              {athlete.firstName} {athlete.lastName}
            </h3>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="text-footnote border-separator font-semibold">
              {athlete.position}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-footnote font-semibold", stageInfo?.className)}
            >
              {stageInfo?.label ?? "Active"}
            </Badge>
            <span className="text-footnote text-label-secondary font-semibold">
              Age {athlete.age}
            </span>
          </div>
        </div>

        <div className="text-right">
          <Badge
            variant="outline"
            className={cn("text-body px-2 py-0.5 font-semibold", attributeBadgeClass(overall))}
          >
            {overall}
          </Badge>
          <span className="text-footnote text-label-secondary mt-0.5 block font-semibold">OVR</span>
        </div>
      </div>

      {/* Team Link */}
      {athlete.team && (
        <FacetListSection aria-label="Club">
          <FacetRow
            onClick={() => athlete.team && focusOrganization(athlete.team.id)}
            leading={<Shield className="text-teal h-4 w-4 shrink-0" />}
            title={
              <span className="text-footnote block truncate font-semibold">
                {athlete.team.name}
              </span>
            }
            trailing="Focus Club"
            accessory="chevron"
          />
        </FacetListSection>
      )}

      {/* Ratings & Skills Matrix */}
      {skillKeys.length > 0 && (
        <div className="space-y-2">
          <span className="text-eyebrow text-label-secondary">Attributes & skills</span>
          <div className="grid grid-cols-2 gap-2">
            {skillKeys.map((key) => {
              const val = ratings[key] ?? 50;
              return (
                <div
                  key={key}
                  className="rounded-row border-separator bg-fill-4 flex items-center justify-between border px-3 py-2"
                >
                  <span className="text-footnote text-label-secondary font-medium capitalize">
                    {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                  </span>
                  <span
                    className={cn(
                      "text-footnote font-semibold",
                      val >= 80 ? "text-green" : val >= 70 ? "text-blue" : "text-label"
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

      <AthleteCareerHistory athleteId={athlete.id} />
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
        <Skeleton className="rounded-card h-24 w-full" />
        <Skeleton className="rounded-card h-32 w-full" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-label-secondary py-12 text-center">
        <Activity className="text-label-tertiary mx-auto mb-2 h-10 w-10" />
        <p className="text-footnote font-semibold">Match details unavailable</p>
      </div>
    );
  }

  const isCompleted = match.status === "completed";

  return (
    <div className="space-y-5">
      {/* Match Scoreboard Snippet */}
      <div className="rounded-card border-separator bg-surface space-y-3 border p-4 text-center">
        <Badge variant="outline" className="text-eyebrow">
          {isCompleted ? "Full Time" : `Matchday ${match.matchDay ?? 1}`}
        </Badge>

        <div className="flex items-center justify-between gap-4 px-2">
          {/* Home */}
          <Button
            variant="ghost"
            onClick={() => focusOrganization(match.homeTeam.id)}
            className="group h-auto min-w-0 flex-1 flex-col gap-0 px-2 py-1 text-center"
          >
            <p className="text-footnote text-label group-hover:text-tint truncate font-semibold">
              {match.homeTeam.name}
            </p>
            <span className="text-footnote text-label-secondary">Focus Club →</span>
          </Button>

          {/* Score */}
          <div className="text-title-2 text-label rounded-row bg-fill-3 border-separator border px-3 py-1">
            {isCompleted ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : "VS"}
          </div>

          {/* Away */}
          <Button
            variant="ghost"
            onClick={() => focusOrganization(match.awayTeam.id)}
            className="group h-auto min-w-0 flex-1 flex-col gap-0 px-2 py-1 text-center"
          >
            <p className="text-footnote text-label group-hover:text-tint truncate font-semibold">
              {match.awayTeam.name}
            </p>
            <span className="text-footnote text-label-secondary">Focus Club →</span>
          </Button>
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
        "bg-surface border-separator shadow-card rounded-card w-80 shrink-0 border p-5 xl:w-96",
        className
      )}
    >
      {/* Header bar with dismiss */}
      <div className="border-separator mb-4 flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {focus.type} Focus
          </Badge>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={clearFocus}
          title="Close focus"
          aria-label="Close focus"
          className="text-label-secondary rounded-full"
        >
          <Xmark className="size-4" />
        </Button>
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
        className="rounded-t-sheet border-separator bg-surface max-h-[85vh] overflow-y-auto border-t p-6"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="text-eyebrow text-label-secondary">{focus?.type} Focus</SheetTitle>
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
