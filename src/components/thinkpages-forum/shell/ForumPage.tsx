"use client";

import * as React from "react";
import { InfoCircle } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Inspector } from "~/components/ui/inspector";

/** The width from which the Inspector shows its panels on the page, as `Inspector` decides it. */
const RAIL_QUERY = "(min-width: 1280px)";

/**
 * The page column's horizontal padding, which the header's `bleed` (`-mx-2`) pulls out of. Needed wherever the
 * header would otherwise reach the viewport edge: everything below xl, and at xl and wider too when there is no
 * rail (no Inspector gutter beside the column to absorb the bleed, which would overflow by 8px). From xl, with a
 * rail, the shell's sidebar and inspector gutters sit beside the column, so the approved flush layout stays.
 */
const PAGE_COLUMN = "flex min-w-0 flex-col px-4";
const PAGE_COLUMN_WITH_RAIL = `${PAGE_COLUMN} xl:px-0`;

interface ForumPageProps {
  title: string;
  /** The trail above the page (rendered under the title). */
  breadcrumbs?: React.ReactNode;
  /** Page actions in the header toolbar. */
  actions?: React.ReactNode;
  /** Rail panels: the Inspector at 1280px and wider, a sheet behind the header's Info button below that. */
  rail?: React.ReactNode;
  /** The Inspector's accessible title and sheet heading; "Info" when omitted. */
  railTitle?: string;
  /** A hash (`#standing`) that opens the rail's sheet below 1280px, where its panels are not on the page. */
  openRailOnHash?: string;
  /** The compact header's way up, which stays after the trail has scrolled away. */
  back?: { href: string; label?: string };
  children: React.ReactNode;
}

/**
 * The shell every forum page shares: the standard `PageHeader`, the main column and the optional rail in the
 * Facet `Inspector`. Only the rail's sheet state is client state; `children` stay server-renderable.
 */
export function ForumPage({
  title,
  breadcrumbs,
  actions,
  rail,
  railTitle,
  openRailOnHash,
  back,
  children,
}: ForumPageProps) {
  const [railOpen, setRailOpen] = React.useState(false);
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
      <div className={hasRail ? PAGE_COLUMN_WITH_RAIL : PAGE_COLUMN}>
        <PageHeader
          title={title}
          subtitle={breadcrumbs}
          back={back}
          bleed
          actions={
            actions != null || hasRail ? (
              <>
                {actions}
                {hasRail && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="xl:hidden"
                    aria-haspopup="dialog"
                    aria-expanded={railOpen}
                    onClick={() => setRailOpen(true)}
                  >
                    <InfoCircle aria-hidden />
                    Info
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </div>
      {hasRail && (
        <Inspector title={label} open={railOpen} onOpenChange={setRailOpen} className="space-y-4">
          {rail}
        </Inspector>
      )}
    </>
  );
}
