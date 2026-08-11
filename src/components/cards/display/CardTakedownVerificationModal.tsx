"use client";

import React, { useState, useEffect } from "react";
import { skipToken } from "@tanstack/react-query";
import { ShieldAlert, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
      <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl p-6 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Content Removal Request
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Submit a verified ownership claim to request immediate removal of associated artwork for{" "}
                <span className="font-semibold text-foreground">{cardTitle}</span>
                {nsCardId && season ? ` (Card #${nsCardId})` : ""}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-xs font-medium text-foreground">{successMessage}</p>
            <Button onClick={handleClose} className="w-full h-9 rounded-xl font-semibold text-xs">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Nation name first — drives the dynamic verify URL */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                Nation Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nationName}
                onChange={(e) => setNationName(e.target.value)}
                placeholder="e.g. The Grendels"
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
              />
            </div>

            {/* Verification Instructions — OAuth-style steps */}
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wide">How to verify ownership</span>
                <a
                  href="https://www.nationstates.net/pages/api.html#verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 font-medium text-[10px]"
                >
                  NS API Docs <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <ol className="space-y-2 text-[11px] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-border text-[9px] font-bold text-foreground">1</span>
                  <span>
                    Sign in to NationStates and visit your{" "}
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400 font-medium"
                    >
                      nation-specific verify page
                    </a>
                    {!debouncedNation && " (enter your nation name above to get your personalised link)"}.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-border text-[9px] font-bold text-foreground">2</span>
                  <span>Copy the one-time verification token shown on that page.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-border text-[9px] font-bold text-foreground">3</span>
                  <span>Paste the token below. It grants <em>verification only</em> — no access to or control over your nation.</span>
                </li>
              </ol>
            </div>

            {/* Remaining inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Verification Token <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  placeholder="Paste one-time token"
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground block">
                  Basis for Removal <span className="text-muted-foreground/60">(Optional)</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all cursor-pointer"
                >
                  <option value="">— Select a reason —</option>
                  <option value="I am the nation owner and rights holder of this flag artwork.">I am the rights holder of this flag artwork</option>
                  <option value="This flag was created by me and used without my consent.">Created by me, used without my consent</option>
                  <option value="Privacy concern: I do not want my nation's flag publicly displayed here.">Privacy concern — do not display my flag</option>
                  <option value="custom">Other / Custom reason…</option>
                </select>
                {selectedReason === "custom" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe your basis for removal"
                    autoFocus
                    className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                  />
                )}
              </div>
            </div>

            {/* Error Display */}
            {takedownMutation.error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
                className="h-9 rounded-xl border border-rose-500/30 bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 active:scale-95 transition-all shadow-sm"
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
