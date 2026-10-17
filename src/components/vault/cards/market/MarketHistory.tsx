"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowSeparate } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { CardFace } from "~/components/cards/face/CardFace";
import { mergeMarketHistory, type HistoryEntry } from "./market-history";

const HISTORY_LIMIT = 50;

function entryTitle(entry: HistoryEntry): string {
  if (entry.kind === "auction") return `Auction · ${entry.face?.title ?? "a card"}`;
  const partner = entry.partnerHandle ? `@${entry.partnerHandle}` : "a player";
  return `Trade with ${partner} · gave ${entry.gave}, got ${entry.got}`;
}

function entryDetails(entry: HistoryEntry): string {
  const parts = [entry.label, entry.at.toLocaleDateString()];
  if (entry.kind === "auction" && entry.price !== null) {
    parts.push(`${entry.price.toLocaleString()} IxC`);
  }
  return parts.join(" · ");
}

/** Past trades and auctions, newest first. */
export function MarketHistory({ onOpenCard }: { onOpenCard: (cardId: string) => void }) {
  const { userId } = useAuth();
  const trades = api.trading.getTradeHistory.useQuery({ limit: HISTORY_LIMIT });
  const auctions = api.cardMarket.getMyAuctionParticipation.useQuery({ limit: HISTORY_LIMIT });
  const entries = mergeMarketHistory(
    trades.data?.trades ?? [],
    auctions.data?.auctions ?? [],
    userId ?? null
  );
  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        title="No trades or auctions yet"
        message="Finished trades and auctions appear here."
      />
    );
  }
  return (
    <Card content="feed">
      <ul aria-label="History" className="divide-separator divide-y">
        {entries.map((entry) => {
          const face = entry.kind === "auction" ? entry.face : null;
          return (
            <li key={`${entry.kind}-${entry.id}`} className="flex items-center gap-3 px-4 py-3">
              {face ? (
                <CardFace
                  face={face}
                  size="S"
                  className="w-16"
                  onOpen={() => onOpenCard(face.cardId)}
                />
              ) : (
                <ArrowSeparate aria-hidden className="text-tint size-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-callout truncate">{entryTitle(entry)}</p>
                <p className="text-caption text-label-secondary tabular-nums">
                  {entryDetails(entry)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
