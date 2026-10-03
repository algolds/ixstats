"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { SegmentedControl } from "~/components/ui/segmented-control";
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

export function NSTakedownModal({ isOpen, onClose, defaultNationName = "" }: NSTakedownModalProps) {
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
    claimNation.trim()
      ? { nationName: claimNation.trim() }
      : { nationName: defaultNationName || "test" },
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                NationStates card takedown
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Remove your nation&apos;s flag from cards shown on IxStats.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <SegmentedControl
          aria-label="Takedown step"
          size="sm"
          fullWidth
          value={activeTab}
          onValueChange={(tab) => {
            soundEffects.press();
            setActiveTab(tab);
          }}
          options={[
            { value: "owned", label: `Owned cards (${cards.length})` },
            { value: "verify", label: "Verify nation claim" },
          ]}
        />

        {/* Owned cards */}
        {activeTab === "owned" && (
          <div className="space-y-4 pt-2">
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : cards.length === 0 ? (
              <div className="border-separator bg-surface-secondary rounded-row border p-5 text-center">
                <p className="text-muted-foreground text-xs">
                  You have not imported any NationStates cards. If your nation&apos;s flag appears
                  on other cards, use the <strong>Verify nation claim</strong> tab to request a
                  takedown.
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
                      className="border-separator bg-surface-secondary rounded-row space-y-2.5 border p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground text-xs font-bold">{nation}</span>
                          {isVerified ? (
                            <Badge variant="success">
                              <ShieldCheck aria-hidden />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="warning">Unverified</Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {nationCards.length} {nationCards.length === 1 ? "card" : "cards"}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {nationCards.map((card) => (
                          <div
                            key={card.cardId}
                            className="border-separator bg-surface rounded-row flex items-center justify-between gap-3 border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-foreground truncate text-xs font-medium">
                                {card.title}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                Card #{card.nsCardId} · S{card.nsSeason}
                              </p>
                            </div>

                            <Button
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
                              variant={card.isHidden ? "secondary" : "outline"}
                              size="xs"
                              className={card.isHidden ? undefined : "text-destructive"}
                            >
                              {card.isHidden ? (
                                <>
                                  <EyeOff className="h-3 w-3" />
                                  <span>Hidden</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3" />
                                  <span>Hide flag</span>
                                </>
                              )}
                            </Button>
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

        {/* Verify claim */}
        {activeTab === "verify" && (
          <div className="space-y-4 pt-2">
            {claimSuccessMessage ? (
              <div className="space-y-3 py-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-foreground text-sm font-bold">Takedown request submitted</h4>
                <p className="text-muted-foreground text-xs">{claimSuccessMessage}</p>
                <Button
                  type="button"
                  onClick={handleClose}
                  data-cuelume-press="soft"
                  variant="default"
                  size="sm"
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold">
                    NationStates nation name
                  </label>
                  <Input
                    type="text"
                    value={claimNation}
                    onChange={(e) => setClaimNation(e.target.value)}
                    placeholder="Nation name"
                    className="text-xs"
                  />
                </div>

                <div className="border-separator bg-surface-secondary rounded-row space-y-2 border p-3.5">
                  <p className="text-foreground text-xs font-medium">
                    Step 1: Get your verification code
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Sign in to NationStates and generate a temporary code to prove you own this
                    nation.
                  </p>
                  <Button asChild variant="secondary" size="sm">
                    <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                      <span>Open NationStates verification</span>
                      <ExternalLink aria-hidden />
                    </a>
                  </Button>
                </div>

                <div>
                  <label className="text-foreground mb-1 block text-xs font-semibold">
                    Step 2: Paste the verification code
                  </label>
                  <Input
                    type="text"
                    value={claimChecksum}
                    onChange={(e) => setClaimChecksum(e.target.value)}
                    placeholder="Verification code"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" onClick={handleClose} variant="secondary" size="sm">
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleVerifyClaim}
                    disabled={
                      !claimNation.trim() || !claimChecksum.trim() || verifyClaimMutation.isPending
                    }
                    data-cuelume-press="soft"
                    variant="default"
                    size="sm"
                  >
                    {verifyClaimMutation.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>Submit takedown</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <NationStatesAttribution className="mt-2 !text-xs" />
      </DialogContent>
    </Dialog>
  );
}
