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
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { FormError, ReasonField } from "./ReasonField";

const BODY_MIN = 10;
const BODY_MAX = 4000;

interface AppealDialogProps {
  subjectType: "warning" | "ban";
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Appeal one of the member's own warnings or bans, once; a moderator other than the issuer decides. */
export function AppealDialog({ subjectType, subjectId, open, onOpenChange }: AppealDialogProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: appeal, isPending } = api.thinkpagesForum.appeal.useMutation();
  const length = body.trim().length;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setError(null);
  };

  const send = () => {
    setError(null);
    appeal({ subjectType, subjectId, body: body.trim() })
      .then(() => {
        notify.success("Appeal sent", "A moderator who did not issue it will decide.");
        setBody("");
        close(false);
        return utils.thinkpagesForum.myStanding.invalidate();
      })
      .catch((e: Error) => setError(e.message || "Could not send the appeal."));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{`Appeal this ${subjectType}`}</DialogTitle>
          <DialogDescription>
            You can appeal each warning or ban once. Say why it should be lifted.
          </DialogDescription>
        </DialogHeader>
        <ReasonField
          label="Your appeal"
          value={body}
          onChange={setBody}
          max={BODY_MAX}
          disabled={isPending}
        />
        <FormError message={error} />
        <DialogFooter>
          <Button onClick={send} disabled={isPending || length < BODY_MIN || length > BODY_MAX}>
            Send appeal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
