"use client";

/**
 * AppSidebar: the primary navigation at ≥1024px.
 *
 * A `facet-chrome` panel floating on the leading edge (`z-chrome`, 256px, collapsible to 64px;
 * the width is the `--shell-sidebar-width` variable from `src/styles/facet/shell.css`, so the
 * persisted collapsed state is right before first paint). A thin host: the app tree is
 * `SourceList`, the account slot and the collapse toggle sit below it.
 *
 * Collapsing is CSS-driven (`data-sidebar="collapsed"` on <html>), so the full list and the icon
 * rail are both rendered and toggled with `sidebar-collapsed:` variants; the `collapsed` prop
 * only feeds tooltips and the toggle's label, because it is `null` before hydration. Each rail
 * app with sections opens a popover listing them, so a collapsed sidebar still reaches every
 * section.
 *
 * Presentational: the route, visible apps, badges, disclosure state, account slot and collapsed
 * state come in as props (`FacetShell` wires them), so it renders the same on the server and in
 * tests.
 */

import * as React from "react";
import Link from "next/link";
import { SidebarCollapse, SidebarExpand } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { FacetMaterial } from "~/components/ui/facet";
import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  type AppDefinition,
  type NavAction,
  type NavBadges,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";
import { SourceList, isPending, sourceRowClassName } from "./SourceList";

interface AppSidebarProps {
  /** Current pathname without the base path. */
  pathname: string;
  /** Current query, or null when not known yet (query sections fall back to their default). */
  searchParams: SearchParamsLike | null;
  /** Apps this user can see (`getVisibleApps`). */
  apps: readonly AppDefinition[];
  /** Collapsed to icons; `null` before hydration (CSS already reflects the stored state). */
  collapsed: boolean | null;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The account row (`AccountMenu`, or its sign-in button) pinned at the bottom. */
  account?: React.ReactNode;
  /** Opened apps and section groups, remembered by the host. */
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  badges: NavBadges;
  onAction?: (action: NavAction) => void;
  className?: string;
}

const APP_SIDEBAR_ID = "facet-app-sidebar";

export const rowBase = cn(
  sourceRowClassName,
  "sidebar-collapsed:justify-center sidebar-collapsed:px-0"
);

/** Wraps a row in a trailing tooltip when the sidebar is collapsed to icons. */
export function CollapsedTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean | null;
  label: string;
  children: React.ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip content={label} side="right" sideOffset={8}>
      {children}
    </Tooltip>
  );
}

const railButtonClassName = (current: boolean) =>
  cn(
    focusRing,
    "rounded-control relative grid size-9 shrink-0 cursor-pointer place-items-center transition-colors duration-fast ease-out-facet pointer-coarse:size-11",
    current ? "bg-tint-fill text-tint" : "text-label hover:bg-fill-4"
  );

function RailGlyph({
  app,
  badges,
  showDot,
}: {
  app: AppDefinition;
  badges: NavBadges;
  showDot: boolean;
}) {
  const Icon = app.icon;
  const badge = app.badge ? badges[app.badge] : undefined;
  return (
    <>
      {badge?.kind === "icon" ? (
        <img src={badge.src} alt="" className="size-5 rounded-sm object-cover" />
      ) : (
        <Icon aria-hidden className="size-5" />
      )}
      {showDot && (
        <span
          role="img"
          aria-label="Has updates"
          className="bg-tint ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
        />
      )}
    </>
  );
}

function RailApp({
  app,
  isCurrent,
  list,
}: {
  app: AppDefinition;
  isCurrent: boolean;
  list: Omit<React.ComponentProps<typeof SourceList>, "variant" | "app" | "onNavigate">;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const hasSections = app.sections.length > 0;
  const pending = app.sections.some((s) => s.badge && isPending(list.badges[s.badge]));
  const glyph = <RailGlyph app={app} badges={list.badges} showDot={pending} />;

  if (!hasSections) {
    return (
      <li data-app={app.tint}>
        <Tooltip content={app.label} side="right" sideOffset={8}>
          <Link
            href={app.href}
            aria-label={app.label}
            aria-current={isCurrent ? "page" : undefined}
            className={railButtonClassName(isCurrent)}
          >
            {glyph}
          </Link>
        </Tooltip>
      </li>
    );
  }

  return (
    <li data-app={app.tint}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip content={app.label} side="right" sideOffset={8} open={open ? false : undefined}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={app.label}
              aria-current={isCurrent ? "page" : undefined}
              className={railButtonClassName(isCurrent)}
            >
              {glyph}
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={12}
          data-app={app.tint}
          className="w-64 p-2"
        >
          <Link
            href={app.href}
            onClick={close}
            className={cn(
              sourceRowClassName,
              focusRing,
              "text-headline text-label hover:bg-fill-4"
            )}
          >
            {app.label}
          </Link>
          <SourceList {...list} variant="popover" app={app} onNavigate={close} />
        </PopoverContent>
      </Popover>
    </li>
  );
}

export function AppSidebar({
  pathname,
  searchParams,
  apps,
  collapsed,
  onCollapsedChange,
  account,
  expanded,
  onToggle,
  badges,
  onAction,
  className,
}: AppSidebarProps) {
  const current = getAppForPath(pathname);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const tint = getTintForPath(current, activeSectionId);
  const isCollapsed = collapsed ?? false;
  const list = { pathname, searchParams, apps, expanded, onToggle, badges, onAction };

  return (
    <aside
      id={APP_SIDEBAR_ID}
      aria-label="Sidebar"
      data-slot="app-sidebar"
      data-app={tint}
      className={cn(
        "z-chrome fixed inset-y-0 left-0 hidden w-(--shell-sidebar-width) p-2 lg:flex",
        className
      )}
    >
      <FacetMaterial data-slot="app-sidebar-panel" className="flex min-h-0 flex-1 flex-col">
        <div className="sidebar-collapsed:hidden min-h-0 flex-1 overflow-y-auto px-2 pt-2 pb-2">
          <SourceList {...list} variant="sidebar" />
        </div>

        <ul
          data-slot="app-sidebar-rail"
          aria-label="Apps"
          className="sidebar-collapsed:flex hidden min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-2"
        >
          {apps
            .filter((app) => app.placement !== "footer")
            .map((app) => (
              <RailApp key={app.id} app={app} isCurrent={app.id === current?.id} list={list} />
            ))}
        </ul>

        <div className="border-separator flex flex-col gap-0.5 border-t p-2">
          {account && <div className="sidebar-collapsed:justify-center flex">{account}</div>}
          <CollapsedTooltip collapsed={collapsed} label="Expand sidebar">
            <button
              type="button"
              aria-controls={APP_SIDEBAR_ID}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => onCollapsedChange(!isCollapsed)}
              className={cn(
                rowBase,
                focusRing,
                "text-label-secondary hover:bg-fill-4 cursor-pointer"
              )}
            >
              <SidebarCollapse aria-hidden className="sidebar-collapsed:hidden size-4 shrink-0" />
              <SidebarExpand
                aria-hidden
                className="sidebar-collapsed:block hidden size-4 shrink-0"
              />
              <span className="sidebar-collapsed:sr-only min-w-0 flex-1 truncate text-left">
                Collapse
              </span>
            </button>
          </CollapsedTooltip>
        </div>
      </FacetMaterial>
    </aside>
  );
}
