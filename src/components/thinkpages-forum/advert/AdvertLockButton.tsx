"use client";

import { Lock } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

interface AdvertLockButtonProps {
  threadId: string;
  /** A square icon button for a narrow header; the name stays for assistive technology. */
  iconOnly?: boolean;
}

/**
 * Locks the realm's advert. The thread read decides who is offered it (`canLock`) and the server decides again; a refusal is reported and the page stays as it was. There is no moderation log: it is the
 * realm's own thread.
 */
export function AdvertLockButton({ threadId, iconOnly = false }: AdvertLockButtonProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { mutateAsync, isPending } = api.thinkpagesForum.setAdvertLocked.useMutation();
  const label = "Lock advert";
  const lock = () =>
    mutateAsync({ threadId, locked: true }).then(
      () => {
        void utils.thinkpagesForum.thread.invalidate({ threadId });
        void utils.thinkpagesForum.category.invalidate();
      },
      (error: Error) => notify.error("Could not lock the advert", error.message)
    );
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      className="text-label-secondary pointer-coarse:min-h-11"
      aria-label={label}
      disabled={isPending}
      onClick={() => void lock()}
    >
      <Lock aria-hidden />
      {iconOnly ? null : label}
    </Button>
  );
}
