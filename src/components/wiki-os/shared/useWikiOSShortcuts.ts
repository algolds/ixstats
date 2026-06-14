// src/components/wiki-os/shared/useWikiOSShortcuts.ts
// Keyboard shortcuts for WikiOS.
// Listens for the "wikios:edit" custom event (dispatched by Dynamic Island on double-Tab)
// to navigate to editor mode.

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";
import { useAuth } from "@clerk/nextjs";

export function useWikiOSShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  // Listen for "wikios:edit" event from Dynamic Island double-Tab
  useEffect(() => {
    const handleEdit = () => {
      const match = pathname.match(/\/wiki\/([^/]+)/);
      if (match) {
        if (!isSignedIn) return; // only allow edit shortcut for signed-in users
        const slug = match[1]!;
        if (!pathname.includes("/edit")) {
          navigateWithBasePath(`/wiki/${slug}/edit`, router);
        }
      }
    };

    window.addEventListener("wikios:edit", handleEdit);
    return () => window.removeEventListener("wikios:edit", handleEdit);
  }, [router, pathname, isSignedIn]);
}
