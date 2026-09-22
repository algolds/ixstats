"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Shield, Search, ArrowRight, User, City, Star } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

export interface LeagueTeamItem {
  id: string;
  name: string;
  shortName?: string | null;
  city?: string | null;
  color?: string | null;
  logo?: string | null;
  ownerUserId?: string | null;
  budget?: number | null;
}

export interface LeagueTeamsTabProps {
  teams: LeagueTeamItem[];
  onTeamClick: (teamId: string) => void;
}

export function LeagueTeamsTab({ teams, onTeamClick }: LeagueTeamsTabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "managed" | "unclaimed">("all");

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        (team.city && team.city.toLowerCase().includes(search.toLowerCase())) ||
        (team.shortName && team.shortName.toLowerCase().includes(search.toLowerCase()));

      const matchesFilter =
        filter === "all" ||
        (filter === "managed" && !!team.ownerUserId) ||
        (filter === "unclaimed" && !team.ownerUserId);

      return matchesSearch && matchesFilter;
    });
  }, [teams, search, filter]);

  const managedCount = teams.filter((t) => !!t.ownerUserId).length;
  const unclaimedCount = teams.length - managedCount;

  return (
    <div className="space-y-6">
      {/* ─── DIRECTORATE TOOLBAR & CONTROLS ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/20 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              Franchise Directorate
            </h3>
            <Badge
              variant="outline"
              className="border-border/60 bg-muted/30 text-xs font-bold text-foreground"
            >
              {teams.length} Registered
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Directory of all member organizations, stadium origins, and club managers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <div className="flex items-center rounded-xl border border-border/40 bg-background/60 p-1 shadow-sm backdrop-blur-md">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-bold uppercase transition-all active:scale-[0.98] cursor-pointer",
                filter === "all"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({teams.length})
            </button>
            <button
              onClick={() => setFilter("managed")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-bold uppercase transition-all active:scale-[0.98] cursor-pointer",
                filter === "managed"
                  ? "bg-cyan-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Managed ({managedCount})
            </button>
            <button
              onClick={() => setFilter("unclaimed")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-bold uppercase transition-all active:scale-[0.98] cursor-pointer",
                filter === "unclaimed"
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unclaimed ({unclaimedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search franchises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl border-border/60 bg-card/40 ps-8 text-xs placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </div>

      {/* ─── FRANCHISE CARDS SHOWCASE ─── */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-3xl border border-border/40 bg-card/40 p-12 text-center backdrop-blur-md space-y-2">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h4 className="text-base font-bold text-foreground">No Franchises Match Filter</h4>
          <p className="text-xs text-muted-foreground">Try clearing search terms or status filters.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => {
            const teamColor = team.color || "#3b82f6";

            return (
              <FacetCard
                key={team.id}
                depth={2}
                interactive="hover"
                onClick={() => onTeamClick(team.id)}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/40 bg-card/75 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-border hover:shadow-2xl active:scale-[0.98] cursor-pointer"
              >
                {/* Header Ambient Color Band */}
                <div
                  className="relative h-24 p-4 flex items-end justify-between overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${teamColor}35 0%, rgba(255,255,255,0.02) 100%)`,
                  }}
                >
                  <div className="absolute inset-0 bg-card/20 backdrop-blur-xs" />

                  {/* Club Crest */}
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-xl">
                    {team.logo ? (
                      <img
                        src={withBasePath(team.logo)}
                        alt={team.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-sm font-black text-white shadow-inner"
                        style={{ backgroundColor: teamColor }}
                      >
                        {team.shortName || team.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="relative z-10">
                    {team.ownerUserId ? (
                      <Badge
                        variant="outline"
                        className="border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-400 backdrop-blur-md"
                      >
                        Managed
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 backdrop-blur-md"
                      >
                        Unclaimed
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div>
                    <h4 className="text-base font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                      {team.name}
                    </h4>
                    <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                      {team.city ? `${team.city} • ` : ""}
                      {team.shortName ?? "Franchise Member"}
                    </p>
                  </div>

                  {/* Card Footer Action Bar */}
                  <div className="flex items-center justify-between border-t border-border/20 pt-3 text-xs font-bold">
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Inspect Squad
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-background/50 shadow-xs group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </FacetCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LeagueTeamsTab;
