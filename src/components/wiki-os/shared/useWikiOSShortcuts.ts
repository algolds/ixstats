"use client";
// src/components/wiki-os/shared/useWikiOSShortcuts.ts
// Keyboard shortcuts for WikiOS.
// Listens for the "wikios:edit" custom event (dispatched by Dynamic Island on double-Tab)
// to navigate to editor mode.

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { navigateWithBasePath, stripBasePath } from "~/lib/base-path";
import { canonicalizeTitle, decodeTitleParam } from "~/lib/wiki-os/core/title";
import { articleHref } from "~/lib/wiki-os/wiki-path";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";

/** `readOnly`: the page is another wiki's, which WikiOS never edits. */
export function useWikiOSShortcuts(readOnly?: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useWikiAuth();

  // Listen for "wikios:edit" event from Dynamic Island double-Tab
  useEffect(() => {
    const handleEdit = () => {
      const path = stripBasePath(pathname).match(/^\/wiki\/(.+)$/)?.[1];
      if (!path) return;
      if (!isSignedIn || readOnly) return; // signed-in users, IxWiki pages only
      const canon = canonicalizeTitle(path.split("/").map(decodeTitleParam).join("/"));
      const editing = new URLSearchParams(window.location.search).get("action") === "edit";
      if (canon && !editing) navigateWithBasePath(articleHref(canon, { action: "edit" }), router);
    };

    window.addEventListener("wikios:edit", handleEdit);
    return () => window.removeEventListener("wikios:edit", handleEdit);
  }, [router, pathname, isSignedIn, readOnly]);
}
