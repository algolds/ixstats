"use client";

/**
 * EditorConfirmDialog — promise-based confirmation for destructive editor actions.
 *
 * Replaces `window.confirm()` in the map editor with the Facet AlertDialog so
 * confirmations are themed, keyboard-accessible and callable from hooks:
 *
 * ```ts
 * if (!(await confirmEditorAction({ title: "Delete 3 features?", destructive: true }))) return;
 * ```
 *
 * `<EditorConfirmHost />` is mounted once by `MapEditorOverlay`. When no host is
 * mounted (e.g. a unit test), the request resolves `true` so callers never hang.
 */

import { useEffect, useSyncExternalStore } from "react";
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
import { buttonVariants } from "~/components/ui/button";

interface EditorConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends EditorConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: PendingConfirm | null = null;
let hostCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settle(ok: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

/** Asks the user to confirm; resolves `true` on confirm, `false` on cancel/dismiss. */
export function confirmEditorAction(options: EditorConfirmOptions): Promise<boolean> {
  if (hostCount === 0) return Promise.resolve(true);
  // A newer request supersedes an unanswered one (treated as cancelled).
  if (pending) settle(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

/** True while a confirmation is open — keyboard handlers use it to stand down. */
export function isEditorConfirmOpen(): boolean {
  return pending !== null;
}

const getSnapshot = () => pending;
const getServerSnapshot = () => null;

export function EditorConfirmHost() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hostCount++;
    return () => {
      hostCount--;
      if (hostCount === 0 && pending) settle(false);
    };
  }, []);

  return (
    <AlertDialog
      open={current !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      {current && (
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-body">{current.title}</AlertDialogTitle>
            {current.description && (
              <AlertDialogDescription className="text-footnote leading-relaxed">
                {current.description}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {current.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              className={
                current.destructive ? buttonVariants({ variant: "destructive" }) : undefined
              }
              onClick={() => settle(true)}
            >
              {current.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
