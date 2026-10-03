"use client";
// Keyboard shortcuts for WikiOS.
// Listens for the "wikios:edit" custom event (dispatched by Dynamic Island on double-Tab)
// to navigate to editor mode.

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { navigateWithBasePath } from "~/lib/base-path";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";

/** `readOnly`: the page is another wiki's, which WikiOS never edits. */
export function useWikiOSShortcuts(readOnly?: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useWikiAuth();

  // Listen for "wikios:edit" event from Dynamic Island double-Tab
  useEffect(() => {
    const handleEdit = () => {
      const match = pathname.match(/\/wiki\/([^/]+)/);
      if (match) {
        if (!isSignedIn || readOnly) return; // signed-in users, IxWiki pages only
        const slug = match[1]!;
        if (!pathname.includes("/edit")) {
          navigateWithBasePath(`/wiki/${slug}/edit`, router);
        }
      }
    };

    window.addEventListener("wikios:edit", handleEdit);
    return () => window.removeEventListener("wikios:edit", handleEdit);
  }, [router, pathname, isSignedIn, readOnly]);
}
