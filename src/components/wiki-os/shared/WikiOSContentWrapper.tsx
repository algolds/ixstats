"use client";
// Animating page transition wrapper for WikiOS routes.

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageHeader } from "~/components/shell/PageHeader";

interface WikiOSContentWrapperProps {
  title?: string;
  /** Trailing toolbar actions: in the page header when there is a title, otherwise on their own row. */
  actions?: ReactNode;
  /** The article's views (Read, Edit, History, Talk), under the header. */
  tabs?: ReactNode;
  children: ReactNode;
}

export function WikiOSContentWrapper({
  title,
  actions,
  tabs,
  children,
}: WikiOSContentWrapperProps) {
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
      {title ? (
        <>
          <PageHeader title={title.replace(/_/g, " ")} actions={actions} />
          {tabs && <div className="px-2 pb-4">{tabs}</div>}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-4">
          {tabs}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </main>
  );
}
