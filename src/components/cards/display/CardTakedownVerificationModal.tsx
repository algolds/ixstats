"use client";

import React, { useState, useEffect } from "react";
import { skipToken } from "@tanstack/react-query";
import {
  ShieldAlert,
  OpenNewWindow as ExternalLink,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
} from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export interface CardTakedownVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardTitle: string;
  nsCardId?: number | null;
  season?: number | null;
  defaultNationName?: string;
  onTakedownSuccess?: () => void;
}

export function CardTakedownVerificationModal({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  nsCardId,
  season,
  defaultNationName = "",
  onTakedownSuccess,
}: CardTakedownVerificationModalProps) {
  const [nationName, setNationName] = useState(defaultNationName || cardTitle || "");
  const [debouncedNation, setDebouncedNation] = useState(defaultNationName || cardTitle || "");
  const [checksum, setChecksum] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const submittedReason = selectedReason === "custom" ? customReason.trim() : selectedReason;

  // Debounce nation name for URL fetch (avoids request-per-keystroke)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNation(nationName.trim()), 400);
    return () => clearTimeout(t);
  }, [nationName]);

  const { data: verifyUrlData } = api.nsImport.getVerificationUrl.useQuery(
    debouncedNation ? { nationName: debouncedNation } : skipToken,
    { staleTime: Infinity }
  );

  const verifyUrl = verifyUrlData?.url ?? "https://www.nationstates.net/page=verify_login";

  const takedownMutation = api.nsImport.requestSelfServiceTakedown.useMutation({
    onSuccess: (data) => {
      setSuccessMessage(data.message);
      if (onTakedownSuccess) {
        onTakedownSuccess();
      }
    },
  });

  const handleVerifyAndTakedown = () => {
    if (!nationName.trim() || !checksum.trim()) return;
    takedownMutation.mutate({
      cardId,
      nationName: nationName.trim(),
      checksum: checksum.trim(),
      reason: submittedReason || undefined,
    });
  };

  const handleClose = () => {
    setSuccessMessage(null);
    setChecksum("");
    setSelectedReason("");
    setCustomReason("");
    takedownMutation.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="border-border/40 bg-card/95 rounded-2xl p-6 shadow-2xl backdrop-blur-xl sm:max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg font-bold">
                Content Removal Request
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Submit a verified ownership claim to request immediate removal of associated artwork
                for <span className="text-foreground font-semibold">{cardTitle}</span>
                {nsCardId && season ? ` (Card #${nsCardId})` : ""}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-foreground text-xs font-medium">{successMessage}</p>
            <Button onClick={handleClose} className="h-9 w-full rounded-xl text-xs font-semibold">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Nation name first — drives the dynamic verify URL */}
            <div>
              <label className="text-muted-foreground mb-1 block text-[11px] font-semibold">
                Nation Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nationName}
                onChange={(e) => setNationName(e.target.value)}
                placeholder="e.g. The Grendels"
                className="border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-xl border px-3 text-xs transition-all outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Verification Instructions — OAuth-style steps */}
            <div className="border-border/60 bg-muted/40 text-muted-foreground space-y-2.5 rounded-xl border p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-[11px] font-semibold tracking-wide uppercase">
                  How to verify ownership
                </span>
                <a
                  href="https://www.nationstates.net/pages/api.html#verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  NS API Docs <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <ol className="space-y-2 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-border text-foreground mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                    1
                  </span>
                  <span>
                    Sign in to NationStates and visit your{" "}
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      nation-specific verify page
                    </a>
                    {!debouncedNation &&
                      " (enter your nation name above to get your personalised link)"}
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-border text-foreground mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                    2
                  </span>
                  <span>Copy the one-time verification token shown on that page.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-border text-foreground mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
                    3
                  </span>
                  <span>
                    Paste the token below. It grants <em>verification only</em> — no access to or
                    control over your nation.
                  </span>
                </li>
              </ol>
            </div>

            {/* Remaining inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground mb-1 block text-[11px] font-semibold">
                  Verification Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  placeholder="Paste one-time token"
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-xl border px-3 font-mono text-xs transition-all outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground block text-[11px] font-semibold">
                  Basis for Removal <span className="text-muted-foreground/60">(Optional)</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="border-border bg-background text-foreground h-9 w-full cursor-pointer rounded-xl border px-3 text-xs transition-all outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                >
                  <option value="">— Select a reason —</option>
                  <option value="I am the nation owner and rights holder of this flag artwork.">
                    I am the rights holder of this flag artwork
                  </option>
                  <option value="This flag was created by me and used without my consent.">
                    Created by me, used without my consent
                  </option>
                  <option value="Privacy concern: I do not want my nation's flag publicly displayed here.">
                    Privacy concern — do not display my flag
                  </option>
                  <option value="custom">Other / Custom reason…</option>
                </select>
                {selectedReason === "custom" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe your basis for removal"
                    autoFocus
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-xl border px-3 text-xs transition-all outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                )}
              </div>
            </div>

            {/* Error Display */}
            {takedownMutation.error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{takedownMutation.error.message}</p>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!nationName.trim() || !checksum.trim() || takedownMutation.isPending}
                onClick={handleVerifyAndTakedown}
                className="h-9 rounded-xl border border-rose-500/30 bg-rose-600 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95"
              >
                {takedownMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Validating Identity...
                  </>
                ) : (
                  "Submit Removal Request"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
