"use client";

import { useState } from "react";
import { ClockRotateRight, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { SettingsRow } from "../primitives";

/** Session-storage keys of the recently viewed lists this browser keeps (WikiOS, forum). */
const RECENT_STORAGE_KEYS = ["wikios:recentArticles", "forum:recentThreads"];

function forgetRecentlyViewed() {
  for (const key of RECENT_STORAGE_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage unavailable: nothing kept.
    }
  }
}

/**
 * Clear history (SL-4): after confirmation, deletes your personal notifications, message read
 * receipts and online-status heartbeat on the server (`users.clearHistory`, 3 an hour), and the
 * recently viewed wiki articles and forum threads kept in this browser.
 */
export function ClearHistoryRow({ glyphClass }: { glyphClass: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);

  const clearHistory = api.users.clearHistory.useMutation({
    onSuccess: (result) => {
      forgetRecentlyViewed();
      soundEffects.bloom();
      notify.success(
        `History cleared: ${result.notifications} notifications and ${result.readReceipts} read receipts`
      );
      void utils.notifications.getUserNotifications.invalidate();
      void utils.notifications.getUnreadCount.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to clear history");
    },
  });

  return (
    <>
      <SettingsRow
        label="Clear history"
        description="Delete your personal notifications, read receipts, last-seen time and recently viewed pages"
        icon={ClockRotateRight}
        glyphClass={glyphClass}
      >
        <Button
          type="button"
          onClick={() => {
            soundEffects.press();
            setOpen(true);
          }}
          disabled={clearHistory.isPending}
          data-cuelume-press="soft"
          variant="secondary"
          size="sm"
        >
          {clearHistory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>Clear history</span>
        </Button>
      </SettingsRow>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-label">Clear your history?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              This deletes your personal notifications, your message read receipts and your
              last-seen time, and forgets the wiki articles and forum threads you viewed in this
              browser. Messages, posts, country-wide notices and your settings stay. It cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
            <AlertDialogCancel onClick={() => soundEffects.press()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => clearHistory.mutate({ confirm: true })}
            >
              Clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
