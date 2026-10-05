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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** Select items cannot carry an empty value; this stands for "no reason given". */
const NO_REASON = "__none__";

interface CardTakedownVerificationModalProps {
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
      <DialogContent className="border-separator bg-surface rounded-card shadow-card p-6 sm:max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="rounded-row border-red/30 bg-red/10 text-red border p-2">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-label text-title-3">Content removal request</DialogTitle>
              <DialogDescription className="text-label-secondary text-footnote">
                Submit a verified ownership claim to request immediate removal of associated artwork
                for <span className="text-label font-semibold">{cardTitle}</span>
                {nsCardId && season ? ` (Card #${nsCardId})` : ""}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4 py-4 text-center">
            <div className="border-green/30 bg-green/20 text-green mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-label text-footnote font-medium">{successMessage}</p>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Nation name first — drives the dynamic verify URL */}
            <div>
              <label className="text-label-secondary text-footnote mb-1 block font-semibold">
                Nation Name <span className="text-red">*</span>
              </label>
              <input
                type="text"
                value={nationName}
                onChange={(e) => setNationName(e.target.value)}
                placeholder="e.g. The Grendels"
                className="border-separator bg-background text-label placeholder:text-label-secondary rounded-row text-footnote focus:border-red focus:ring-red h-9 w-full border px-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none focus:ring-1"
              />
            </div>

            {/* Verification Instructions — OAuth-style steps */}
            <div className="border-separator bg-fill-3 text-label-secondary rounded-row text-footnote space-y-2 border p-3">
              <div className="flex items-center justify-between">
                <span className="text-label text-footnote font-semibold">
                  How to verify ownership
                </span>
                <a
                  href="https://www.nationstates.net/pages/api.html#verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-footnote text-blue inline-flex items-center gap-1 font-medium hover:underline"
                >
                  NS API Docs <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <ol className="text-footnote space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-semibold">
                    1
                  </span>
                  <span>
                    Sign in to NationStates and visit your{" "}
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue font-medium hover:underline"
                    >
                      nation-specific verify page
                    </a>
                    {!debouncedNation &&
                      " (enter your nation name above to get your personalised link)"}
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-semibold">
                    2
                  </span>
                  <span>Copy the one-time verification token shown on that page.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-semibold">
                    3
                  </span>
                  <span>
                    Paste the token below. It grants <em>verification only</em>, with no access to
                    or control over your nation.
                  </span>
                </li>
              </ol>
            </div>

            {/* Remaining inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-label-secondary text-footnote mb-1 block font-semibold">
                  Verification Token <span className="text-red">*</span>
                </label>
                <input
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  placeholder="Paste one-time token"
                  className="border-separator bg-background text-label placeholder:text-label-secondary rounded-row text-footnote focus:border-red focus:ring-red h-9 w-full border px-3 font-mono transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none focus:ring-1"
                />
              </div>

              <div className="space-y-2">
                <label
                  id="takedown-reason-label"
                  className="text-label-secondary text-footnote block font-semibold"
                >
                  Basis for Removal <span className="text-label-tertiary">(Optional)</span>
                </label>
                <Select
                  value={selectedReason || NO_REASON}
                  onValueChange={(v) => setSelectedReason(v === NO_REASON ? "" : v)}
                >
                  <SelectTrigger aria-labelledby="takedown-reason-label" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REASON}>Select a reason</SelectItem>
                    <SelectItem value="I am the nation owner and rights holder of this flag artwork.">
                      I am the rights holder of this flag artwork
                    </SelectItem>
                    <SelectItem value="This flag was created by me and used without my consent.">
                      Created by me, used without my consent
                    </SelectItem>
                    <SelectItem value="Privacy concern: I do not want my nation's flag publicly displayed here.">
                      Privacy concern: do not display my flag
                    </SelectItem>
                    <SelectItem value="custom">Other / Custom reason…</SelectItem>
                  </SelectContent>
                </Select>
                {selectedReason === "custom" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe your basis for removal"
                    autoFocus
                    className="border-separator bg-background text-label placeholder:text-label-secondary rounded-row text-footnote focus:border-red focus:ring-red h-9 w-full border px-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none focus:ring-1"
                  />
                )}
              </div>
            </div>

            {/* Error Display */}
            {takedownMutation.error && (
              <div className="rounded-row border-red/30 bg-red/10 text-footnote text-red flex items-start gap-2 border p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{takedownMutation.error.message}</p>
              </div>
            )}

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!nationName.trim() || !checksum.trim() || takedownMutation.isPending}
                onClick={handleVerifyAndTakedown}
                className="border-red/30 bg-red text-on-red border"
              >
                {takedownMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
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
