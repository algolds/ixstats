"use client";

import { useState } from "react";
import { WarningTriangle } from "iconoir-react";
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
  /** The trigger's label: "Report thread" in a thread's header. */
  label?: string;
  /** A square icon button for a narrow header; the label stays as its accessible name. */
  iconOnly?: boolean;
  /** Opened by the caller (a menu item), which then renders no trigger. */
  control?: { open: boolean; onOpenChange: (open: boolean) => void };
}

/**
 * A ghost "Report" button and its dialog (or just the dialog, when the caller controls it): the member says why,
 * and the category's moderators get a report.
 */
export function ReportDialog({
  targetType,
  targetId,
  label = "Report",
  iconOnly = false,
  control,
}: ReportDialogProps) {
  const notify = useNotify();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = control?.open ?? ownOpen;
  const setOpen = control?.onOpenChange ?? setOwnOpen;
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
      {control ? null : (
        <DialogTrigger asChild>
          {iconOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-label-secondary"
              aria-label={label}
            >
              <WarningTriangle aria-hidden />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-label-secondary">
              <WarningTriangle aria-hidden />
              {label}
            </Button>
          )}
        </DialogTrigger>
      )}
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
