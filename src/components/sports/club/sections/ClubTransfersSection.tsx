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

interface ComparePlayerItem {
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

interface ClubTransfersSectionProps {
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
      notify.success("Bid placed");
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
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Transfer marketplace search</CardTitle>
            <CardDescription className="text-label-secondary">
              Search athletes across leagues to draft or bid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="text-label-secondary absolute top-3 left-3 size-4" aria-hidden />
                <Input
                  placeholder="Search player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {searchResults && (
              <div className="divide-separator divide-y pt-2">
                {searchResults.players?.map(
                  (p: {
                    id: string;
                    name: string;
                    position: string;
                    teamName: string;
                    listing: { id: string; price: number; status: string } | null;
                  }) => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-headline">{p.name}</p>
                        <p className="text-label-secondary text-footnote">
                          <PositionTooltip position={p.position}>
                            <span className="hover:text-label cursor-help font-medium transition-colors">
                              {p.position}
                            </span>
                          </PositionTooltip>{" "}
                          &middot; {p.teamName}
                        </p>
                        {p.listing && (
                          <p className="text-footnote text-tint mt-0.5 font-medium tabular-nums">
                            Listed for ₷{p.listing.price}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.listing && p.listing.status === "open" ? (
                          <>
                            <Input
                              type="number"
                              className="h-8 w-20 text-center tabular-nums"
                              placeholder="Bid"
                              id={`search-bid-${p.id}`}
                              defaultValue={p.listing.price}
                            />
                            <Button
                              size="sm"
                              variant="secondary"
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
                          <Badge variant="default">Not listed</Badge>
                        )}
                      </div>
                    </div>
                  )
                )}
                {searchResults.players?.length === 0 && (
                  <p className="text-label-secondary text-footnote py-4 text-center">
                    No athletes found matching query.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Marketplace Listings */}
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle>Active transfer listings</CardTitle>
            <CardDescription className="text-label-secondary">
              All players currently listed for transfer in the league.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-separator divide-y">
            {listingsData && listingsData.length > 0 ? (
              listingsData.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-headline">
                      {l.player.firstName} {l.player.lastName}
                    </p>
                    <p className="text-label-secondary text-footnote">
                      <PositionTooltip position={l.player.position}>
                        <span className="hover:text-label cursor-help font-medium transition-colors">
                          {l.player.position}
                        </span>
                      </PositionTooltip>{" "}
                      &middot; {l.player.team.name} &middot; OVR{" "}
                      {(l.player.ratings as { overall?: number } | undefined)?.overall ?? "—"}
                    </p>
                    <p className="text-footnote text-tint mt-0.5 font-medium tabular-nums">
                      Asking Price: ₷{l.price}
                    </p>
                  </div>
                  {l.player.teamId !== teamId ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setComparePlayer(l.player as unknown as ComparePlayerItem)}
                      >
                        Compare
                      </Button>
                      <Input
                        type="number"
                        className="h-8 w-20 text-center tabular-nums"
                        placeholder="Bid"
                        defaultValue={l.price}
                        id={`bid-amount-${l.id}`}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
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
                    <Badge variant="default">My player</Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-label-secondary text-footnote py-4 text-center">
                No active listings on the market.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Inbound/Outbound bid list & Comparison */}
      <div className="space-y-6">
        {comparePlayer && squadComparePlayer && (
          <Card className="flex flex-col gap-6 py-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-headline text-label">Comparison detail</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setComparePlayer(null)}>
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
                  overallRating: (squadComparePlayer.ratings as { overall?: number } | undefined)
                    ?.overall,
                  teamColor: teamColor,
                  ratings: (squadComparePlayer.ratings as Record<string, number>) ?? {},
                }}
                playerB={{
                  id: comparePlayer.id,
                  firstName: comparePlayer.firstName,
                  lastName: comparePlayer.lastName,
                  position: comparePlayer.position,
                  overallRating: (comparePlayer.ratings as { overall?: number } | undefined)
                    ?.overall,
                  teamColor: comparePlayer.team?.color ?? "#ef4444",
                  ratings: (comparePlayer.ratings as Record<string, number>) ?? {},
                }}
                className="border-none bg-transparent p-0 shadow-none"
              />
            </CardContent>
          </Card>
        )}

        {/* Inbound Bids */}
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="text-green h-4 w-4" />
              Inbound Bids (Offers on My Players)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bidsData?.inboundBids && bidsData.inboundBids.length > 0 ? (
              bidsData.inboundBids.map((b) => (
                <div key={b.id} className="bg-surface-secondary rounded-row space-y-2 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-headline">
                        {b.listing.player.firstName} {b.listing.player.lastName}
                      </p>
                      <p className="text-label-secondary text-footnote">Bid amount: ₷{b.amount}</p>
                    </div>
                    <Badge variant="warning" className="capitalize">
                      {b.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => respondToBid.mutate({ bidId: b.id, action: "accept" })}
                      disabled={respondToBid.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 flex-1"
                      onClick={() => respondToBid.mutate({ bidId: b.id, action: "reject" })}
                      disabled={respondToBid.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-label-secondary text-footnote py-4 text-center">
                No pending offers on your roster.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Outbound Bids */}
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="text-teal h-4 w-4" />
              My outbound bids
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bidsData?.outboundBids && bidsData.outboundBids.length > 0 ? (
              bidsData.outboundBids.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface-secondary rounded-row flex items-center justify-between p-3"
                >
                  <div>
                    <p className="text-footnote font-semibold">
                      {b.listing.player.firstName} {b.listing.player.lastName}
                    </p>
                    <p className="text-label-secondary text-footnote">Bid: ₷{b.amount}</p>
                  </div>
                  <Badge
                    className="capitalize"
                    variant={
                      b.status === "accepted"
                        ? "success"
                        : b.status === "rejected"
                          ? "destructive"
                          : b.status === "pending"
                            ? "warning"
                            : "outline"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-label-secondary text-footnote py-4 text-center">
                You have no active outbound bids.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
