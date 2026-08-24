"use client";

import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  EyeClosed as EyeOff,
  Eye,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  CheckCircle as CheckCircle2,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { soundEffects } from "~/lib/sound/cuelume";
import { NationStatesAttribution } from "~/components/cards/display/NationStatesAttribution";

export interface NSTakedownModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultNationName?: string;
}

export function NSTakedownModal({
  isOpen,
  onClose,
  defaultNationName = "",
}: NSTakedownModalProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [activeTab, setActiveTab] = useState<"owned" | "verify">("owned");
  const [reason, setReason] = useState("");

  // Verified claim state
  const [claimNation, setClaimNation] = useState(defaultNationName);
  const [claimChecksum, setClaimChecksum] = useState("");
  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);

  // Queries & Mutations
  const { data: nsCardsData, isLoading } = api.nsImport.getMyNSCards.useQuery(undefined, {
    enabled: isOpen,
  });

  const { data: verifyUrlData } = api.nsImport.getVerificationUrl.useQuery(
    claimNation.trim() ? { nationName: claimNation.trim() } : { nationName: defaultNationName || "test" },
    { enabled: isOpen && Boolean(claimNation.trim()) }
  );

  const verifyUrl = verifyUrlData?.url ?? "https://www.nationstates.net/page=verify_login";

  const hideMutation = api.nsImport.hideMyCard.useMutation({
    onSuccess: (res) => {
      soundEffects.bloom();
      notify.success("Flag removed", res.message);
      setReason("");
      void utils.nsImport.getMyNSCards.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error("Takedown failed", err.message);
    },
  });

  const verifyClaimMutation = api.nsImport.requestSelfServiceTakedown.useMutation({
    onSuccess: (data) => {
      soundEffects.bloom();
      setClaimSuccessMessage(data.message);
      void utils.nsImport.getMyNSCards.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error("Verification failed", err.message);
    },
  });

  const cards = nsCardsData?.cards ?? [];
  const verifiedNations = (nsCardsData?.verifiedNations ?? []).map((n) => n.toLowerCase());

  // Group owned cards by nation
  const byNation = new Map<string, typeof cards>();
  for (const card of cards) {
    const key = (card.nation || "Unknown").toLowerCase();
    const list = byNation.get(key) ?? [];
    list.push(card);
    byNation.set(key, list);
  }

  const handleClose = () => {
    setClaimSuccessMessage(null);
    setClaimChecksum("");
    setReason("");
    onClose();
  };

  const handleVerifyClaim = () => {
    if (!claimNation.trim() || !claimChecksum.trim()) return;
    soundEffects.press();
    // For general nation takedown, find an owned card or use first available
    const matchedCard = cards.find(
      (c) => (c.nation || "").toLowerCase() === claimNation.trim().toLowerCase()
    );
    verifyClaimMutation.mutate({
      cardId: matchedCard?.cardId || "",
      nationName: claimNation.trim(),
      checksum: claimChecksum.trim(),
      reason: reason.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="border-border/60 bg-card/95 rounded-2xl p-6 shadow-2xl backdrop-blur-xl sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                NationStates Card Takedown & Opt-Out
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Remove your nation&apos;s flag from cards served on the platform.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              setActiveTab("owned");
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              activeTab === "owned"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Owned Cards ({cards.length})
          </button>
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              setActiveTab("verify");
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              activeTab === "verify"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Verify Nation Claim
          </button>
        </div>

        {/* Tab: Owned Cards */}
        {activeTab === "owned" && (
          <div className="space-y-4 pt-2">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : cards.length === 0 ? (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-5 text-center">
                <p className="text-xs text-muted-foreground">
                  You don&apos;t have any NationStates-imported cards in your collection. If your nation&apos;s flag appears on other cards, use the{" "}
                  <strong>Verify Nation Claim</strong> tab to submit a takedown.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(byNation.entries()).map(([key, nationCards]) => {
                  const nation = nationCards[0].nation || "Unknown";
                  const isVerified = verifiedNations.includes(key);

                  return (
                    <div
                      key={key}
                      className="rounded-xl border border-border/60 bg-muted/15 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{nation}</span>
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:text-amber-400">
                              Unverified
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {nationCards.length} {nationCards.length === 1 ? "card" : "cards"}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {nationCards.map((card) => (
                          <div
                            key={card.cardId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">
                                {card.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Card #{card.nsCardId} · S{card.nsSeason}
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={
                                card.isHidden ||
                                hideMutation.isPending ||
                                !isVerified ||
                                card.nsCardId == null ||
                                card.nsSeason == null
                              }
                              onClick={() => {
                                if (card.nsCardId != null && card.nsSeason != null) {
                                  soundEffects.press();
                                  hideMutation.mutate({
                                    nsCardId: card.nsCardId,
                                    nsSeason: card.nsSeason,
                                    reason: reason.trim() || undefined,
                                  });
                                }
                              }}
                              data-cuelume-press="soft"
                              className={`facet-interactive flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.98] ${
                                card.isHidden
                                  ? "border border-border/60 bg-muted text-muted-foreground"
                                  : "border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                              }`}
                            >
                              {card.isHidden ? (
                                <>
                                  <EyeOff className="h-3 w-3" />
                                  <span>Hidden</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3" />
                                  <span>Hide Flag</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Verify Nation Claim */}
        {activeTab === "verify" && (
          <div className="space-y-4 pt-2">
            {claimSuccessMessage ? (
              <div className="space-y-3 py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">Takedown Request Submitted</h4>
                <p className="text-xs text-muted-foreground">{claimSuccessMessage}</p>
                <button
                  type="button"
                  onClick={handleClose}
                  data-cuelume-press="soft"
                  className="facet-interactive mt-2 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background hover:opacity-90 active:scale-[0.98]"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    NationStates Nation Name
                  </label>
                  <Input
                    type="text"
                    value={claimNation}
                    onChange={(e) => setClaimNation(e.target.value)}
                    placeholder="Enter nation name..."
                    className="text-xs"
                  />
                </div>

                <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Step 1: Get your verification checksum code
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sign in to NationStates and generate a temporary code to prove ownership of this flag.
                  </p>
                  <a
                    href={verifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="facet-interactive inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98]"
                  >
                    <span>Open NationStates Verification</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Step 2: Paste Verification Checksum
                  </label>
                  <Input
                    type="text"
                    value={claimChecksum}
                    onChange={(e) => setClaimChecksum(e.target.value)}
                    placeholder="Paste checksum code..."
                    className="text-xs font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="facet-interactive rounded-xl border border-border/60 bg-card px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyClaim}
                    disabled={
                      !claimNation.trim() ||
                      !claimChecksum.trim() ||
                      verifyClaimMutation.isPending
                    }
                    data-cuelume-press="soft"
                    className="facet-interactive flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                  >
                    {verifyClaimMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Submit Takedown</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <NationStatesAttribution className="mt-2 !text-[10px]" />
      </DialogContent>
    </Dialog>
  );
}
