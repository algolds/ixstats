"use client";

/**
 * An app index page's `PageHeader`, only under the new navigation shell (Facet 3 spec §7.4).
 *
 * With the flag on, phones have a TabBar but no top bar, so nothing names the page; this gives them
 * the large title. By default it is phone-only (`lg:hidden`): at ≥1024px the AppSidebar already
 * names the app and the page's own hero/header stays as it is. With the flag off it renders nothing
 * (`ShellGate`: CSS-hidden until hydration, then unmounted), so the legacy page is unchanged.
 *
 * ```tsx
 * <ShellPageHeader title="Vault" subtitle="IxCredits, cards and the marketplace." />
 * ```
 *
 * A page that keeps its own in-page title (hero `<h1>`) marks it with `shellPageTitleProps` so the
 * title is not shown twice: while a `ShellPageHeader` is on the page under the new shell, the
 * marked element is hidden wherever the shell header shows (below 1024px by default, at every
 * width with `phoneOnly={false}`). Pure CSS (src/styles/facet/shell.css), so it is right before
 * first paint; with the flag off nothing changes.
 *
 * ```tsx
 * <h1 {...shellPageTitleProps} className="text-large-title">Countries</h1>
 * ```
 */

import type { ReactNode } from "react";

import { cn } from "~/lib/utils/cn";
import { PageHeader, type PageHeaderProps } from "./PageHeader";
import { ShellGate } from "./ShellGate";

/** Attribute that marks a page's own title as the one a `ShellPageHeader` replaces. */
export const SHELL_PAGE_TITLE_ATTRIBUTE = "data-shell-page-title";

/** Spread onto a page's own title element to hide it where the `ShellPageHeader` shows. */
export const shellPageTitleProps = { [SHELL_PAGE_TITLE_ATTRIBUTE]: "" } as const;

export interface ShellPageHeaderProps extends Pick<PageHeaderProps, "back" | "actions"> {
  title: string;
  subtitle?: ReactNode;
  /** Show it below 1024px only (default). Set false for pages without their own title. */
  phoneOnly?: boolean;
  /** Classes for the wrapper (width and padding to line up with the page content). */
  className?: string;
}

export function ShellPageHeader({
  title,
  subtitle,
  back,
  actions,
  phoneOnly = true,
  className,
}: ShellPageHeaderProps) {
  return (
    <ShellGate variant="facet">
      <div
        data-slot="shell-page-header"
        data-shell-page-header={phoneOnly ? "phone" : "all"}
        className={cn(
          "mx-auto w-full max-w-7xl px-2 pt-2 sm:px-4",
          phoneOnly && "lg:hidden",
          className
        )}
      >
        <PageHeader title={title} subtitle={subtitle} back={back} actions={actions} />
      </div>
    </ShellGate>
  );
}
