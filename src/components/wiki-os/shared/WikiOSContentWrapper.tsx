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

/**
 * The article tools row (views, and page tools when there is no page header). It scrolls with the
 * page: pinned under the Halo band it floated over the article text with content showing above it.
 */
function ArticleToolsRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="wiki-article-tools" className={cn("px-2 pb-4", className)}>
      {children}
    </div>
  );
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

  return (
    <main ref={contentRef} className="wikios-content relative min-w-0 flex-1">
      {title ? (
        <>
          <PageHeader title={title.replace(/_/g, " ")} actions={actions} />
          {tabs && <ArticleToolsRow>{tabs}</ArticleToolsRow>}
        </>
      ) : tabs ? (
        <ArticleToolsRow className="flex flex-wrap items-center gap-2 pt-2">
          {tabs}
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </ArticleToolsRow>
      ) : (
        <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-4">
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div ref={bodyRef}>{children}</div>
    </main>
  );
}
