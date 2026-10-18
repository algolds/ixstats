"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "~/trpc/react";
import { TAKEDOWN_DEADLINE_DAYS } from "~/lib/cards/takedown-deadline";
import { vaultNotify } from "~/lib/vault/vault-notifications";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

const REASON_MIN = 10;
const REASON_MAX = 1000;
const CONTACT_MAX = 200;

const ANSWERS = {
  filed: `Request sent. Staff answer takedowns within ${TAKEDOWN_DEADLINE_DAYS} days.`,
  already: "Staff already have a request for this card.",
} as const;

interface RequestTakedownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardTitle: string;
  /** The button that opens it, so focus goes back there when it closes. */
  children: ReactNode;
}

/**
 * A signed-in player's takedown request for a card that is not from NationStates: why it should come down, and how
 * staff can reach them. It lands in the admin's Compliance queue; who asked is kept for staff only.
 */
export function RequestTakedownDialog({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  children,
}: RequestTakedownDialogProps) {
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const send = api.cards.requestTakedown.useMutation({
    onSuccess: ({ status }) => {
      vaultNotify.success(ANSWERS[status], cardTitle);
      setReason("");
      setContact("");
      onOpenChange(false);
    },
    onError: (error) => vaultNotify.error(error.message),
  });
  const ready = reason.trim().length >= REASON_MIN && !send.isPending;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    send.mutate({ cardId, reason: reason.trim(), contact: contact.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a takedown</DialogTitle>
          <DialogDescription>
            {`Tell staff why ${cardTitle} should come down. They answer within ${TAKEDOWN_DEADLINE_DAYS} days.`}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="takedown-request-reason">Why should this card come down?</Label>
            <Textarea
              id="takedown-request-reason"
              rows={4}
              maxLength={REASON_MAX}
              aria-describedby="takedown-request-reason-hint"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p id="takedown-request-reason-hint" className="text-footnote text-label-secondary">
              {`${REASON_MIN} to ${REASON_MAX.toLocaleString("en-US")} characters.`}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="takedown-request-contact">How can staff reach you?</Label>
            <Input
              id="takedown-request-contact"
              maxLength={CONTACT_MAX}
              aria-describedby="takedown-request-contact-hint"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
            <p id="takedown-request-contact-hint" className="text-footnote text-label-secondary">
              Optional, for example an email address.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
