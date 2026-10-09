"use client";

import { useState } from "react";
import { Bookmark, BookmarkSolid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

/** Saves the thread to the signed-in member's stash, or takes it out again (a toggle; the state comes from the server). */
export function StashThreadButton({ threadId }: { threadId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const { data } = api.thinkpagesForum.isThreadStashed.useQuery({ threadId });
  const { mutateAsync: stash } = api.thinkpagesForum.stashThread.useMutation();
  const { mutateAsync: unstash } = api.thinkpagesForum.unstashThread.useMutation();
  const stashed = data?.stashed ?? false;

  const toggle = async () => {
    setBusy(true);
    try {
      await (stashed ? unstash({ threadId }) : stash({ threadId }));
      await utils.thinkpagesForum.isThreadStashed.invalidate({ threadId });
      notify.success(stashed ? "Removed from your stash" : "Saved to your stash");
    } catch (e) {
      notify.error("Could not update your stash", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={stashed}
      disabled={busy || data === undefined}
      onClick={() => void toggle()}
    >
      {stashed ? <BookmarkSolid aria-hidden /> : <Bookmark aria-hidden />}
      Stash thread
    </Button>
  );
}
