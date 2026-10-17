"use client";
/** File a takedown request that arrived by email or report: the card, who asked, why, and when it arrived. */
import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { TAKEDOWN_DEADLINE_DAYS } from "~/lib/cards/takedown-deadline";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { ValueSelect } from "~/components/ui/value-select";
import { CARD_TYPE_LABELS, labelOf } from "../shared/card-labels";

type Origin = "AUTHOR_REQUEST" | "ADMIN" | "LICENCE_REVIEW";
const ORIGINS: ReadonlyArray<readonly [Origin, string]> = [
  ["AUTHOR_REQUEST", "The author asked"],
  ["ADMIN", "An admin decided"],
  ["LICENCE_REVIEW", "A licence problem"],
];

const pad = (value: number) => String(value).padStart(2, "0");

/** Today in the admin's own time zone, as a date field holds it. */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function FileTakedownDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [card, setCard] = useState<{ id: string; title: string } | null>(null);
  const [origin, setOrigin] = useState<Origin>("AUTHOR_REQUEST");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [received, setReceived] = useState(today);
  const [hideNow, setHideNow] = useState(false);
  const searching = card === null && query.trim().length >= 2;
  // Every card, whatever its review state: a takedown can name any card
  const matches = api.cards.admin.overview.findCards.useQuery(
    { query: query.trim() },
    { enabled: searching }
  );

  const reset = () => {
    setQuery("");
    setCard(null);
    setOrigin("AUTHOR_REQUEST");
    setReason("");
    setContact("");
    setReceived(today());
    setHideNow(false);
  };
  const file = api.cards.admin.compliance.file.useMutation({
    onSuccess: () => {
      notify.success("Takedown filed", `It is due in ${TAKEDOWN_DEADLINE_DAYS} days.`);
      void utils.cards.admin.compliance.takedowns.invalidate();
      void utils.cards.admin.overview.summary.invalidate();
      reset();
      onOpenChange(false);
    },
    onError: (error) => notify.error("Takedown not filed", error.message),
  });
  const submit = () =>
    card &&
    file.mutate({
      cardId: card.id,
      origin,
      reason: reason.trim(),
      contact: contact.trim() || undefined,
      // Midnight in the admin's time zone; an empty field means now
      receivedAt: received ? new Date(`${received}T00:00:00`) : undefined,
      hideNow,
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>File a takedown</DialogTitle>
          <DialogDescription>
            A request is due {TAKEDOWN_DEADLINE_DAYS} days after it arrived.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="takedown-card">Card</Label>
            {card ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-callout">{card.title}</span>
                <Button size="xs" variant="ghost" onClick={() => setCard(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="takedown-card"
                  placeholder="Search card titles"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {searching && matches.data?.length === 0 && (
                  <p className="text-footnote text-label-secondary">No card has that title.</p>
                )}
                <ul className="space-y-1">
                  {(matches.data ?? []).map((match) => (
                    <li key={match.id}>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setCard({ id: match.id, title: match.title })}
                      >
                        {match.title}
                        <span className="text-label-secondary">
                          · {labelOf(CARD_TYPE_LABELS, match.cardType)}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="takedown-origin">Who asked</Label>
            <ValueSelect
              id="takedown-origin"
              value={origin}
              onValueChange={setOrigin}
              options={ORIGINS}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="takedown-reason">Reason</Label>
            <Textarea
              id="takedown-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="takedown-contact">Contact</Label>
              <Input
                id="takedown-contact"
                maxLength={200}
                value={contact}
                onChange={(event) => setContact(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="takedown-received">Received</Label>
              <Input
                id="takedown-received"
                type="date"
                max={today()}
                value={received}
                onChange={(event) => setReceived(event.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="takedown-hide" checked={hideNow} onCheckedChange={setHideNow} />
            <Label htmlFor="takedown-hide">Hide the art now</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!card || reason.trim().length < 3 || file.isPending} onClick={submit}>
            File takedown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
