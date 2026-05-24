// src/components/wikios/shared/useWikiOSShortcuts.ts
// Keyboard shortcuts for WikiOS.
// Listens for the "wikios:edit" custom event (dispatched by Dynamic Island on double-Tab)
// to navigate to editor mode.

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { withBasePath, navigateWithBasePath } from "~/lib/base-path";

export function useWikiOSShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  // Listen for "wikios:edit" event from Dynamic Island double-Tab
  useEffect(() => {
    const handleEdit = () => {
      const match = pathname.match(/\/w\/([^/]+)/);
      if (match) {
        const slug = match[1];
        if (!pathname.includes("/edit")) {
          navigateWithBasePath(`/w/${slug}/edit`, router);
        }
      }
    };

    window.addEventListener("wikios:edit", handleEdit);
    return () => window.removeEventListener("wikios:edit", handleEdit);
  }, [router, pathname]);
}
