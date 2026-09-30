"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { SystemRestart } from "iconoir-react";

interface EditorLeaveGuardProps {
  /** Changes the server has not accepted yet: waiting to autosave, saving, or failed. */
  hasUnsavedChanges: boolean;
  /** Saves now; rejects when the save fails. */
  onSave: () => Promise<void>;
}

/** A same-site link the click would follow in this tab, or null. */
function linkToFollow(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Same page (hash links, section links): not leaving.
  if (url.pathname === window.location.pathname) return null;
  return url;
}

/**
 * Asks before the player leaves the editor with changes the server has not
 * accepted yet: the browser's own prompt for reloads and closing the tab, and
 * a dialog (Save and leave / Leave without saving / Stay) for links in the app.
 */
export function EditorLeaveGuard({ hasUnsavedChanges, onSave }: EditorLeaveGuardProps) {
  const [pendingUrl, setPendingUrl] = useState<URL | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isLeavingRef = useRef(false);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isLeavingRef.current) return;
      event.preventDefault();
    };
    // Capture phase on the document runs before the app's link handlers.
    const onClick = (event: MouseEvent) => {
      const url = linkToFollow(event);
      if (!url) return;
      event.preventDefault();
      event.stopPropagation();
      setSaveFailed(false);
      setPendingUrl(url);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [hasUnsavedChanges]);

  const leave = (url: URL) => {
    isLeavingRef.current = true;
    window.location.assign(url.href);
  };

  const handleSaveAndLeave = async () => {
    if (!pendingUrl) return;
    setIsSaving(true);
    setSaveFailed(false);
    try {
      await onSave();
      leave(pendingUrl);
    } catch {
      setSaveFailed(true);
      setIsSaving(false);
    }
  };

  return (
    <AlertDialog
      open={pendingUrl !== null}
      onOpenChange={(open) => {
        if (!open && !isSaving) setPendingUrl(null);
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Save your changes before leaving?
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {saveFailed
              ? "Your changes still couldn't be saved. Check your connection and try again, or leave without them."
              : "Your latest changes haven't reached the server yet. If you leave now, they'll be kept only on this device."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={isSaving}>Stay</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => pendingUrl && leave(pendingUrl)}
          >
            Leave without saving
          </Button>
          <Button type="button" disabled={isSaving} onClick={handleSaveAndLeave}>
            {isSaving && <SystemRestart aria-hidden="true" className="h-4 w-4 animate-spin" />}
            {isSaving ? "Saving…" : "Save and leave"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
