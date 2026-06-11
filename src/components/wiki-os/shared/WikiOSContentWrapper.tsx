// src/components/wiki-os/shared/WikiOSContentWrapper.tsx
// Animating page transition wrapper for WikiOS routes.

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface WikiOSContentWrapperProps {
  title?: string;
  children: ReactNode;
}

export function WikiOSContentWrapper({ title, children }: WikiOSContentWrapperProps) {
  const contentRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      prevPathRef.current = pathname;
      const el = contentRef.current;
      if (el) {
        el.classList.remove("wikios-page-enter");
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add("wikios-page-enter");
      }
    }
  }, [pathname]);

  return (
    <main ref={contentRef} className="wikios-content relative min-w-0 flex-1">
      {title && <h1 className="wikios-article-title">{title.replace(/_/g, " ")}</h1>}
      {children}
    </main>
  );
}
