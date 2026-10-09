"use client";

import { useState } from "react";
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
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { FormError, ReasonField } from "./ReasonField";

const REASON_MIN = 3;
const REASON_MAX = 1000;

interface ReportDialogProps {
  targetType: "thread" | "post";
  targetId: string;
  /** The trigger's label: "Report" on a post, "Report thread" under a thread's header. */
  label?: string;
}

/** A ghost "Report" button and its dialog: the member says why, and the category's moderators get a report. */
export function ReportDialog({ targetType, targetId, label = "Report" }: ReportDialogProps) {
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: report, isPending } = api.thinkpagesForum.report.useMutation();
  const length = reason.trim().length;

  const send = () => {
    setError(null);
    report({ targetType, targetId, reason: reason.trim() })
      .then(() => {
        notify.success("Report sent");
        setOpen(false);
        setReason("");
      })
      .catch((e: Error) => setError(e.message || "Could not send the report."));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`Report this ${targetType}`}</DialogTitle>
          <DialogDescription>
            The moderators see your reason. The member you report does not see who reported them.
          </DialogDescription>
        </DialogHeader>
        <ReasonField
          label="Reason"
          value={reason}
          onChange={setReason}
          max={REASON_MAX}
          disabled={isPending}
        />
        <FormError message={error} />
        <DialogFooter>
          <Button onClick={send} disabled={isPending || length < REASON_MIN}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
