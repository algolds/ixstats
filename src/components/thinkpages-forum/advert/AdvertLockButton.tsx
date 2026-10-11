"use client";

import { Lock, LockSlash } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

interface AdvertLockButtonProps {
  threadId: string;
  /** The advert is locked now. */
  locked: boolean;
  /** A square icon button for a narrow header; the name stays for assistive technology. */
  iconOnly?: boolean;
}

/**
 * Locks or unlocks the realm's advert. The thread read decides who is offered it (`canLock`, `canUnlock`) and the
 * server decides again; a refusal is reported and the page stays as it was. There is no moderation log: it is the
 * realm's own thread.
 */
export function AdvertLockButton({ threadId, locked, iconOnly = false }: AdvertLockButtonProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { mutateAsync, isPending } = api.thinkpagesForum.setAdvertLocked.useMutation();
  const label = locked ? "Unlock advert" : "Lock advert";
  const Icon = locked ? LockSlash : Lock;
  const toggle = () =>
    mutateAsync({ threadId, locked: !locked }).then(
      () => {
        void utils.thinkpagesForum.thread.invalidate({ threadId });
        void utils.thinkpagesForum.category.invalidate();
      },
      (error: Error) =>
        notify.error(`Could not ${locked ? "unlock" : "lock"} the advert`, error.message)
    );
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      className="text-label-secondary pointer-coarse:min-h-11"
      aria-label={label}
      disabled={isPending}
      onClick={() => void toggle()}
    >
      <Icon aria-hidden />
      {iconOnly ? null : label}
    </Button>
  );
}
