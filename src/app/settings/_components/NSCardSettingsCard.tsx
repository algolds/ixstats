"use client";

import { useState } from "react";
import { WhiteFlag as Flag, ShieldCheck, EyeClosed as EyeOff, Eye, OpenNewWindow as ExternalLink, HelpCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Button } from "~/components/ui/button";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";
import Link from "next/link";

export function NSCardSettingsCard() {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data, isLoading } = api.nsImport.getMyNSCards.useQuery();

  const [reason, setReason] = useState("");

  const hideMutation = api.nsImport.hideMyCard.useMutation({
    onSuccess: (res) => {
      notify.success("Flag removed", res.message);
      setReason("");
      void utils.nsImport.getMyNSCards.invalidate();
    },
    onError: (err) => {
      notify.error("Takedown failed", err.message);
    },
  });

  const cards = data?.cards ?? [];
  const verifiedNations = (data?.verifiedNations ?? []).map((n) => n.toLowerCase());

  // Group owned NS cards by nation.
  const byNation = new Map<string, typeof cards>();
  for (const card of cards) {
    const key = (card.nation || "Unknown").toLowerCase();
    const list = byNation.get(key) ?? [];
    list.push(card);
    byNation.set(key, list);
  }

  const hideAllForNation = (nation: string) => {
    const nationCards = byNation.get(nation.toLowerCase()) ?? [];
    for (const card of nationCards) {
      if (!card.isHidden && card.nsCardId != null && card.nsSeason != null) {
        hideMutation.mutate({
          nsCardId: card.nsCardId,
          nsSeason: card.nsSeason,
          reason: reason.trim() || undefined,
        });
      }
    }
  };

  return (
    <div className="facet-surface facet-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-5 dark:bg-slate-900/40">
        <TextureOverlay texture="triangular" opacity={0.02} />

        {/* Card Header */}
        <div className="relative z-10 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Flag className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                NationStates Card Opt-Out
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Remove your nation&apos;s flag from IxCards you own
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" />
              <div className="h-16 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40" />
            </div>
          ) : cards.length === 0 ? (
            <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                You don&apos;t own any NationStates-imported cards yet. Once you import your NS deck
                from the Vault, you&apos;ll be able to opt your nation&apos;s flag out of IxCards
                here.
              </p>
              <Link
                href="/vault/ns-deck"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <ExternalLink className="h-4 w-4" />
                Import your NationStates deck
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
                <div className="mb-2 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    How this works
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  NationStates flags remain the property of their authors. If you don&apos;t want
                  your nation&apos;s flag served on IxCards, you can hide the cards below. You must
                  be NS-verified for the nation (via the import flow) to opt it out. Hidden cards
                  are removed from future syncs and can only be restored by a system admin.
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. I no longer want my flag displayed on IxStats."
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100"
                  rows={2}
                />
              </div>

              {Array.from(byNation.entries()).map(([key, nationCards]) => {
                const nation = nationCards[0].nation || "Unknown";
                const isVerified = verifiedNations.includes(key);
                const hiddenCount = nationCards.filter((c) => c.isHidden).length;
                return (
                  <div
                    key={key}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-700/50 dark:bg-slate-800/30"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {nation}
                        </span>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                            <ShieldCheck className="h-3 w-3" />
                            NS-Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Not verified
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {hiddenCount}/{nationCards.length} hidden
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {nationCards.map((card) => (
                        <div
                          key={card.cardId}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 dark:bg-slate-900/40"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                              {card.title}
                              {card.isHidden && (
                                <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500">
                                  Flag removed
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              NS card #{card.nsCardId} · Season {card.nsSeason}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={card.isHidden ? "outline" : "destructive"}
                            disabled={
                              card.isHidden ||
                              hideMutation.isPending ||
                              !isVerified ||
                              card.nsCardId == null ||
                              card.nsSeason == null
                            }
                            onClick={() =>
                              card.nsCardId != null &&
                              card.nsSeason != null &&
                              hideMutation.mutate({
                                nsCardId: card.nsCardId,
                                nsSeason: card.nsSeason,
                                reason: reason.trim() || undefined,
                              })
                            }
                          >
                            {card.isHidden ? (
                              <>
                                <EyeOff className="mr-1 h-3.5 w-3.5" />
                                Hidden
                              </>
                            ) : (
                              <>
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Hide flag
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>

                    {isVerified && hiddenCount < nationCards.length && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        disabled={hideMutation.isPending}
                        onClick={() => hideAllForNation(nation)}
                      >
                        Hide flag on all {nationCards.length} cards
                      </Button>
                    )}
                  </div>
                );
              })}

              {!isLoading && byNation.size === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No NationStates-imported cards found.
                </p>
              )}
            </>
          )}

          <NationStatesAttribution className="!text-[11px]" />
        </div>
      </div>
    </div>
  );
}
