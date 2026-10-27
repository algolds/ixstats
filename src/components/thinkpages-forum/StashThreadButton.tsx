"use client";

import { useState } from "react";
import { Bookmark, BookmarkSolid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

/** Saves the thread to the signed-in member's stash, or takes it out again (a toggle; the state comes from the server). */
export function StashThreadButton({
  threadId,
  iconOnly = false,
}: {
  threadId: string;
  /** A square icon button for a narrow header; the name stays for assistive technology. */
  iconOnly?: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = api.thinkpagesForum.isThreadStashed.useQuery({ threadId });
  const { mutateAsync: stash } = api.thinkpagesForum.stashThread.useMutation();
  const { mutateAsync: unstash } = api.thinkpagesForum.unstashThread.useMutation();
  const stashed = data?.stashed ?? false;

  const toggle = async () => {
    setBusy(true);
    try {
      await (stashed ? unstash({ threadId }) : stash({ threadId }));
      notify.success(stashed ? "Removed from your stash" : "Saved to your stash");
    } catch (e) {
      notify.error("Could not update your stash", e instanceof Error ? e.message : undefined);
      return;
    } finally {
      setBusy(false);
    }
    // The change is saved; a failed refresh of the button's state is not an error to report.
    await utils.thinkpagesForum.isThreadStashed.invalidate({ threadId }).catch(() => undefined);
  };

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      className="text-label-secondary"
      aria-label={iconOnly ? "Stash thread" : undefined}
      aria-pressed={stashed}
      disabled={busy || isLoading}
      onClick={() => void toggle()}
    >
      {stashed ? <BookmarkSolid aria-hidden /> : <Bookmark aria-hidden />}
      {iconOnly ? null : "Stash thread"}
    </Button>
  );
}
