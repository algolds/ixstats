"use client";

/**
 * AppSidebar: the primary navigation at ≥1024px.
 *
 * A `facet-chrome` panel floating on the leading edge (`z-chrome`, 256px, collapsible to 64px;
 * the width is the `--shell-sidebar-width` variable from `src/styles/facet/shell.css`, so the
 * persisted collapsed state is right before first paint). A thin host: the app tree is
 * `SourceList`, the single-line `SidebarVaultCard` well and the `AccountMenu` + inline collapse
 * button sit below it.
 *
 * Collapsing is CSS-driven (`data-sidebar="collapsed"` on <html>), so the full list and the icon
 * rail are both rendered and toggled with `sidebar-collapsed:` variants. Every rail icon is a
 * 1-click `<Link>` to its app; apps with subtabs wrap their rail link in a `facet-overlay`
 * `HoverCard` so subtabs remain 1-click reachable on hover.
 */

import * as React from "react";
import Link from "next/link";
import { Search, Settings, SidebarCollapse, SidebarExpand, Wallet } from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { Button, focusRing } from "~/components/ui/button";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Tooltip } from "~/components/ui/tooltip";
import { FacetMaterial } from "~/components/ui/facet";
import { useContextArea } from "~/components/shared/context-menu/SystemContextMenu";
import {
  getActiveSectionId,
  getVisibleAppForPath,
  withCountryRows,
  type AppDefinition,
  type CountryRowMeta,
  type NavAction,
  type NavBadges,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";
import { SourceList, isListed, isPending, sourceRowClassName } from "./SourceList";

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
  /** Signed in: shows the rail wallet. */
  signedIn?: boolean;
  /**
   * The expanded single-line wallet well (`SidebarVaultCard`), above the account row.
   */
  vaultCard?: React.ReactNode;
  /** Opened section groups (Admin), remembered by the host. */
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  badges: NavBadges;
  onAction?: (action: NavAction) => void;
  /** The user's public country profile (MyCountry's profile and editor rows). */
  countryHref?: string;
  /** Nation identity attributes attached to `MyCountry → Public profile`. */
  countryMeta?: CountryRowMeta;
  /** Return destination for `All apps` when viewing Settings or Admin. */
  backHref?: string;
  className?: string;
}

const APP_SIDEBAR_ID = "facet-app-sidebar";

function sidebarShortcutHint(): string {
  if (typeof navigator === "undefined") return "Ctrl \\";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘\\" : "Ctrl \\";
}

function searchShortcutHint(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K";
}

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
    current ? "facet-recess text-tint" : "text-tint hover:bg-fill-4"
  );

function RailGlyph({ app, showDot }: { app: AppDefinition; showDot: boolean }) {
  const Icon = app.icon;
  return (
    <>
      <Icon aria-hidden className="size-5" />
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

/** The collapsed form of the wallet card: one icon to the Vault, dotted while a reward waits. */
function RailWallet({ claimable }: { claimable: boolean }) {
  return (
    <div data-app="vault" className="sidebar-collapsed:flex hidden justify-center">
      <Tooltip content="Wallet" side="right" sideOffset={8}>
        <Link href="/vault" aria-label="Wallet" className={railButtonClassName(false)}>
          <Wallet aria-hidden className="size-5" />
          {claimable && (
            <span
              role="img"
              aria-label="Daily reward ready"
              className="bg-tint ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
            />
          )}
        </Link>
      </Tooltip>
    </div>
  );
}

function RailLink({
  href,
  label,
  tint,
  current,
  children,
}: {
  href: string;
  label: string;
  tint: string | undefined;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <li data-app={tint}>
      <Tooltip content={label} side="right" sideOffset={8}>
        <Link
          href={href}
          aria-label={label}
          aria-current={current ? "page" : undefined}
          className={railButtonClassName(current)}
        >
          {children}
        </Link>
      </Tooltip>
    </li>
  );
}

/** An `inline` app (Home) puts each listed section on the rail as its own link, like the full list. */
function RailInlineSections({
  app,
  activeSectionId,
  badges,
}: {
  app: AppDefinition;
  /** The current section, when the current page belongs to this app. */
  activeSectionId: string | undefined;
  badges: NavBadges;
}) {
  return app.sections
    .filter((s) => !s.action && isListed(s, badges))
    .map((s) => {
      const Icon = s.icon;
      const badge = s.badge ? badges[s.badge] : undefined;
      const count = badge?.kind === "count" ? badge.value : 0;
      return (
        <RailLink
          key={s.id}
          href={s.href}
          label={count > 0 ? `${s.label}, ${count} unread` : s.label}
          tint={app.tint}
          current={s.id === activeSectionId}
        >
          <Icon aria-hidden className="size-5" />
          {count > 0 ? (
            <span
              aria-hidden
              className="bg-tint text-caption ring-background text-on-tint absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center leading-4 font-medium tabular-nums ring-2"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : (
            isPending(badge) && (
              <span
                role="img"
                aria-label="Has updates"
                className="bg-tint ring-background absolute top-1 right-1 size-2 rounded-full ring-2"
              />
            )
          )}
        </RailLink>
      );
    });
}

function RailApp({
  app,
  isCurrent,
  list,
  plain = false,
}: {
  app: AppDefinition;
  isCurrent: boolean;
  /** Footer apps open as an area of their own, so the rail links straight to them. */
  plain?: boolean;
  list: Omit<React.ComponentProps<typeof SourceList>, "variant" | "app" | "onNavigate">;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const resolvedApp = withCountryRows([app], list.countryHref, list.countryMeta)[0]!;
  const visibleSections = resolvedApp.sections.filter((s) => isListed(s, list.badges));
  const hasSections = visibleSections.length > 0 && !plain;
  const appBadge = app.badge ? list.badges[app.badge] : undefined;
  const pending =
    isPending(appBadge) ||
    resolvedApp.sections.some((s) => s.badge && isPending(list.badges[s.badge]));
  const glyph = <RailGlyph app={app} showDot={pending} />;

  if (!hasSections) {
    return (
      <RailLink href={app.href} label={app.label} tint={app.tint} current={isCurrent}>
        {glyph}
      </RailLink>
    );
  }

  return (
    <li data-app={app.tint}>
      <HoverCard open={open} onOpenChange={setOpen} openDelay={220} closeDelay={120}>
        <HoverCardTrigger asChild>
          <Link
            href={app.href}
            aria-label={app.label}
            aria-current={isCurrent ? "page" : undefined}
            className={railButtonClassName(isCurrent)}
          >
            {glyph}
          </Link>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={10}
          data-app={app.tint}
          className="w-56 p-1.5"
        >
          <div className="text-footnote text-label px-2.5 py-1 font-semibold">{app.label}</div>
          <SourceList {...list} variant="popover" app={resolvedApp} onNavigate={close} />
        </HoverCardContent>
      </HoverCard>
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
  signedIn = false,
  vaultCard,
  expanded,
  onToggle,
  badges,
  onAction,
  countryHref,
  countryMeta,
  backHref,
  className,
}: AppSidebarProps) {
  const current = getVisibleAppForPath(pathname, apps);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const tint = current?.tint;
  const isCollapsed = collapsed ?? false;
  const mainApps = apps.filter((app) => app.placement !== "footer");
  const footerApps = apps.filter((app) => app.placement === "footer");
  const list = {
    pathname,
    searchParams,
    apps,
    expanded,
    onToggle,
    badges,
    onAction,
    countryHref,
    countryMeta,
    backHref,
  };

  const contextAreaProps = useContextArea(() => (
    <>
      <DropdownMenuItem onSelect={() => onCollapsedChange(!isCollapsed)}>
        {isCollapsed ? <SidebarExpand /> : <SidebarCollapse />}
        <span>{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        <span className="text-caption text-label-tertiary ml-auto tabular-nums">
          {sidebarShortcutHint()}
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() =>
          window.dispatchEvent(new CustomEvent("ix:open-halo-mode", { detail: "search" }))
        }
      >
        <Search />
        <span>Search &amp; commands</span>
        <span className="text-caption text-label-tertiary ml-auto tabular-nums">
          {searchShortcutHint()}
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() =>
          window.dispatchEvent(new CustomEvent("ix:open-halo-mode", { detail: "settings" }))
        }
      >
        <Settings />
        <span>Quick settings</span>
      </DropdownMenuItem>
    </>
  ));

  const collapseLabel = `${isCollapsed ? "Expand" : "Collapse"} sidebar (${sidebarShortcutHint()})`;

  return (
    <aside
      id={APP_SIDEBAR_ID}
      aria-label="Sidebar"
      data-slot="app-sidebar"
      data-app={tint}
      {...contextAreaProps}
      className={cn(
        "z-chrome fixed inset-y-0 left-0 hidden w-(--shell-sidebar-width) p-2 lg:flex",
        className
      )}
    >
      {/* min-w-0: the panel keeps to its column, so a section label wider than it truncates (app labels never do) instead of widening the panel over the page's left edge. */}
      <FacetMaterial data-slot="app-sidebar-panel" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ScrollArea className="sidebar-collapsed:hidden min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block">
          <div className="px-2 pt-2 pb-2">
            <SourceList {...list} variant="sidebar" />
          </div>
        </ScrollArea>

        {/* A landmark of its own: the full list's nav is hidden while collapsed. */}
        <nav
          aria-label="Apps"
          data-slot="app-sidebar-rail"
          className="sidebar-collapsed:flex hidden min-h-0 flex-1 flex-col items-center"
        >
          <ul className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
            {mainApps.map((app) =>
              app.inline ? (
                <RailInlineSections
                  key={app.id}
                  app={app}
                  activeSectionId={app.id === current?.id ? activeSectionId : undefined}
                  badges={badges}
                />
              ) : (
                <RailApp key={app.id} app={app} isCurrent={app.id === current?.id} list={list} />
              )
            )}
          </ul>
          {footerApps.length > 0 && (
            <ul className="border-separator flex w-full flex-col items-center gap-1 border-t py-2">
              {footerApps.map((app) => (
                <RailApp
                  key={app.id}
                  app={app}
                  isCurrent={app.id === current?.id}
                  list={list}
                  plain
                />
              ))}
            </ul>
          )}
        </nav>

        <div className="border-separator flex flex-col gap-1.5 border-t p-2">
          {vaultCard && <div className="sidebar-collapsed:hidden">{vaultCard}</div>}
          {signedIn && <RailWallet claimable={isPending(badges["daily-reward"])} />}
          <div className="sidebar-collapsed:flex-col sidebar-collapsed:items-center flex items-center gap-1">
            {account && <div className="sidebar-collapsed:w-auto min-w-0 flex-1">{account}</div>}
            <Tooltip content={collapseLabel} side={isCollapsed ? "right" : "top"} sideOffset={8}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-controls={APP_SIDEBAR_ID}
                aria-expanded={!isCollapsed}
                aria-keyshortcuts="Meta+\ Control+\"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={() => onCollapsedChange(!isCollapsed)}
                className="sidebar-collapsed:size-9 text-label-secondary shrink-0"
              >
                <SidebarCollapse aria-hidden className="sidebar-collapsed:hidden size-4" />
                <SidebarExpand aria-hidden className="sidebar-collapsed:block hidden size-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </FacetMaterial>
    </aside>
  );
}
