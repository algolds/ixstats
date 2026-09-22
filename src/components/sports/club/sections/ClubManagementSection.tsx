"use client";

import React from "react";
import { SponsorWalletDeck } from "~/components/sports/club/SponsorWalletDeck";
import { RevenueCollector } from "~/components/sports/club/RevenueCollector";
import type { TeamSponsor } from "~/lib/sports/types";

export interface ClubManagementSectionProps {
  team: {
    id: string;
    name: string;
    color?: string | null;
    budget?: number | null;
    stadiumCapacity?: number | null;
    ticketPrice?: number | null;
    popularity?: number | null;
    sponsor?: TeamSponsor | Record<string, unknown> | null;
  };
  onRefetchOverview?: () => void;
}

export function ClubManagementSection({ team, onRefetchOverview }: ClubManagementSectionProps) {
  const teamColor = team.color || "#3b82f6";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SponsorWalletDeck
        team={team as unknown as Parameters<typeof SponsorWalletDeck>[0]["team"]}
        refetchTeam={onRefetchOverview ?? (() => {})}
      />
      <RevenueCollector
        teamId={team.id}
        teamBudget={team.budget ?? 0}
        stadiumCapacity={team.stadiumCapacity ?? 5000}
        ticketPrice={team.ticketPrice ?? 15}
        popularity={team.popularity ?? 50}
        sponsor={team.sponsor as Parameters<typeof RevenueCollector>[0]["sponsor"]}
        onCollected={onRefetchOverview}
        teamColor={teamColor}
      />
    </div>
  );
}

export default ClubManagementSection;
