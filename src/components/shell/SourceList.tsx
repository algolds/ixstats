"use client";
/**
 * The app navigation tree: every app as a row, the current app (and any the user opened) showing
 * its sections, live badges on rows. Inside Admin and Settings it becomes that area's grouped
 * list with a way back. Presentational: hosts (AppSidebar, the TabBar More sheet, the rail
 * popover) pass state, badges and callbacks.
 */
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { springSmooth } from "~/lib/design/motion";
import { countLabel } from "~/lib/thinkpages-forum/unread";
import { StreakPill } from "~/components/vault/StreakPill";
import {
  getActiveSectionId,
  getVisibleAppForPath,
  groupSections,
  type AppDefinition,
  type NavAction,
  type NavBadge,
  type NavBadgeKey,
  type NavBadges,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";

/**
 * Every row's icon sits in one 28px slot, so labels line up; the slot of the current app, section or page is
 * pressed in (`facet-recess`), so where you are reads from the icons alone.
 */
function NavMark({
  current = false,
  tint,
  children,
}: {
  current?: boolean;
  /** The app tint the mark wears (an app row); a section row inherits its app's. */
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-app={tint}
      data-current={current || undefined}
      className={cn(
        "text-tint rounded-control-sm relative grid size-7 shrink-0 place-items-center",
        current && "facet-recess"
      )}
    >
      {children}
    </span>
  );
}

export const sourceRowClassName =
  "relative flex min-h-9 w-full items-center gap-3 rounded-control px-2 text-body transition-colors duration-fast ease-out-facet pointer-coarse:min-h-11";

interface SourceListProps {
  pathname: string;
  searchParams: SearchParamsLike | null;
  apps: readonly AppDefinition[];
  expanded: ReadonlySet<string>;
  onToggle: (id: string) => void;
  badges: NavBadges;
  onAction?: (action: NavAction) => void;
  /** Called after a link is followed, so a sheet or popover host can close. */
  onNavigate?: () => void;
  variant?: "sidebar" | "sheet" | "popover";
  /** The single app whose sections a popover lists. */
  app?: AppDefinition;
}

type Ctx = Pick<SourceListProps, "badges" | "onAction" | "onNavigate" | "expanded" | "onToggle"> & {
  /** Section ids repeat across apps, so a current section only counts inside its own app. */
  activeAppId: string | undefined;
  activeSectionId: string | undefined;
  indicatorId: string;
};

type Section = AppDefinition["sections"][number];

/** Footer apps (Admin, Settings) sit below the app list and open as an area of their own. */
const isAreaApp = (app: AppDefinition) => app.placement === "footer";

/** A badge that wants attention (an action to take, or a non-zero count). */
export const isPending = (badge: NavBadge | undefined) =>
  badge?.kind === "action" || (badge?.kind === "count" && badge.value > 0);

/** Action and conditional rows exist only while their badge does. */
export const isListed = (s: Section, badges: NavBadges) =>
  (!s.action && !s.conditional) || Boolean(s.badge && badges[s.badge]);

/** The forum's counts are capped by the server and shown as "99+"; every other badge shows its exact count. */
const CAPPED_BADGES: ReadonlySet<NavBadgeKey> = new Set([
  "forum-watched-unread",
  "forum-realm-board",
]);

function Trailing({ badge, badgeKey }: { badge: NavBadge | undefined; badgeKey?: NavBadgeKey }) {
  if (!badge) return null;
  if (badge.kind === "count") {
    return badge.value > 0 ? (
      <span className="bg-tint-fill text-tint-ink text-caption rounded-full px-2 font-medium tabular-nums">
        {badgeKey && CAPPED_BADGES.has(badgeKey) ? countLabel(badge.value) : badge.value}
      </span>
    ) : null;
  }
  // Only the `action` kind is left (the union is count | action): the streak pill, else the label as text.
  if (badge.streak) return <StreakPill streak={badge.streak} />;
  return <span className="text-footnote text-label-secondary tabular-nums">{badge.label}</span>;
}

function ActionRow({ section, action, ctx }: { section: Section; action: NavAction; ctx: Ctx }) {
  const Icon = section.icon;
  const badge = section.badge ? ctx.badges[section.badge] : undefined;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          ctx.onAction?.(action);
          ctx.onNavigate?.();
        }}
        className={cn(
          sourceRowClassName,
          focusRing,
          "text-tint-ink hover:bg-tint-fill font-medium"
        )}
      >
        <NavMark>
          <Icon aria-hidden className="size-4" />
        </NavMark>
        <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
        <Trailing badge={badge} badgeKey={section.badge} />
      </button>
    </li>
  );
}

function SectionRow({ section, ctx }: { section: Section; ctx: Ctx }) {
  const Icon = section.icon;
  const badge = section.badge ? ctx.badges[section.badge] : undefined;
  const active = section.id === ctx.activeSectionId;
  // An external invite leaves the app, so it is a plain anchor in a new tab, never the current row.
  const RowLink = section.external ? "a" : Link;
  const externalProps = section.external
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {};
  return (
    <li>
      <RowLink
        href={section.href}
        {...externalProps}
        aria-current={active ? "page" : undefined}
        onClick={ctx.onNavigate}
        className={cn(
          sourceRowClassName,
          focusRing,
          active ? "text-tint font-medium" : "text-label hover:bg-fill-4"
        )}
      >
        {active && (
          <motion.span
            aria-hidden
            layoutId={ctx.indicatorId}
            transition={springSmooth}
            className="bg-tint-fill rounded-control absolute inset-0"
          />
        )}
        <NavMark current={active}>
          <Icon aria-hidden className="size-4" />
        </NavMark>
        <span className="relative min-w-0 flex-1 truncate">{section.label}</span>
        <span className="relative">
          <Trailing badge={badge} badgeKey={section.badge} />
        </span>
      </RowLink>
    </li>
  );
}

function GroupHeading({
  id,
  group,
  collapsible,
  open,
  listId,
  onToggle,
}: {
  /** Names the surrounding group, so its label is the heading itself rather than a copy of it. */
  id: string;
  group: string;
  collapsible: boolean;
  open: boolean;
  listId: string;
  onToggle: () => void;
}) {
  if (!collapsible)
    return (
      <h3 id={id} className="text-caption text-label-secondary px-2 pt-3 pb-1">
        {group}
      </h3>
    );
  return (
    <button
      id={id}
      type="button"
      aria-expanded={open}
      aria-controls={listId}
      onClick={onToggle}
      className={cn(
        focusRing,
        "text-footnote text-label-secondary hover:bg-fill-4 rounded-control flex w-full items-center gap-2 px-2 pt-3 pb-1 font-medium"
      )}
    >
      <NavArrowRight
        aria-hidden
        className={cn("duration-fast size-3.5 transition-transform", open && "rotate-90")}
      />
      {group}
    </button>
  );
}

function SectionRows({
  app,
  ctx,
  collapsibleGroups,
  id,
  hidden = false,
  flat = false,
}: {
  app: AppDefinition;
  ctx: Ctx;
  collapsibleGroups: boolean;
  id?: string;
  /** Rows sit level with the app rows instead of indented under one (`inline` apps). */
  flat?: boolean;
  /** Collapsed but still mounted, so the toggle's `aria-controls` always resolves. */
  hidden?: boolean;
}) {
  const visible = app.sections.filter((s) => isListed(s, ctx.badges));
  const rowCtx = app.id === ctx.activeAppId ? ctx : { ...ctx, activeSectionId: undefined };
  return (
    <div
      id={id}
      hidden={hidden}
      className={cn("flex flex-col", !collapsibleGroups && !flat && "pl-4")}
      data-app={app.tint}
    >
      {groupSections(visible).map(({ group, sections }, index) => {
        const groupKey = `${app.id}:${group}`;
        const containsActive = sections.some((s) => s.id === rowCtx.activeSectionId);
        const open = !collapsibleGroups || !group || containsActive || ctx.expanded.has(groupKey);
        const listId = `source-list-${ctx.indicatorId}-${groupKey}`.replace(/[^a-zA-Z0-9-]+/g, "-");
        const headingId = `${listId}-heading`;
        return (
          <div
            key={group ?? `ungrouped-${index}`}
            role={group ? "group" : undefined}
            aria-labelledby={group ? headingId : undefined}
          >
            {group && (
              <GroupHeading
                id={headingId}
                group={group}
                // The group holding the current page stays open, so toggling it would do nothing.
                collapsible={collapsibleGroups && !containsActive}
                open={open}
                listId={listId}
                onToggle={() => ctx.onToggle(groupKey)}
              />
            )}
            <ul id={listId} hidden={!open} className="flex flex-col gap-0.5">
              {sections.map((section) =>
                section.action ? (
                  <ActionRow key={section.id} section={section} action={section.action} ctx={ctx} />
                ) : (
                  <SectionRow key={section.id} section={section} ctx={rowCtx} />
                )
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function AppRow({ app, isCurrent, ctx }: { app: AppDefinition; isCurrent: boolean; ctx: Ctx }) {
  const hasSections = app.sections.length > 0;
  const open = hasSections && (isCurrent || ctx.expanded.has(app.id));
  const listId = `source-list-${ctx.indicatorId}-${app.id}`;
  const appBadge = app.badge ? ctx.badges[app.badge] : undefined;
  const pendingInside = app.sections.some((s) => s.badge && isPending(ctx.badges[s.badge]));
  const Icon = app.icon;
  return (
    <li>
      <div className="flex items-center gap-0.5">
        <Link
          href={app.href}
          aria-current={isCurrent && !hasSections ? "page" : undefined}
          onClick={ctx.onNavigate}
          className={cn(
            sourceRowClassName,
            focusRing,
            "flex-1",
            isCurrent ? "text-label font-semibold" : "text-label hover:bg-fill-4"
          )}
        >
          <NavMark current={isCurrent} tint={app.tint}>
            <Icon aria-hidden className="size-5" />
          </NavMark>
          <span className="min-w-0 flex-1 truncate">{app.label}</span>
          <Trailing badge={appBadge} badgeKey={app.badge} />
          {!open && pendingInside && (
            <span
              role="img"
              aria-label="Has updates"
              className="bg-tint size-2 shrink-0 rounded-full"
            />
          )}
        </Link>
        {hasSections && !isCurrent && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`${open ? "Collapse" : "Expand"} ${app.label}`}
            onClick={() => ctx.onToggle(app.id)}
            className={cn(
              focusRing,
              "rounded-control text-label-secondary hover:bg-fill-4 grid size-9 shrink-0 place-items-center pointer-coarse:size-11"
            )}
          >
            <NavArrowRight
              aria-hidden
              className={cn("duration-fast size-4 transition-transform", open && "rotate-90")}
            />
          </button>
        )}
      </div>
      {hasSections && (
        <SectionRows id={listId} hidden={!open} app={app} ctx={ctx} collapsibleGroups={false} />
      )}
    </li>
  );
}

/** Area apps (Settings, Admin) at the foot; inside one the list switches to its sections, so none is ever current. */
function FooterLinks({
  apps,
  onNavigate,
}: {
  apps: readonly AppDefinition[];
  onNavigate?: () => void;
}) {
  if (apps.length === 0) return null;
  return (
    <ul className="border-separator mt-2 flex flex-col gap-0.5 border-t pt-2">
      {apps.map((a) => {
        const Icon = a.icon;
        return (
          <li key={a.id}>
            <Link
              href={a.href}
              onClick={onNavigate}
              className={cn(sourceRowClassName, focusRing, "text-label hover:bg-fill-4")}
            >
              <NavMark tint={a.tint}>
                <Icon aria-hidden className="size-5" />
              </NavMark>
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The current app and section. When the path belongs to an app the user has hidden (the changelog
 * with Help turned off), fall back to a visible section row with the same href so the list still
 * shows where they are; with none, nothing is highlighted.
 */
function resolveCurrent(
  pathname: string,
  searchParams: SearchParamsLike | null,
  apps: readonly AppDefinition[],
  badges: NavBadges
): { current: AppDefinition | undefined; activeSectionId: string | undefined } {
  const owner = getVisibleAppForPath(pathname, apps);
  if (!owner || apps.some((a) => a.id === owner.id)) {
    return {
      current: owner,
      activeSectionId: owner ? getActiveSectionId(owner, pathname, searchParams) : undefined,
    };
  }
  const path = pathname.split(/[?#]/)[0];
  for (const app of apps) {
    const row = app.sections.find(
      (s) => !s.action && s.href === path && (!s.conditional || (s.badge && badges[s.badge]))
    );
    if (row) return { current: app, activeSectionId: row.id };
  }
  return { current: undefined, activeSectionId: undefined };
}

export function SourceList({
  pathname,
  searchParams,
  apps,
  expanded,
  onToggle,
  badges,
  onAction,
  onNavigate,
  variant = "sidebar",
  app,
}: SourceListProps) {
  const { current, activeSectionId } = resolveCurrent(pathname, searchParams, apps, badges);
  const ctx: Ctx = {
    badges,
    onAction,
    onNavigate,
    expanded,
    onToggle,
    activeAppId: current?.id,
    activeSectionId,
    // One pill per list: a shared layoutId would make it glide between the rail's separate popovers.
    indicatorId: `source-list-${variant}${app ? `-${app.id}` : ""}`,
  };

  if (variant === "popover" && app) {
    return (
      <nav aria-label={app.label} data-slot="source-list" data-mode="popover">
        <SectionRows app={app} ctx={ctx} collapsibleGroups={false} />
      </nav>
    );
  }

  if (current && isAreaApp(current)) {
    return (
      <nav aria-label="App navigation" data-slot="source-list" data-mode="area">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={cn(sourceRowClassName, focusRing, "text-label-secondary hover:bg-fill-4")}
        >
          <NavArrowLeft aria-hidden className="size-4 shrink-0" />
          All apps
        </Link>
        <h2 className="text-headline text-label px-2 pt-3 pb-1">{current.label}</h2>
        <SectionRows app={current} ctx={ctx} collapsibleGroups />
      </nav>
    );
  }

  return (
    <nav aria-label="App navigation" data-slot="source-list" data-mode="main">
      <ul className="flex flex-col gap-0.5">
        {apps
          .filter((a) => !isAreaApp(a))
          .map((a) =>
            a.inline ? (
              <li key={a.id}>
                <SectionRows app={a} ctx={ctx} collapsibleGroups={false} flat />
              </li>
            ) : (
              <AppRow key={a.id} app={a} isCurrent={a.id === current?.id} ctx={ctx} />
            )
          )}
      </ul>
      <FooterLinks apps={apps.filter(isAreaApp)} onNavigate={onNavigate} />
    </nav>
  );
}
