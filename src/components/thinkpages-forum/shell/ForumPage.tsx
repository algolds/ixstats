"use client";

import * as React from "react";
import { InfoCircle } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Inspector } from "~/components/ui/inspector";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { cn } from "~/lib/utils/cn";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { PHONE_QUERY } from "../composer/constants";

/** The width from which the Inspector shows its panels on the page, as `Inspector` decides it. */
const RAIL_QUERY = "(min-width: 1280px)";

/**
 * The page column: the dashboard's 16px inset on the sides, which the header's `bleed` (`-mx-2`) pulls out of so its
 * title and actions line up with the cards, and MyCountry's top padding (`py-4 md:py-8`), which lowers the toolbar
 * row, and so the page's actions, below the floating top chrome instead of under it.
 */
const PAGE_COLUMN = "flex min-w-0 flex-col px-4 pt-4 pb-8 md:pt-8";

interface ForumPageProps {
  title: string;
  /** The trail above the page (rendered under the title). */
  breadcrumbs?: React.ReactNode;
  /** An emblem or avatar before the large title (an entity page such as a realm's landing). */
  leading?: React.ReactNode;
  /**
   * Icon-sized page actions: in the header toolbar from md up, and on a phone in the row under the title with the
   * wide actions, so the toolbar halves beside the floating top chrome hold only the Info button.
   */
  actions?: React.ReactNode;
  /**
   * Wide page actions (a realm picker, a Sort or New thread button): in the header toolbar from md up, and on a phone
   * in a row under the title, because the toolbar's middle is kept clear for the floating top chrome and its two
   * halves hold little more than an icon each.
   */
  wideActions?: React.ReactNode;
  /** Rail panels: the Inspector at 1280px and wider, a sheet behind the header's Info button below that. */
  rail?: React.ReactNode;
  /** The Inspector's accessible title and sheet heading; "Info" when omitted. */
  railTitle?: string;
  /** A hash (`#standing`) that opens the rail's sheet below 1280px, where its panels are not on the page. */
  openRailOnHash?: string;
  /** The compact header's way up, which stays after the trail has scrolled away. */
  back?: { href: string; label?: string };
  /** Art behind the expanded header (`PageHeader`'s backdrop): a masthead. */
  backdrop?: React.ReactNode;
  /**
   * A tint paper grain on the page canvas, under the header and the panes. Textures never sit on data, so it goes
   * behind the panes and shows through their glass.
   */
  paperGrain?: boolean;
  children: React.ReactNode;
}

/**
 * The shell every forum page shares: the standard `PageHeader`, the main column and the optional rail in the
 * Facet `Inspector`. Only the rail's sheet state is client state; `children` stay server-renderable.
 */
export function ForumPage({
  title,
  breadcrumbs,
  leading,
  actions,
  wideActions,
  rail,
  railTitle,
  openRailOnHash,
  back,
  backdrop,
  paperGrain = false,
  children,
}: ForumPageProps) {
  const [railOpen, setRailOpen] = React.useState(false);
  const phone = useMediaQuery(PHONE_QUERY);
  const hasWide = wideActions != null && wideActions !== false;
  const hasActions = actions != null && actions !== false;
  const label = railTitle ?? "Info";
  const hasRail = rail != null && rail !== false;
  const watchHash = hasRail && openRailOnHash !== undefined;
  React.useEffect(() => {
    if (!watchHash || window.location.hash !== openRailOnHash) return;
    // The URL hash is an external system; the sheet opens once, when the rail first exists.
    // oxlint-disable-next-line react/set-state-in-effect
    if (!window.matchMedia(RAIL_QUERY).matches) setRailOpen(true);
  }, [watchHash, openRailOnHash]);
  return (
    <>
      {/*
        The grain is the column's first positioned box; the header and the content are positioned after it, so they
        paint over it. No `isolate` or z-index: a stacking context here would trap the header's sticky compact bar.
      */}
      <div className={cn(PAGE_COLUMN, paperGrain && "relative")}>
        {paperGrain ? (
          <TextureOverlay texture="paperGrain" className="[--facet-texture-color:var(--tint)]" />
        ) : null}
        <PageHeader
          title={title}
          subtitle={breadcrumbs}
          leading={leading}
          back={back}
          backdrop={backdrop}
          className={paperGrain ? "relative" : undefined}
          bleed
          actions={
            hasRail || (!phone && (hasActions || hasWide)) ? (
              <>
                {phone ? null : wideActions}
                {phone ? null : actions}
                {hasRail && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-label-secondary xl:hidden"
                    aria-haspopup="dialog"
                    aria-expanded={railOpen}
                    onClick={() => setRailOpen(true)}
                  >
                    <InfoCircle aria-hidden />
                    <span className="max-md:sr-only">Info</span>
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
        <div className={cn("flex min-w-0 flex-col gap-4", paperGrain && "relative")}>
          {phone && (hasWide || hasActions) ? (
            <div
              data-slot="forum-page-actions"
              className="flex flex-wrap items-center gap-2 empty:hidden [&>*]:min-w-0"
            >
              {wideActions}
              {actions}
            </div>
          ) : null}
          {children}
        </div>
      </div>
      {hasRail && (
        <Inspector title={label} open={railOpen} onOpenChange={setRailOpen} className="space-y-4">
          {rail}
        </Inspector>
      )}
    </>
  );
}
