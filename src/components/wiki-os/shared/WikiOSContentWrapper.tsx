"use client";
// Animating page transition wrapper for WikiOS routes.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
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
 * Whether the sticky `row` has stuck under its `top`: a zero-height sentinel just before it has
 * scrolled above the covered band. The row looks the same at rest; chrome is for when it floats.
 */
function useStuck(row: RefObject<HTMLElement | null>, sentinel: RefObject<HTMLElement | null>) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const target = sentinel.current;
    const el = row.current;
    if (!target || !el || typeof IntersectionObserver === "undefined") return;
    const top = Math.round(parseFloat(getComputedStyle(el).top) || 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const rootTop = entry.rootBounds?.top ?? top;
        setStuck(!entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop + 1);
      },
      { rootMargin: `-${top}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [row, sentinel]);
  return stuck;
}

/**
 * The article tools row (views, and page tools when there is no page header). Sticky under the
 * Halo band, in the raised layer so the page header's z-sticky toolbar always paints above it. The
 * surface carries the row's 8px side inset and cancels it with a negative margin, so the content
 * lines up at rest and the chrome pill that appears when stuck frames it without any layout shift.
 */
function ArticleToolsRow({
  children,
  className,
  rowClassName,
}: {
  children: ReactNode;
  className?: string;
  /** On the sticky row itself (spacing must live here: a wrapper would be its containing block). */
  rowClassName?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stuck = useStuck(rowRef, sentinelRef);
  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-0" />
      <div
        ref={rowRef}
        data-slot="wiki-article-tools"
        data-stuck={stuck ? "" : undefined}
        className={cn("z-raised sticky top-(--shell-top-offset) px-2 pb-4", rowClassName)}
      >
        <div
          data-slot="wiki-article-tools-surface"
          className={cn("rounded-card -mx-2 -my-1 px-2 py-1", stuck && "facet-chrome", className)}
        >
          {children}
        </div>
      </div>
    </>
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
        <ArticleToolsRow rowClassName="pt-2" className="flex flex-wrap items-center gap-2">
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
