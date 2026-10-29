"use client";

import { useState } from "react";
import { Trash, SystemRestart as Loader2 } from "iconoir-react";
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
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { ACCOUNT_DELETION_GRACE_DAYS, confirmationMatches } from "~/lib/account/deletion";
import { confirmationName, deletionNotice } from "~/lib/account/deletion-copy";
import { SettingsRow } from "../primitives";

const CONFIRM_INPUT_ID = "delete-account-confirm";

/**
 * Delete account (Privacy 5.2): a request after typing the handle (`users.requestAccountDeletion`),
 * erased by the account-erasure cron once the grace period ends. While one is pending the row says
 * when, and "Keep my account" withdraws it.
 */
export function DeleteAccountRow({ glyphClass }: { glyphClass: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const { data: deletion } = api.users.getAccountDeletion.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const refresh = () => void utils.users.getAccountDeletion.invalidate();

  const cancel = api.users.cancelAccountDeletion.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Your account will not be deleted");
      refresh();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Could not cancel the deletion. Try again.");
    },
  });

  if (deletion?.requestedAt && deletion.erasesAt) {
    return (
      <SettingsRow
        label="Delete account"
        description={deletionNotice(deletion.erasesAt)}
        icon={Trash}
        glyphClass={glyphClass}
      >
        <Button
          type="button"
          onClick={() => {
            soundEffects.press();
            cancel.mutate();
          }}
          disabled={cancel.isPending}
          variant="default"
          size="sm"
        >
          {cancel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Keep my account</span>
        </Button>
      </SettingsRow>
    );
  }

  return (
    <>
      <SettingsRow
        label="Delete account"
        description={`Erase your account and personal information after ${ACCOUNT_DELETION_GRACE_DAYS} days`}
        icon={Trash}
        glyphClass={glyphClass}
      >
        <Button
          type="button"
          onClick={() => {
            soundEffects.press();
            setOpen(true);
          }}
          variant="secondary"
          size="sm"
        >
          <span>Delete account</span>
        </Button>
      </SettingsRow>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} onRequested={refresh} />
    </>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested: () => void;
}) {
  const notify = useNotify();
  const { user } = useUser();
  const [typed, setTyped] = useState("");
  const { data: profile } = api.users.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const names = {
    handle: profile?.handle ?? null,
    username: user?.username ?? null,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
  const expected = confirmationName(names);
  const confirmed = confirmationMatches(typed, names);

  const close = (next: boolean) => {
    if (!next) setTyped("");
    onOpenChange(next);
  };

  const request = api.users.requestAccountDeletion.useMutation({
    onSuccess: () => {
      notify.success(
        `Deletion requested. You can cancel it here for ${ACCOUNT_DELETION_GRACE_DAYS} days.`
      );
      close(false);
      onRequested();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Could not request the deletion. Try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-label">Delete your account?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Your login, email address, linked accounts and private messages are erased, and your
            nations are released. Your public posts and personas stay, credited to “a former
            member”.
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This happens {ACCOUNT_DELETION_GRACE_DAYS} days after you ask, and you can cancel until
          then. Download your data first if you want a copy.
        </p>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmed) request.mutate({ confirmHandle: typed.trim() });
          }}
        >
          <Label htmlFor={CONFIRM_INPUT_ID}>
            {expected ? `Type ${expected} to confirm` : "Type your handle to confirm"}
          </Label>
          <Input
            id={CONFIRM_INPUT_ID}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || request.isPending}>
              {request.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              <span>Delete account</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
