"use client";
// src/app/admin/cards/CardTakedownsAdmin.tsx
// NS Card Takedown & Compliance Management

import { useState } from "react";
import { ShieldAlert, Refresh as RefreshCw, Undo as RotateCcw } from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";

export function CardTakedownsAdmin() {
  const notify = useNotify();
  const [takedownCardId, setTakedownCardId] = useState("");
  const [takedownSeason, setTakedownSeason] = useState("");

  const { data: hiddenCards, isLoading, refetch } = api.nsImport.listHiddenNSCards.useQuery();

  const hideNSCardMutation = api.nsImport.hideNSCard.useMutation({
    onSuccess: () => {
      notify.success("Card Taken Down", "Card artwork cleared and marked as retired.");
      setTakedownCardId("");
      setTakedownSeason("");
      void refetch();
    },
    onError: (err: { message: string }) => notify.error("Takedown Failed", err.message),
  });

  const restoreNSCardMutation = api.nsImport.restoreNSCard.useMutation({
    onSuccess: () => {
      notify.success("Card Restored", "Card status set back to active.");
      void refetch();
    },
    onError: (err: { message: string }) => notify.error("Restore Failed", err.message),
  });

  return (
    <div className="space-y-6">
      <FacetCard className="border-red/30 bg-red/5 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-red/30 bg-red/20 border p-2">
            <ShieldAlert className="text-red h-5 w-5" />
          </div>
          <div>
            <h3 className="text-label text-title-3">NS Card Takedown & Compliance Management</h3>
            <p className="text-label-secondary text-caption">
              Hide cards for flag-owner copyright requests and legal compliance
            </p>
          </div>
        </div>
        <p className="text-label-secondary text-footnote max-w-3xl leading-relaxed">
          If a nation&apos;s flag owner requests artwork removal, hide the card by NS card ID and
          season. The card artwork is cleared and retired so subsequent daily dumps or region
          fetches will not restore it.
        </p>

        {/* Takedown Input Form */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Input
            value={takedownCardId}
            onChange={(e) => setTakedownCardId(e.target.value.replace(/\D/g, ""))}
            placeholder="NS Card ID"
            inputMode="numeric"
            className="w-36"
          />
          <Input
            value={takedownSeason}
            onChange={(e) => setTakedownSeason(e.target.value.replace(/\D/g, ""))}
            placeholder="Season"
            inputMode="numeric"
            className="w-24"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={hideNSCardMutation.isPending || !takedownCardId || !takedownSeason}
            onClick={() =>
              hideNSCardMutation.mutate({
                nsCardId: parseInt(takedownCardId, 10),
                nsSeason: parseInt(takedownSeason, 10),
              })
            }
          >
            {hideNSCardMutation.isPending ? (
              <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="mr-2 h-3.5 w-3.5" />
            )}
            Hide Card
          </Button>
        </div>

        {/* List of Hidden Cards */}
        {hiddenCards && hiddenCards.length > 0 && (
          <div className="border-separator space-y-3 border-t pt-4">
            <div className="text-label-secondary text-eyebrow flex items-center justify-between">
              <span>Taken Down Cards ({hiddenCards.length})</span>
              <Button variant="ghost" size="sm" onClick={() => void refetch()}>
                <RefreshCw className={`mr-1 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {hiddenCards.map((card: any) => (
                <FacetCard
                  key={card.cardId}
                  interactive="hover"
                  className="rounded-row text-footnote flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0 truncate">
                    <span className="text-label font-semibold">
                      {card.title || `#${card.nsCardId}`}
                    </span>
                    <span className="text-label-secondary ml-2 font-mono">
                      NS ID: {card.nsCardId} S{card.nsSeason}
                    </span>
                    {card.selfService && (
                      <Badge variant="red" className="ml-2">
                        flag-owner request
                      </Badge>
                    )}
                    {card.reason && (
                      <span className="text-label-secondary ml-2 truncate">— {card.reason}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-label-secondary text-footnote tabular-nums">
                      {card.retiredAt ? new Date(card.retiredAt).toLocaleDateString() : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="tinted"
                      disabled={restoreNSCardMutation.isPending}
                      onClick={() =>
                        restoreNSCardMutation.mutate({
                          nsCardId: card.nsCardId ?? 0,
                          nsSeason: card.nsSeason ?? 0,
                        })
                      }
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Restore
                    </Button>
                  </div>
                </FacetCard>
              ))}
            </div>
          </div>
        )}
      </FacetCard>
    </div>
  );
}
