"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { stripBasePath } from "~/lib/base-path";
import { useEditor } from "./editor-context";

type PendingLeave = { kind: "link"; href: string } | { kind: "back" };

const GUARD_STATE = "__editorLeaveGuard";

/**
 * One unsaved-changes dialog for every way out of the editor while a section has unsaved
 * changes: a link anywhere in the app shell (sidebar, tab bar, the editor's own rows), the
 * browser's Back, and closing or reloading the tab (the browser's own prompt). Links within the
 * page (the section nav) never ask.
 */
export function LeaveGuard() {
  const { dirty } = useEditor();
  const router = useRouter();
  const [pending, setPending] = useState<PendingLeave | null>(null);
  const isDirty = dirty.length > 0;
  const dirtyRef = useRef(isDirty);
  const leavingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  // Closing or reloading the tab: the browser shows its own prompt.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  // Links: caught before Next's Link handler runs, so the navigation never starts.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || leavingRef.current) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      const here = window.location;
      if (
        url.origin === here.origin &&
        url.pathname === here.pathname &&
        url.search === here.search
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPending({ kind: "link", href: url.href });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Back: a guard entry sits on top of the editor's own while it is dirty. Back pops the guard
  // (the page stays the editor), and the guard goes back on while the dialog asks.
  useEffect(() => {
    if (!isDirty) return;
    const pushGuard = () =>
      window.history.pushState({ [GUARD_STATE]: true }, "", window.location.href);
    if (!(window.history.state as Record<string, unknown> | null)?.[GUARD_STATE]) pushGuard();
    const onPopState = (event: PopStateEvent) => {
      if (leavingRef.current) return;
      if ((event.state as Record<string, unknown> | null)?.[GUARD_STATE]) return;
      pushGuard();
      setPending({ kind: "back" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isDirty]);

  const leave = () => {
    if (!pending) return;
    leavingRef.current = true;
    setPending(null);
    if (pending.kind === "back") {
      // Past the guard and the editor's own entry, to where Back was going.
      window.history.go(-2);
      return;
    }
    const url = new URL(pending.href);
    if (url.origin === window.location.origin) {
      router.push(`${stripBasePath(url.pathname)}${url.search}${url.hash}`);
    } else {
      window.location.assign(url.href);
    }
  };

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            {dirty.length === 1
              ? "This section has changes you have not saved:"
              : "These sections have changes you have not saved:"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="text-body text-label list-disc pl-5" aria-label="Unsaved sections">
          {dirty.map((section) => (
            <li key={section.id}>{section.label}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={leave}>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
