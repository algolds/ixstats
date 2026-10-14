"use client";

import Link from "next/link";
import { ArrowUpRight } from "iconoir-react";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";
import { RecentWinners } from "./RecentWinners";
import { Standings } from "./Standings";
import { TodayRace } from "./TodayRace";
import { YourLorewards } from "./YourLorewards";
import { CONTEST_PATH, VAULT_TROPHIES_PATH } from "./format";

export interface LorewardsViewProps {
  /** `contest` leads with today's race, the standings and the history; `you` leads with the player's trophies. */
  focus: "contest" | "you";
  /** `you` only: show this wiki user's public trophies (the Passport) instead of the viewer's. */
  username?: string;
  /** `you` only: the trophy card to mark, when an article badge linked to it. */
  highlightCardId?: string;
}

/**
 * The Lorewards view, one component in two homes: WikiOS (`/util/lorewards`, contest focus) and the Vault
 * Achievements Lorewards tab (you focus), and the Passport. It ships in the standalone WikiOS bundle, so it
 * imports nothing that belongs to the Vault only.
 */
export function LorewardsView({ focus, username, highlightCardId }: LorewardsViewProps) {
  const contest = focus === "contest";
  return (
    <div className="space-y-6" data-focus={focus}>
      <div className="flex justify-end">
        <Link
          href={contest ? ixstatesLinkHref(VAULT_TROPHIES_PATH) : CONTEST_PATH}
          className="text-tint text-footnote inline-flex items-center gap-0.5 hover:underline"
        >
          <span>{contest ? "Your trophies in the Vault" : "Today's race and standings"}</span>
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      {contest ? (
        <>
          <TodayRace />
          <Standings />
          <RecentWinners />
        </>
      ) : (
        <YourLorewards username={username} highlightCardId={highlightCardId} />
      )}
    </div>
  );
}
