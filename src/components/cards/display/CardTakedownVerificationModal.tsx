"use client";

import { useId, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import {
  ShieldAlert,
  OpenNewWindow as ExternalLink,
  CheckCircle as CheckCircle2,
} from "iconoir-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button, focusRing } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Signal } from "~/components/ui/signal";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils/cn";
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
  /** Where focus goes once it closes, for an opener that is gone by then (a popover's button). */
  onCloseAutoFocus?: (event: Event) => void;
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
  onCloseAutoFocus,
}: CardTakedownVerificationModalProps) {
  const baseId = useId();
  const nationInputId = `${baseId}-nation`;
  const tokenInputId = `${baseId}-token`;
  const reasonSelectId = `${baseId}-reason`;
  const customReasonId = `${baseId}-custom-reason`;

  const [nationName, setNationName] = useState(defaultNationName || cardTitle || "");
  const [checksum, setChecksum] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const debouncedNation = useDebounce(nationName.trim(), 400);
  const submittedReason = selectedReason === "custom" ? customReason.trim() : selectedReason;

  const { data: verifyUrlData } = api.nsImport.getVerificationUrl.useQuery(
    debouncedNation ? { nationName: debouncedNation } : skipToken,
    { staleTime: Infinity }
  );

  const verifyUrl = verifyUrlData?.url ?? "https://www.nationstates.net/page=verify_login";

  const takedownMutation = api.nsImport.requestSelfServiceTakedown.useMutation({
    onSuccess: () => {
      if (onTakedownSuccess) {
        onTakedownSuccess();
      }
    },
  });

  const successMessage = takedownMutation.data?.message ?? null;

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
    setChecksum("");
    setSelectedReason("");
    setCustomReason("");
    takedownMutation.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-row border-destructive/25 bg-destructive/10 text-destructive-ink border p-2">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-label text-title-3">Content removal request</DialogTitle>
              <DialogDescription className="text-label-secondary text-footnote">
                Submit a verified ownership claim to request immediate removal of associated artwork
                for <span className="text-label font-medium">{cardTitle}</span>
                {nsCardId && season ? ` (Card #${nsCardId})` : ""}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="space-y-4 py-4 text-center">
            <div className="border-success/30 bg-success/15 text-success-ink mx-auto flex h-12 w-12 items-center justify-center rounded-full border">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-label text-footnote font-medium">{successMessage}</p>
            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Nation name drives the dynamic verification URL */}
            <div className="space-y-1.5">
              <Label htmlFor={nationInputId}>
                Nation name <span className="text-destructive-ink">*</span>
              </Label>
              <Input
                id={nationInputId}
                type="text"
                value={nationName}
                onChange={(e) => setNationName(e.target.value)}
                placeholder="e.g. The Grendels"
              />
            </div>

            {/* Verification instructions */}
            <div className="border-separator bg-surface-secondary text-label-secondary rounded-row text-footnote space-y-2 border p-3">
              <div className="flex items-center justify-between">
                <span className="text-label text-subhead font-medium">How to verify ownership</span>
                <a
                  href="https://www.nationstates.net/pages/api.html#verification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-footnote text-tint-ink rounded-control-sm inline-flex items-center gap-1 font-medium hover:underline",
                    focusRing
                  )}
                >
                  NS API Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <ol className="text-footnote space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
                    1
                  </span>
                  <span>
                    Sign in to NationStates and visit your{" "}
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-tint-ink rounded-control-sm font-medium hover:underline",
                        focusRing
                      )}
                    >
                      nation-specific verify page
                    </a>
                    {!debouncedNation &&
                      " (enter your nation name above to get your personalised link)"}
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
                    2
                  </span>
                  <span>Copy the one-time verification token shown on that page.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-separator text-label text-footnote mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
                    3
                  </span>
                  <span>
                    Paste the token below. It grants <em>verification only</em>, with no access to
                    or control over your nation.
                  </span>
                </li>
              </ol>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={tokenInputId}>
                  Verification token <span className="text-destructive-ink">*</span>
                </Label>
                <Input
                  id={tokenInputId}
                  type="text"
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value)}
                  placeholder="Paste one-time token"
                  className="font-data"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={reasonSelectId}>
                  Basis for removal <span className="text-label-tertiary">(optional)</span>
                </Label>
                <Select
                  value={selectedReason || NO_REASON}
                  onValueChange={(v) => setSelectedReason(v === NO_REASON ? "" : v)}
                >
                  <SelectTrigger id={reasonSelectId} className="w-full">
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
                    <SelectItem value="custom">Other / Custom reason</SelectItem>
                  </SelectContent>
                </Select>
                {selectedReason === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor={customReasonId} className="sr-only">
                      Custom reason
                    </Label>
                    <Input
                      id={customReasonId}
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Describe your basis for removal"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {takedownMutation.error && (
              <Signal tone="destructive" title="Verification failed">
                {takedownMutation.error.message}
              </Signal>
            )}

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!nationName.trim() || !checksum.trim() || takedownMutation.isPending}
                onClick={handleVerifyAndTakedown}
              >
                {takedownMutation.isPending ? "Validating identity..." : "Submit removal request"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
