"use client";

import { useState, type FormEvent } from "react";
import { api } from "~/trpc/react";
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

interface HandlePickerDialogProps {
  open: boolean;
  /** The handle is saved: the save that asked for it goes on. */
  onDone: () => void;
  onCancel: () => void;
}

/**
 * Asks a player with no passport handle for one before their first WikiOS save (design decision 9), prefilled from
 * their name (`ixnayid.suggestHandle`). The server's refusal, such as a taken handle, shows under the field.
 */
export function HandlePickerDialog({ open, onDone, onCancel }: HandlePickerDialogProps) {
  const utils = api.useUtils();
  const suggestion = api.ixnayid.suggestHandle.useQuery(undefined, { enabled: open });
  /** What the player typed; null until they type, so the suggestion shows once it arrives. */
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const value = draft ?? suggestion.data?.handle ?? "";

  const setHandle = api.ixnayid.setHandle.useMutation({
    onSuccess: async () => {
      // The gate reads the status: it must see the handle before the save goes on.
      await utils.ixnayid.getStatus.invalidate();
      onDone();
    },
    onError: (error) => setRefusal(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    setRefusal(null);
    setHandle.mutate({ handle: value });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pick your passport handle</DialogTitle>
          <DialogDescription>
            WikiOS signs your edits with it. You can change it once later in Settings.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1">
            <Input
              aria-label="Passport handle"
              aria-describedby="handle-picker-rule"
              aria-invalid={refusal !== null}
              autoComplete="off"
              maxLength={25}
              value={value}
              disabled={setHandle.isPending}
              onChange={(event) => {
                setDraft(event.target.value);
                setRefusal(null);
              }}
            />
            <p id="handle-picker-rule" className="text-footnote text-label-secondary">
              3 to 24 lowercase letters, numbers or underscores.
            </p>
            {refusal && (
              <p role="alert" className="text-footnote text-destructive-ink">
                {refusal}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={setHandle.isPending}>
              {setHandle.isPending ? "Saving..." : "Save and continue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
