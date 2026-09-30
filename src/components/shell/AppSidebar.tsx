"use client";

/**
 * AppSidebar (Facet 3 spec §7.4): the primary navigation at ≥1024px when the `facet-nav` flag is on.
 *
 * `material-regular` floating panel on the leading edge (`z-chrome`, 256px, collapsible to 64px
 * icons; the width is the `--shell-sidebar-width` variable from `src/styles/facet/shell.css`, so
 * the persisted collapsed state is right before first paint). Top: the app switcher. Middle: the
 * current app's sections from the section map, the current one tinted and `aria-current="page"`.
 * Sections with a `group` are listed under a sub-heading (`role="group"`). Bottom: the account,
 * Settings and the collapse toggle.
 *
 * Presentational: the route, visible apps, account and collapsed state come in as props
 * (`FacetShell` wires them), so it renders the same on the server and in tests.
 */

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  NavArrowDown,
  Check,
  SidebarCollapse,
  SidebarExpand,
  User as UserIcon,
} from "iconoir-react";

import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { springSmooth } from "~/lib/design/motion";
import {
  getActiveSectionId,
  getAppForPath,
  getTintForPath,
  groupSections,
  type AppDefinition,
  type NavIcon,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";

export interface ShellAccount {
  name: string;
  imageUrl?: string | null;
}

export interface AppSidebarProps {
  /** Current pathname without the base path. */
  pathname: string;
  /** Current query, or null when not known yet (query sections fall back to their default). */
  searchParams: SearchParamsLike | null;
  /** Apps this user can see (`getVisibleApps`). */
  apps: readonly AppDefinition[];
  /** Collapsed to icons; `null` before hydration (CSS already reflects the stored state). */
  collapsed: boolean | null;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Signed-in account shown at the bottom; null when signed out. */
  account?: ShellAccount | null;
  /** Rendered in place of the account when signed out (e.g. a sign-in button). */
  signIn?: React.ReactNode;
  className?: string;
}

export const APP_SIDEBAR_ID = "facet-app-sidebar";

const rowBase =
  "relative flex min-h-9 w-full items-center gap-3 rounded-control px-2.5 text-body transition-colors duration-fast ease-out-facet pointer-coarse:min-h-11 sidebar-collapsed:justify-center sidebar-collapsed:px-0";

/** Wraps a row in a trailing tooltip when the sidebar is collapsed to icons. */
function CollapsedTooltip({
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

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  indicatorId,
}: {
  href: string;
  label: string;
  icon: NavIcon;
  active: boolean;
  collapsed: boolean | null;
  indicatorId: string;
}) {
  return (
    <li>
      <CollapsedTooltip collapsed={collapsed} label={label}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          data-active={active ? "" : undefined}
          className={cn(
            rowBase,
            focusRing,
            active ? "text-tint font-medium" : "text-label hover:bg-fill-4"
          )}
        >
          {active && (
            <motion.span
              aria-hidden
              layoutId={indicatorId}
              transition={springSmooth}
              className="bg-tint-fill rounded-control absolute inset-0"
            />
          )}
          <Icon aria-hidden className="relative size-4 shrink-0" />
          <span className="sidebar-collapsed:sr-only relative min-w-0 flex-1 truncate">
            {label}
          </span>
        </Link>
      </CollapsedTooltip>
    </li>
  );
}

function AppSwitcher({
  apps,
  current,
  collapsed,
}: {
  apps: readonly AppDefinition[];
  current: AppDefinition | undefined;
  collapsed: boolean | null;
}) {
  const CurrentIcon = current?.icon;
  const label = current?.label ?? "IxStats";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Switch app, current app ${label}`}
          data-slot="app-switcher"
          className={cn(
            rowBase,
            focusRing,
            "text-headline text-label hover:bg-fill-4 min-h-11 cursor-pointer"
          )}
        >
          <span
            aria-hidden
            className="bg-tint text-on-tint rounded-control-sm flex size-7 shrink-0 items-center justify-center"
          >
            {CurrentIcon ? <CurrentIcon className="size-4" /> : null}
          </span>
          <span className="sidebar-collapsed:sr-only min-w-0 flex-1 truncate text-left">
            {label}
          </span>
          <NavArrowDown
            aria-hidden
            className="text-label-secondary sidebar-collapsed:hidden size-4 shrink-0"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-60">
        <DropdownMenuLabel>Apps</DropdownMenuLabel>
        {apps.map((app) => {
          const Icon = app.icon;
          const isCurrent = app.id === current?.id;
          return (
            <DropdownMenuItem key={app.id} asChild>
              <Link href={app.href} aria-current={isCurrent ? "page" : undefined}>
                <Icon aria-hidden />
                <span className="flex-1">{app.label}</span>
                {isCurrent && <Check aria-hidden className="text-tint" />}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({
  pathname,
  searchParams,
  apps,
  collapsed,
  onCollapsedChange,
  account,
  signIn,
  className,
}: AppSidebarProps) {
  const current = getAppForPath(pathname);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const tint = getTintForPath(current, activeSectionId);
  const switcherApps = apps.filter((app) => app.placement !== "footer");
  const settingsApp = apps.find((app) => app.id === "settings");
  const sections = current?.sections ?? [];
  const isCollapsed = collapsed ?? false;

  return (
    <nav
      id={APP_SIDEBAR_ID}
      aria-label="App navigation"
      data-slot="app-sidebar"
      data-app={tint}
      className={cn(
        "z-chrome fixed inset-y-0 left-0 hidden w-(--shell-sidebar-width) p-2 lg:flex",
        className
      )}
    >
      <div className="material-regular shadow-floating rounded-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="p-2">
          <AppSwitcher apps={switcherApps} current={current} collapsed={collapsed} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {current && sections.length > 0 && (
            <>
              <h2 className="text-subhead text-label-secondary sidebar-collapsed:sr-only px-2.5 pt-2 pb-1">
                {current.label}
              </h2>
              {groupSections(sections).map(({ group, sections: groupItems }, index) => {
                const headingId = group
                  ? `app-sidebar-group-${current.id}-${group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
                  : undefined;
                return (
                  <div
                    key={group ?? `ungrouped-${index}`}
                    role={group ? "group" : undefined}
                    aria-labelledby={headingId}
                    data-slot="app-sidebar-group"
                    className={cn(
                      index > 0 &&
                        "sidebar-collapsed:border-separator sidebar-collapsed:mt-1 sidebar-collapsed:border-t sidebar-collapsed:pt-1"
                    )}
                  >
                    {group && (
                      <h3
                        id={headingId}
                        className="text-caption text-label-secondary sidebar-collapsed:sr-only px-2.5 pt-3 pb-1"
                      >
                        {group}
                      </h3>
                    )}
                    <ul className="flex flex-col gap-0.5">
                      {groupItems.map((section) => (
                        <SidebarLink
                          key={section.id}
                          href={section.href}
                          label={section.label}
                          icon={section.icon}
                          active={section.id === activeSectionId}
                          collapsed={collapsed}
                          indicatorId="app-sidebar-section"
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="border-separator flex flex-col gap-0.5 border-t p-2">
          <ul className="flex flex-col gap-0.5">
            {account ? (
              <li>
                <CollapsedTooltip collapsed={collapsed} label={account.name}>
                  <Link
                    href="/settings?tab=account"
                    aria-label={`Account: ${account.name}`}
                    className={cn(rowBase, focusRing, "text-label hover:bg-fill-4")}
                  >
                    {account.imageUrl ? (
                      // Clerk avatar URL; next/image would need its host allow-listed.
                      <img
                        src={account.imageUrl}
                        alt=""
                        className="size-6 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <UserIcon aria-hidden className="size-4 shrink-0" />
                    )}
                    <span className="sidebar-collapsed:sr-only min-w-0 flex-1 truncate">
                      {account.name}
                    </span>
                  </Link>
                </CollapsedTooltip>
              </li>
            ) : signIn ? (
              <li className="sidebar-collapsed:justify-center flex">{signIn}</li>
            ) : null}
            {settingsApp && (
              <SidebarLink
                href={settingsApp.href}
                label={settingsApp.label}
                icon={settingsApp.icon}
                active={current?.id === settingsApp.id}
                collapsed={collapsed}
                indicatorId="app-sidebar-footer"
              />
            )}
          </ul>
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
      </div>
    </nav>
  );
}
