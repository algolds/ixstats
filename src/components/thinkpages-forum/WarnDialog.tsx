"use client";

import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { MODERATION_POLICY } from "~/lib/thinkpages-forum/moderation-policy";
import { api } from "~/trpc/react";
import { FormError, ReasonField } from "./ReasonField";

const REASON_MAX = 1000;

/** "Points expire after 90 days. 5 active points mean a 7-day forum ban, 10 a 30-day ban." */
function policyLine(): string {
  const [first, ...rest] = [...MODERATION_POLICY.autoBanTiers].sort((a, b) => a.points - b.points);
  const tiers = first
    ? [
        `${first.points} active points mean a ${first.days}-day forum ban`,
        ...rest.map((t) => `${t.points} a ${t.days}-day ban`),
      ].join(", ")
    : null;
  const expiry = `Points expire after ${MODERATION_POLICY.warningTtlDays} days.`;
  return tiers ? `${expiry} ${tiers}.` : expiry;
}

interface WarnDialogProps {
  userId: string;
  /** The post or thread the warning is about. */
  target: { type: "thread" | "post"; id: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the warning is issued, e.g. to refresh a list that shows it. */
  onDone?: () => void;
}

/** Warn a member: points up to the viewer's cap (site admins more), a reason, and the automatic-ban policy. */
export function WarnDialog({ userId, target, open, onOpenChange, onDone }: WarnDialogProps) {
  const notify = useNotify();
  const pointsId = useId();
  const [points, setPoints] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: context } = api.thinkpagesForumMod.context.useQuery();
  const { mutateAsync: warn, isPending } = api.thinkpagesForumMod.warn.useMutation();
  const caps = MODERATION_POLICY.maxPointsPerWarning;
  const cap = context?.isSiteAdmin ? caps.siteAdmin : caps.moderator;
  const length = reason.trim().length;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setError(null);
  };

  const send = () => {
    setError(null);
    warn({ userId, points: Number(points), reason: reason.trim(), target })
      .then((outcome) => {
        // A warning only ever raises the automatic ban (issued or extended), never lifts it.
        notify.success(
          "Warning issued",
          outcome.autoBan ? "Their active points brought an automatic forum ban." : undefined
        );
        setReason("");
        setPoints("1");
        close(false);
        onDone?.();
      })
      .catch((e: Error) => setError(e.message || "Could not issue the warning."));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Warn this member</DialogTitle>
          <DialogDescription>{policyLine()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label id={pointsId}>Points</Label>
          <Select value={points} onValueChange={setPoints} disabled={isPending}>
            <SelectTrigger aria-labelledby={pointsId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: cap }, (_, i) => String(i + 1)).map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "1" ? "1 point" : `${value} points`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ReasonField
          label="Reason"
          value={reason}
          onChange={setReason}
          max={REASON_MAX}
          disabled={isPending}
        />
        <FormError message={error} />
        <DialogFooter>
          <Button onClick={send} disabled={isPending || length === 0}>
            Warn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
