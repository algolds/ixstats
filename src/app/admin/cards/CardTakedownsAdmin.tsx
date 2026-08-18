// src/app/admin/cards/CardTakedownsAdmin.tsx
// NS Card Takedown & Compliance Management
"use client";

import { useState } from "react";
import { ShieldAlert, RefreshCw, CheckCircle, RotateCcw } from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";

export function CardTakedownsAdmin() {
  const notify = useNotify();
  const [takedownCardId, setTakedownCardId] = useState("");
  const [takedownSeason, setTakedownSeason] = useState("");

  const { data: hiddenCards, isLoading, refetch } =
    api.nsImport.listHiddenNSCards.useQuery();

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
      <FacetCard depth={2} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/20 p-2 backdrop-blur-md">
            <ShieldAlert className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h3 className="text-foreground tracking-tight text-lg font-bold">
              NS Card Takedown & Compliance Management
            </h3>
            <p className="text-muted-foreground text-xs font-medium">
              Hide cards for flag-owner copyright requests and legal compliance
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed max-w-3xl">
          If a nation&apos;s flag owner requests artwork removal, hide the card by NS card ID and season.
          The card artwork is cleared and retired so subsequent daily dumps or region fetches will not restore it.
        </p>

        {/* Takedown Input Form */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <input
            value={takedownCardId}
            onChange={(e) => setTakedownCardId(e.target.value.replace(/\D/g, ""))}
            placeholder="NS Card ID"
            inputMode="numeric"
            className="h-9 w-36 rounded-xl border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
          />
          <input
            value={takedownSeason}
            onChange={(e) => setTakedownSeason(e.target.value.replace(/\D/g, ""))}
            placeholder="Season"
            inputMode="numeric"
            className="h-9 w-24 rounded-xl border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
          />
          <Button
            size="sm"
            disabled={
              hideNSCardMutation.isPending || !takedownCardId || !takedownSeason
            }
            onClick={() =>
              hideNSCardMutation.mutate({
                nsCardId: parseInt(takedownCardId, 10),
                nsSeason: parseInt(takedownSeason, 10),
              })
            }
            className="h-9 rounded-xl border border-rose-500/30 bg-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-200 hover:bg-rose-500/30 active:scale-95 transition-all shadow-xs"
          >
            {hideNSCardMutation.isPending ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            )}
            Hide Card
          </Button>
        </div>

        {/* List of Hidden Cards */}
        {hiddenCards && hiddenCards.length > 0 && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
              <span>Taken Down Cards ({hiddenCards.length})</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            <div className="space-y-2">
              {hiddenCards.map((card: any) => (
                <FacetCard
                  key={card.cardId}
                  depth={1}
                  interactive="hover"
                  className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 truncate">
                    <span className="text-foreground font-semibold">
                      {card.title || `#${card.nsCardId}`}
                    </span>
                    <span className="text-muted-foreground ml-2 font-mono">
                      NS ID: {card.nsCardId} S{card.nsSeason}
                    </span>
                    {card.selfService && (
                      <span className="ml-2 rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                        flag-owner request
                      </span>
                    )}
                    {card.reason && (
                      <span className="text-muted-foreground ml-2 truncate">
                        — {card.reason}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground text-[11px] font-mono">
                      {card.retiredAt ? new Date(card.retiredAt).toLocaleDateString() : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoreNSCardMutation.isPending}
                      onClick={() =>
                        restoreNSCardMutation.mutate({
                          nsCardId: card.nsCardId ?? 0,
                          nsSeason: card.nsSeason ?? 0,
                        })
                      }
                      className="h-7 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
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
