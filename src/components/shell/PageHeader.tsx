"use client";

/**
 * PageHeader: the page's large title (`text-large-title`, the one `<h1>`), which collapses into a
 * compact toolbar title on scroll.
 *
 * The toolbar is sticky at `--shell-header-top` and turns into a `facet-chrome` bar with the compact title once the large title has
 * scrolled under it. It holds the optional back button and trailing actions, and keeps the middle
 * `--shell-halo-reserve` clear so Halo can float over it. Without a back button or actions the
 * toolbar is an empty band of the same height until it collapses: with no top bar the page starts
 * at the top of the window, and the band keeps the large title clear of Halo. Only opacity animates
 * (`duration-fast`); Reduce Motion makes it instant.
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
  /**
   * Trailing toolbar actions (buttons, a dropdown menu). A function receives whether the header
   * has collapsed into the compact bar, for actions styled differently over backdrop art.
   */
  actions?: React.ReactNode | ((state: { collapsed: boolean }) => React.ReactNode);
  /**
   * Decorative art behind the expanded header. It is clipped to the header's rounded box, fades out
   * once the header collapses, and never reaches the compact toolbar. Readability is the header's
   * job, not the art's: the title block sits on a plate (`BACKDROP_PLATE`), and trailing actions
   * that need one apply the same classes.
   */
  backdrop?: React.ReactNode;
  /**
   * Whether the backdrop actually shows art (default true). A header whose art is missing or failed
   * keeps the backdrop layout, so nothing shifts, but drops the plate behind the title.
   */
  backdropVisible?: boolean;
  /**
   * For pages that already pad their content (the forum): pulls the header out by its own inner
   * gutter, so the title and toolbar actions line up with the page's content edge instead of
   * sitting a gutter further in. It does not apply to the `backdrop` variant, whose gutter is
   * `px-4` rather than `px-2`.
   */
  bleed?: boolean;
  className?: string;
}

/**
 * The page background role at 90% behind text over backdrop art, opaque under Reduce Transparency
 * and Increase Contrast. At 90% the worst case (a pure black flag pixel in light mode, pure white
 * in dark) leaves label-secondary at 5.5:1 (light) and 6:1 (dark), over the 4.5:1 AA bar.
 */
export const BACKDROP_PLATE =
  "bg-grouped/90 transparency-reduced:bg-grouped contrast-more:bg-grouped";

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
  backdropVisible = true,
  bleed,
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
      // No `isolate`/z-index here: a stacking context would trap the sticky toolbar's `z-sticky`
      // and let later page content paint over the compact bar. The backdrop sits at z-base and the
      // expanded block at z-raised (below z-sticky) instead.
      className={cn(
        "flex flex-col",
        backdrop != null && "relative",
        // Cancels the inner `px-2` gutter (the toolbar and the title block both use it).
        bleed && "-mx-2",
        className
      )}
    >
      {backdrop != null && (
        <div
          aria-hidden="true"
          data-slot="page-header-backdrop"
          className={cn(
            "rounded-card z-base pointer-events-none absolute inset-0 overflow-hidden print:hidden",
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
        className={cn("z-sticky sticky top-(--shell-header-top)", !hasToolbarContent && "h-14")}
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
              {typeof actions === "function" ? actions({ collapsed }) : actions}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-4",
          backdrop != null ? "z-raised relative px-4 pt-2 pb-6" : "px-2 pt-2 pb-4"
        )}
      >
        {leading}
        <div
          data-slot={backdrop != null ? "page-header-plate" : undefined}
          className={cn(
            "flex min-w-0 flex-col gap-1",
            // Sized to the text, so long names are covered too.
            backdrop != null && cn("rounded-card px-4 py-3", backdropVisible && BACKDROP_PLATE)
          )}
        >
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
