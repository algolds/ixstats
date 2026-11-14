"use client";

import Link from "next/link";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { EmptyState } from "~/components/ui/empty-state";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Trophy, Shield } from "iconoir-react";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";
import { ClubEntityCard, ClubEntityCardSkeleton } from "~/components/sports/browse/ClubEntityCard";

const MYCLUB_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyClub",
    body: "MyClub lists every club you manage across leagues, with their rosters and finances.",
  },
  {
    title: "Claim a club",
    body: "Open a competition in MyLeague and claim an available team to add it here.",
  },
  {
    title: "Squad and lineups",
    body: "Set starting lineups and formations, and train athletes to raise their match ratings and fitness.",
  },
  {
    title: "Matchday finances",
    body: "Expand the stadium, set ticket prices and sign commercial sponsors.",
  },
];

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

export default function MyClubPage() {
  usePageTitle({ title: "MyClub - Franchise & Squad Management" });
  const { data: clubs, isLoading } = api.sports.getMyClubs.useQuery();
  const hasClubs = Boolean(clubs && clubs.length > 0);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        title="MyClub"
        subtitle={
          clubs && clubs.length > 0
            ? `${clubs.length.toLocaleString()} ${clubs.length === 1 ? "club" : "clubs"} under your management`
            : undefined
        }
        bleed
        actions={
          <>
            <HeroHelpModal title="MyClub guide" steps={MYCLUB_HELP_STEPS} accentClass="text-tint" />
            {/* With no clubs the empty state carries this action, so the header does not repeat it. */}
            {(isLoading || hasClubs) && (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/myleague">
                  <Trophy />
                  Browse competitions
                </Link>
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <div className={GRID} aria-busy="true" aria-label="Loading clubs">
          {Array.from({ length: 6 }, (_, i) => (
            <ClubEntityCardSkeleton key={i} />
          ))}
        </div>
      ) : clubs && clubs.length > 0 ? (
        <ul className={GRID}>
          {clubs.map((club) => (
            <li key={club.id}>
              <ClubEntityCard club={club} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            icon={<Shield />}
            title="No clubs claimed yet"
            message="Claim an available team in a MyLeague competition to manage it here."
            action={
              <Button asChild>
                <Link href="/myleague">Browse competitions</Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  );
}
