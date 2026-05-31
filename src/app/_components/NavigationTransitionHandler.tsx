"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GlobalLoader } from "~/components/ui/loader";

function NavigationTransitionHandlerContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);

  // Reset loading state when the path or parameters change
  useEffect(() => {
    setIsPending(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      // Find the closest anchor tag
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip external links, target blanks, mailto, tel, etc.
      if (anchor.target === "_blank") return;
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin) return;
        } catch {
          return;
        }
      }

      // Ignore hash links and javascript actions
      if (href.startsWith("#") || href.includes("#")) return;
      if (href.startsWith("javascript:")) return;

      // Ignore if clicking to navigate to exact same page and search parameters
      try {
        const targetUrl = new URL(href, window.location.href);
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        ) {
          return;
        }
      } catch {}

      // Command/Control/Shift clicks should open in a new tab/window without showing the loader
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;

      // Trigger transition state instantly
      setIsPending(true);
    };

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  // Safety fallback timeout to prevent UI getting stuck
  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => {
      setIsPending(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isPending]);

  if (!isPending) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/10 dark:bg-black/35 backdrop-blur-[2px] transition-all duration-300">
      <GlobalLoader className="min-h-0 w-auto" />
    </div>
  );
}

export function NavigationTransitionHandler() {
  return (
    <Suspense fallback={null}>
      <NavigationTransitionHandlerContent />
    </Suspense>
  );
}
