"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { EmptyState } from "~/components/ui/empty-state";
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
      <div className="border-separator flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-title-2 text-label">Franchise Directorate</h3>
            <Badge variant="neutral" className="tabular-nums">
              {teams.length} Registered
            </Badge>
          </div>
          <p className="text-callout text-label-secondary">
            Directory of all member organizations, stadium origins, and club managers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <SegmentedControl
            size="sm"
            aria-label="Franchise filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: `All (${teams.length})` },
              { value: "managed", label: `Managed (${managedCount})` },
              { value: "unclaimed", label: `Unclaimed (${unclaimedCount})` },
            ]}
          />

          {/* Search Box */}
          <SearchField
            size="sm"
            placeholder="Search franchises..."
            aria-label="Search franchises"
            value={search}
            onValueChange={setSearch}
            containerClassName="min-w-[200px]"
          />
        </div>
      </div>

      {/* ─── FRANCHISE CARDS SHOWCASE ─── */}
      {filteredTeams.length === 0 ? (
        <FacetCard>
          <EmptyState
            icon={<Shield />}
            title="No Franchises Match Filter"
            message="Try clearing search terms or status filters."
          />
        </FacetCard>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => {
            const teamColor = team.color || "#3b82f6";

            return (
              <FacetCard
                key={team.id}
                onClick={() => onTeamClick(team.id)}
                aria-label={`Open ${team.name}`}
                className="group flex flex-col justify-between overflow-hidden"
              >
                {/* Club colour hairline (data colour) */}
                <div aria-hidden className="h-1" style={{ backgroundColor: teamColor }} />
                <div className="flex items-end justify-between p-5 pb-0">
                  {/* Club Crest */}
                  <div className="border-separator bg-surface-secondary rounded-row flex size-14 items-center justify-center overflow-hidden border">
                    {team.logo ? (
                      <img
                        src={withBasePath(team.logo)}
                        alt={team.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="text-headline flex h-full w-full items-center justify-center text-white shadow-inner"
                        style={{ backgroundColor: teamColor }}
                      >
                        {team.shortName || team.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {team.ownerUserId ? (
                      <Badge variant="tinted">Managed</Badge>
                    ) : (
                      <Badge variant="caution">Unclaimed</Badge>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                  <div>
                    <h4 className="text-headline text-label group-hover:text-tint line-clamp-1 transition-colors">
                      {team.name}
                    </h4>
                    <p className="text-footnote text-label-secondary mt-0.5">
                      {team.city ? `${team.city} • ` : ""}
                      {team.shortName ?? "Franchise Member"}
                    </p>
                  </div>

                  {/* Card Footer Action Bar */}
                  <div className="text-footnote border-separator flex items-center justify-between border-t pt-3 font-medium">
                    <span className="text-label-secondary group-hover:text-label transition-colors">
                      Inspect Squad
                    </span>
                    <ArrowRight
                      className="text-label-tertiary group-hover:text-tint size-4 transition-colors"
                      aria-hidden
                    />
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
