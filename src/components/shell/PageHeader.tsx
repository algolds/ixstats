"use client";

/**
 * PageHeader: the page's large title (`text-large-title`, the one `<h1>`), which collapses into a
 * compact toolbar title on scroll.
 *
 * The toolbar is sticky at `--shell-header-top` and turns into a `facet-chrome` bar with the compact title once the large title has
 * scrolled under it. It holds the optional back button and trailing actions, and keeps the middle
 * `--shell-halo-reserve` clear so Halo can float over it. Without a back button or actions the
 * toolbar takes no space until it collapses. Only opacity animates (`duration-fast`); Reduce Motion
 * makes it instant.
 *
 * ```tsx
 * <PageHeader
 *   title="Help center"
 *   back={{ href: "/dashboard", label: "Home" }}
 *   actions={<Button size="sm">Contact</Button>}
 * />
 * ```
 */

import * as React from "react";
import Link from "next/link";
import { NavArrowLeft } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { Button } from "~/components/ui/button";

export interface PageHeaderProps {
  /** The page title (rendered as the page's `<h1>`). */
  title: string;
  /** Supporting line under the large title. */
  subtitle?: React.ReactNode;
  /** Back button in the toolbar. */
  back?: { href: string; label?: string };
  /** Thumbnail or avatar before the large title, centred with it (not in the collapsed title). */
  leading?: React.ReactNode;
  /** Trailing toolbar actions (buttons, a dropdown menu). */
  actions?: React.ReactNode;
  /**
   * Decorative art behind the expanded header (a cover image with its own scrim). It is clipped to
   * the header's rounded box, fades out once the header collapses, and never reaches the compact
   * toolbar. The slot owns no readability: the art must bring its own scrim.
   */
  backdrop?: React.ReactNode;
  className?: string;
}

const fade = "transition-opacity duration-fast ease-out-facet motion-reduce:transition-none";

/** Tracks whether `target` has scrolled up under the sticky `toolbar`. */
function useCollapsed(
  toolbar: React.RefObject<HTMLElement | null>,
  target: React.RefObject<HTMLElement | null>
): boolean {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const titleEl = target.current;
    if (!titleEl || typeof IntersectionObserver === "undefined") return;
    const bar = toolbar.current;
    // The band the toolbar covers once it sticks: its `top` plus its height.
    const stickyTop = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
    const covered = Math.round(stickyTop + (bar?.getBoundingClientRect().height || 56));
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const rootTop = entry.rootBounds?.top ?? covered;
        setCollapsed(!entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop + 1);
      },
      { rootMargin: `-${covered}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(titleEl);
    return () => observer.disconnect();
  }, [toolbar, target]);

  return collapsed;
}

export function PageHeader({
  title,
  subtitle,
  back,
  leading,
  actions,
  backdrop,
  className,
}: PageHeaderProps) {
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const collapsed = useCollapsed(toolbarRef, titleRef);
  const hasToolbarContent = Boolean(back) || Boolean(actions);

  return (
    <header
      data-slot="page-header"
      data-collapsed={collapsed ? "" : undefined}
      // `isolate` keeps the backdrop's negative z-index inside the header, above the page.
      className={cn("flex flex-col", backdrop != null && "relative isolate", className)}
    >
      {backdrop != null && (
        <div
          aria-hidden="true"
          data-slot="page-header-backdrop"
          className={cn(
            "rounded-card pointer-events-none absolute inset-0 -z-10 overflow-hidden print:hidden",
            fade,
            collapsed ? "opacity-0" : "opacity-100"
          )}
        >
          {backdrop}
        </div>
      )}
      <div
        ref={toolbarRef}
        data-slot="page-header-toolbar"
        className={cn("z-sticky sticky top-(--shell-header-top)", !hasToolbarContent && "h-0")}
      >
        <div
          className={cn(
            "flex h-14 items-center gap-2",
            backdrop != null ? "px-4" : "px-2",
            hasToolbarContent ? "relative" : "absolute inset-x-0 top-0",
            !hasToolbarContent && !collapsed && "pointer-events-none"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "facet-chrome shadow-floating rounded-card pointer-events-none absolute inset-0",
              fade,
              collapsed ? "opacity-100" : "opacity-0"
            )}
          />
          <div className="relative flex min-w-0 flex-1 items-center gap-1">
            {back && (
              <Button asChild variant="ghost" size="sm" className="-ml-1 shrink-0">
                <Link href={back.href}>
                  <NavArrowLeft aria-hidden />
                  <span className="max-w-40 truncate">{back.label ?? "Back"}</span>
                </Link>
              </Button>
            )}
            {/* Visual copy of the <h1>; hidden from assistive tech. */}
            <span
              aria-hidden
              data-slot="page-header-compact-title"
              className={cn(
                "text-headline text-label min-w-0 truncate px-1",
                fade,
                collapsed ? "opacity-100" : "opacity-0"
              )}
            >
              {title}
            </span>
          </div>
          <div aria-hidden className="w-(--shell-halo-reserve) shrink" />
          {actions && (
            <div className="relative flex min-w-0 flex-1 items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-4",
          backdrop != null ? "px-4 pt-2 pb-6" : "px-2 pt-2 pb-4"
        )}
      >
        {leading}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 ref={titleRef} className="text-large-title text-label">
            {title}
          </h1>
          {subtitle != null && subtitle !== false && (
            <div className="text-callout text-label-secondary max-w-2xl">{subtitle}</div>
          )}
        </div>
      </div>
    </header>
  );
}
