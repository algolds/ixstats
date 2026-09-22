"use client";

import React, { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Search, ArrowSeparate as ArrowLeftRight } from "iconoir-react";
import { PositionTooltip } from "~/components/sports/PositionTooltip";
import { PlayerMatchup } from "~/components/sports/PlayerMatchup";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

export interface ComparePlayerItem {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  ratings?: Record<string, number> | { overall?: number } | null;
  team?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

export interface ClubTransfersSectionProps {
  teamId: string;
  teamColor?: string;
  squadPlayers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ratings?: Record<string, number> | { overall?: number } | null;
  }>;
  onRefreshOverview?: () => void;
}

export function ClubTransfersSection({
  teamId,
  teamColor = "#3b82f6",
  squadPlayers = [],
  onRefreshOverview,
}: ClubTransfersSectionProps) {
  const notify = useNotify();
  const [searchQuery, setSearchQuery] = useState("");
  const [comparePlayer, setComparePlayer] = useState<ComparePlayerItem | null>(null);

  const { data: searchResults } = api.sports.searchSportsEntities.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 1 }
  );

  const { data: bidsData, refetch: refetchBids } = api.sports.getTeamBids.useQuery({ teamId });

  const { data: listingsData, refetch: refetchListings } =
    api.sports.getOpenTransferListings.useQuery();

  const placeBid = api.sports.placeTransferBid.useMutation({
    onSuccess: () => {
      notify.success("Bid placed successfully!");
      refetchBids();
      refetchListings();
      onRefreshOverview?.();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to place bid");
    },
  });

  const respondToBid = api.sports.respondToTransferBid.useMutation({
    onSuccess: (res) => {
      notify.success(res.message || "Bid response processed!");
      refetchBids();
      refetchListings();
      onRefreshOverview?.();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to process bid");
    },
  });

  const squadComparePlayer = useMemo(() => {
    if (!comparePlayer || squadPlayers.length === 0) return null;
    const comparePos = comparePlayer.position || "";
    const samePos = squadPlayers.filter(
      (p) => p.position && p.position.toUpperCase() === comparePos.toUpperCase()
    );
    if (samePos.length === 0) return squadPlayers[0] || null;
    return (
      [...samePos].sort((a, b) => {
        const ovrA = (a.ratings as { overall?: number } | undefined)?.overall ?? 50;
        const ovrB = (b.ratings as { overall?: number } | undefined)?.overall ?? 50;
        return ovrB - ovrA;
      })[0] || null
    );
  }, [comparePlayer, squadPlayers]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left Column: search and active listings */}
      <div className="space-y-6 lg:col-span-2">
        <Card className="facet-hierarchy-child bg-card/45 border-border">
          <CardHeader>
            <CardTitle>Transfer Marketplace Search</CardTitle>
            <CardDescription className="text-muted-foreground">
              Search athletes across leagues to draft or bid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
                <Input
                  placeholder="Search player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border bg-background/40 pl-9"
                />
              </div>
            </div>

            {searchResults && (
              <div className="divide-border divide-y pt-2">
                {searchResults.players?.map((p: {
                  id: string;
                  name: string;
                  position: string;
                  teamName: string;
                  listing: { id: string; price: number; status: string } | null;
                }) => (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-muted-foreground text-xs">
                        <PositionTooltip position={p.position}>
                          <span className="hover:text-foreground cursor-help font-medium transition-colors">
                            {p.position}
                          </span>
                        </PositionTooltip>{" "}
                        &middot; {p.teamName}
                      </p>
                      {p.listing && (
                        <p className="mt-0.5 text-[10px] font-semibold text-cyan-400">
                          Listed for ₷{p.listing.price}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.listing && p.listing.status === "open" ? (
                        <>
                          <Input
                            type="number"
                            className="border-border bg-background/40 h-8 w-16 text-center text-xs"
                            placeholder="Bid"
                            id={`search-bid-${p.id}`}
                            defaultValue={p.listing.price}
                          />
                          <Button
                            size="sm"
                            style={{ backgroundColor: teamColor }}
                            className="h-8 text-xs font-semibold text-white transition-all hover:opacity-90"
                            onClick={() => {
                              const inputEl = document.getElementById(
                                `search-bid-${p.id}`
                              ) as HTMLInputElement | null;
                              const amt = Number(inputEl?.value || p.listing?.price || 10);
                              if (p.listing) {
                                placeBid.mutate({
                                  listingId: p.listing.id,
                                  amount: amt,
                                  bidderTeamId: teamId,
                                });
                              }
                            }}
                            disabled={placeBid.isPending}
                          >
                            Bid
                          </Button>
                        </>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border/50 text-muted-foreground text-[10px]"
                        >
                          Not Listed
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {searchResults.players?.length === 0 && (
                  <p className="text-muted-foreground py-4 text-center text-xs">
                    No athletes found matching query.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Marketplace Listings */}
        <Card className="facet-hierarchy-child bg-card/45 border-border">
          <CardHeader>
            <CardTitle>Active Transfer Listings</CardTitle>
            <CardDescription className="text-muted-foreground">
              All players currently listed for transfer in the league.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-border divide-y">
            {listingsData && listingsData.length > 0 ? (
              listingsData.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-bold">
                      {l.player.firstName} {l.player.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <PositionTooltip position={l.player.position}>
                        <span className="hover:text-foreground cursor-help font-medium transition-colors">
                          {l.player.position}
                        </span>
                      </PositionTooltip>{" "}
                      &middot; {l.player.team.name} &middot; OVR{" "}
                      {(l.player.ratings as { overall?: number } | undefined)?.overall ?? 50}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-cyan-500 dark:text-cyan-400">
                      Asking Price: ₷{l.price}
                    </p>
                  </div>
                  {l.player.teamId !== teamId ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-muted-foreground hover:bg-muted/80 h-8 text-xs"
                        onClick={() => setComparePlayer(l.player as unknown as ComparePlayerItem)}
                      >
                        Compare
                      </Button>
                      <Input
                        type="number"
                        className="border-border bg-background/40 h-8 w-16 text-center text-xs"
                        placeholder="Bid"
                        defaultValue={l.price}
                        id={`bid-amount-${l.id}`}
                      />
                      <Button
                        size="sm"
                        style={{ backgroundColor: teamColor }}
                        className="h-8 text-xs font-semibold text-white transition-all hover:opacity-90"
                        onClick={() => {
                          const inputVal = (
                            document.getElementById(`bid-amount-${l.id}`) as HTMLInputElement
                          )?.value;
                          const amt = Number(inputVal || l.price);
                          placeBid.mutate({
                            listingId: l.id,
                            amount: amt,
                            bidderTeamId: teamId,
                          });
                        }}
                        disabled={placeBid.isPending}
                      >
                        Bid
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border text-muted-foreground text-[10px]"
                    >
                      My Player
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No active listings on the market.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Inbound/Outbound bid list & Comparison */}
      <div className="space-y-6">
        {comparePlayer && squadComparePlayer && (
          <Card className="facet-hierarchy-child bg-card/45 border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-bold tracking-wider uppercase">
                Comparison Detail
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground h-6 px-2 text-[10px]"
                onClick={() => setComparePlayer(null)}
              >
                Clear
              </Button>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <PlayerMatchup
                playerA={{
                  id: squadComparePlayer.id,
                  firstName: squadComparePlayer.firstName,
                  lastName: squadComparePlayer.lastName,
                  position: squadComparePlayer.position,
                  overallRating:
                    (squadComparePlayer.ratings as { overall?: number } | undefined)?.overall ?? 50,
                  teamColor: teamColor,
                  ratings: (squadComparePlayer.ratings as Record<string, number>) ?? {},
                }}
                playerB={{
                  id: comparePlayer.id,
                  firstName: comparePlayer.firstName,
                  lastName: comparePlayer.lastName,
                  position: comparePlayer.position,
                  overallRating:
                    (comparePlayer.ratings as { overall?: number } | undefined)?.overall ?? 50,
                  teamColor: comparePlayer.team?.color ?? "#ef4444",
                  ratings: (comparePlayer.ratings as Record<string, number>) ?? {},
                }}
                className="border-none bg-transparent p-0 shadow-none dark:bg-transparent"
              />
            </CardContent>
          </Card>
        )}

        {/* Inbound Bids */}
        <Card className="facet-hierarchy-child bg-card/40 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowLeftRight className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              Inbound Bids (Offers on My Players)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bidsData?.inboundBids && bidsData.inboundBids.length > 0 ? (
              bidsData.inboundBids.map((b) => (
                <div
                  key={b.id}
                  className="border-border bg-muted/40 space-y-2 rounded-xl border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold">
                        {b.listing.player.firstName} {b.listing.player.lastName}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        Bid amount: ₷{b.amount}
                      </p>
                    </div>
                    <Badge className="border border-amber-500/20 bg-amber-500/20 text-[9px] font-bold text-amber-500 uppercase dark:text-amber-400">
                      {b.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      style={{ backgroundColor: teamColor }}
                      className="h-7 flex-1 text-xs font-semibold text-white transition-all hover:opacity-90"
                      onClick={() => respondToBid.mutate({ bidId: b.id, action: "accept" })}
                      disabled={respondToBid.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 flex-1 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => respondToBid.mutate({ bidId: b.id, action: "reject" })}
                      disabled={respondToBid.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-xs">
                No pending offers on your roster.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Outbound Bids */}
        <Card className="facet-hierarchy-child bg-card/40 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowLeftRight className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
              My Outbound Bids
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bidsData?.outboundBids && bidsData.outboundBids.length > 0 ? (
              bidsData.outboundBids.map((b) => (
                <div
                  key={b.id}
                  className="border-border bg-muted/40 flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="text-xs font-bold">
                      {b.listing.player.firstName} {b.listing.player.lastName}
                    </p>
                    <p className="text-muted-foreground text-[10px]">Bid: ₷{b.amount}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-bold uppercase",
                      b.status === "accepted" &&
                        "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
                      b.status === "rejected" &&
                        "border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400",
                      b.status === "pending" &&
                        "border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                    )}
                  >
                    {b.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-xs">
                You have no active outbound bids.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClubTransfersSection;
