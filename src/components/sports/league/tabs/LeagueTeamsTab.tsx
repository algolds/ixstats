"use client";

import { TeamCrest } from "~/components/sports/TeamCrest";
import React, { useState, useMemo } from "react";
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { EmptyState } from "~/components/ui/empty-state";
import { Shield } from "iconoir-react";
import { Card } from "~/components/ui/card";

interface LeagueTeamItem {
  id: string;
  name: string;
  shortName?: string | null;
  city?: string | null;
  color?: string | null;
  logo?: string | null;
  ownerUserId?: string | null;
  budget?: number | null;
}

interface LeagueTeamsTabProps {
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
      {/* DIRECTORATE TOOLBAR & CONTROLS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-title-3 text-label">
          Clubs <span className="text-label-secondary tabular-nums">({teams.length})</span>
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <SegmentedControl
            size="sm"
            aria-label="Club filter"
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
            placeholder="Search clubs"
            aria-label="Search clubs"
            value={search}
            onValueChange={setSearch}
            containerClassName="min-w-[200px]"
          />
        </div>
      </div>

      {/* FRANCHISE CARDS SHOWCASE */}
      {filteredTeams.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Shield />}
            title="No clubs match"
            message="Change the search or the filter to see more."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card
              key={team.id}
              content="entity"
              padding="md"
              onClick={() => onTeamClick(team.id)}
              aria-label={`Open ${team.name}`}
              className="flex items-center gap-3"
              interactive
            >
              <div className="bg-tint-fill text-tint-ink rounded-row flex size-12 shrink-0 items-center justify-center p-2">
                <TeamCrest src={team.logo} alt="" color={team.color ?? undefined} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-headline text-label truncate">{team.name}</h4>
                <p className="text-footnote text-label-secondary truncate">
                  {[team.city, team.shortName].filter(Boolean).join(" · ") || "Member club"}
                </p>
              </div>
              {!team.ownerUserId && <Badge variant="warning">Unclaimed</Badge>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
