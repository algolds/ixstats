"use client";

import * as React from "react";
import { InfoCircle } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Inspector } from "~/components/ui/inspector";

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
  children: React.ReactNode;
}

/**
 * The shell every forum page shares: the standard `PageHeader`, the main column and the optional rail in the
 * Facet `Inspector`. Only the rail's sheet state is client state; `children` stay server-renderable.
 */
export function ForumPage({ title, breadcrumbs, actions, rail, railTitle, children }: ForumPageProps) {
  const [railOpen, setRailOpen] = React.useState(false);
  const label = railTitle ?? "Info";
  const hasRail = rail != null && rail !== false;
  return (
    <>
      <PageHeader
        title={title}
        subtitle={breadcrumbs}
        bleed
        actions={
          actions != null || hasRail ? (
            <>
              {actions}
              {hasRail && (
                <Button variant="secondary" size="sm" className="xl:hidden" onClick={() => setRailOpen(true)}>
                  <InfoCircle aria-hidden />
                  Info
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      {hasRail && (
        <Inspector title={label} open={railOpen} onOpenChange={setRailOpen} className="space-y-4">
          {rail}
        </Inspector>
      )}
    </>
  );
}
