"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Signal } from "~/components/ui/signal";
import { Textarea } from "~/components/ui/textarea";
import { useMarketActions } from "~/hooks/cards/useMarketActions";

/** `cards.reportInscription`'s bounds on the trimmed reason. */
const REASON_MIN = 3;
const REASON_MAX = 500;

interface ReportFormProps {
  ownershipId: string;
  cardId: string;
  onClose: () => void;
}

/**
 * The reason and its sending. It mounts only while the dialog is open, so each opening starts clean and a sheet of
 * signed listings holds no closed forms. The server's refusal (too many reports waiting, one already sent) shows here.
 */
function ReportForm({ ownershipId, cardId, onClose }: ReportFormProps) {
  const { report } = useMarketActions(cardId);
  const [reason, setReason] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const id = useId();
  const trimmed = reason.trim();
  const ready = [...trimmed].length >= REASON_MIN && !report.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    setFailure(null);
    report.mutate(
      { ownershipId, reason: trimmed },
      { onSuccess: onClose, onError: (error) => setFailure(error.message) }
    );
  };

  return (
    <form className="space-y-3" onSubmit={submit}>
      {failure && (
        <Signal tone="destructive" title="Report not sent">
          {failure}
        </Signal>
      )}
      <div className="space-y-1">
        <Label htmlFor={`${id}-reason`}>What is wrong with it?</Label>
        <Textarea
          id={`${id}-reason`}
          rows={3}
          maxLength={REASON_MAX}
          aria-describedby={`${id}-hint`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <p id={`${id}-hint`} className="text-footnote text-label-secondary">
          {`${REASON_MIN} to ${REASON_MAX} characters.`}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready}>
          Send report
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Report another player's inscription to staff, from their listing or the trade builder. */
export function ReportInscriptionButton({
  ownershipId,
  cardId,
}: {
  ownershipId: string;
  cardId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="link" className="h-auto px-0">
          Report inscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report this inscription</DialogTitle>
          <DialogDescription>
            Staff read every report and can remove the inscription.
          </DialogDescription>
        </DialogHeader>
        <ReportForm ownershipId={ownershipId} cardId={cardId} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
