"use client";
// Animating page transition wrapper for WikiOS routes.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PageHeader } from "~/components/shell/PageHeader";
import { cn } from "~/lib/utils/cn";

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
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  // The editors fill the viewport below everything above them. That distance (shell offset,
  // header, tabs row) varies with the page, so measure it where the body starts and publish it
  // for editors.css instead of subtracting a guessed pixel count.
  useLayoutEffect(() => {
    const main = contentRef.current;
    const body = bodyRef.current;
    if (!main || !body) return;
    const publish = () => {
      const top = Math.round(body.getBoundingClientRect().top + window.scrollY);
      main.style.setProperty("--wikios-chrome-height", `${top}px`);
    };
    publish();
    if (typeof ResizeObserver === "undefined") return;
    // The tabs row can wrap and the header can change height; either moves the body. Publishing
    // changes layout (the editors resize), so it waits for the next frame instead of running inside
    // the observer callback, which would raise "ResizeObserver loop completed" warnings.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(publish);
    });
    observer.observe(main);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

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

  // The article tools stay in reach on long articles: sticky under the Halo band on chrome, in the
  // raised layer so the page header's own z-sticky toolbar (compact title) always paints above it.
  const stickyTools =
    "facet-chrome rounded-card z-raised sticky top-(--shell-top-offset) mx-2 mb-4";

  return (
    <main ref={contentRef} className="wikios-content relative min-w-0 flex-1">
      {title ? (
        <>
          <PageHeader title={title.replace(/_/g, " ")} actions={actions} />
          {tabs && (
            <div data-slot="wiki-article-tools" className={cn(stickyTools, "px-2 py-1")}>
              {tabs}
            </div>
          )}
        </>
      ) : (
        <div
          data-slot={tabs ? "wiki-article-tools" : undefined}
          className={cn(
            "flex flex-wrap items-center gap-2",
            tabs ? cn(stickyTools, "mt-2 px-2 py-1") : "px-2 pt-2 pb-4"
          )}
        >
          {tabs}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div ref={bodyRef}>{children}</div>
    </main>
  );
}
