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
import {
  getActiveSectionId,
  getAppForPath,
  groupSections,
  type AppDefinition,
  type NavAction,
  type NavBadge,
  type NavBadges,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";

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

function Trailing({ badge }: { badge: NavBadge | undefined }) {
  if (!badge || badge.kind === "icon") return null;
  if (badge.kind === "count") {
    return badge.value > 0 ? (
      <span className="bg-tint-fill text-tint-ink text-caption rounded-full px-2 font-medium tabular-nums">
        {badge.value}
      </span>
    ) : null;
  }
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
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
        <Trailing badge={badge} />
      </button>
    </li>
  );
}

function SectionRow({ section, ctx }: { section: Section; ctx: Ctx }) {
  const Icon = section.icon;
  const badge = section.badge ? ctx.badges[section.badge] : undefined;
  const active = section.id === ctx.activeSectionId;
  return (
    <li>
      <Link
        href={section.href}
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
        <Icon aria-hidden className="relative size-4 shrink-0" />
        <span className="relative min-w-0 flex-1 truncate">{section.label}</span>
        <span className="relative">
          <Trailing badge={badge} />
        </span>
      </Link>
    </li>
  );
}

function GroupHeading({
  group,
  collapsible,
  open,
  listId,
  onToggle,
}: {
  group: string;
  collapsible: boolean;
  open: boolean;
  listId: string;
  onToggle: () => void;
}) {
  if (!collapsible)
    return <h3 className="text-caption text-label-secondary px-2 pt-3 pb-1">{group}</h3>;
  return (
    <button
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
}: {
  app: AppDefinition;
  ctx: Ctx;
  collapsibleGroups: boolean;
  id?: string;
}) {
  const visible = app.sections.filter((s) => !s.action || (s.badge && ctx.badges[s.badge]));
  const rowCtx = app.id === ctx.activeAppId ? ctx : { ...ctx, activeSectionId: undefined };
  return (
    <div id={id} className={cn("flex flex-col", !collapsibleGroups && "pl-4")} data-app={app.tint}>
      {groupSections(visible).map(({ group, sections }, index) => {
        const groupKey = `${app.id}:${group}`;
        const containsActive = sections.some((s) => s.id === rowCtx.activeSectionId);
        const open = !collapsibleGroups || !group || containsActive || ctx.expanded.has(groupKey);
        const listId = `source-list-${ctx.indicatorId}-${groupKey}`.replace(/[^a-zA-Z0-9-]+/g, "-");
        return (
          <div
            key={group ?? `ungrouped-${index}`}
            role={group ? "group" : undefined}
            aria-label={group}
          >
            {group && (
              <GroupHeading
                group={group}
                // The group holding the current page stays open, so toggling it would do nothing.
                collapsible={collapsibleGroups && !containsActive}
                open={open}
                listId={listId}
                onToggle={() => ctx.onToggle(groupKey)}
              />
            )}
            {open && (
              <ul id={listId} className="flex flex-col gap-0.5">
                {sections.map((section) =>
                  section.action ? (
                    <ActionRow
                      key={section.id}
                      section={section}
                      action={section.action}
                      ctx={ctx}
                    />
                  ) : (
                    <SectionRow key={section.id} section={section} ctx={rowCtx} />
                  )
                )}
              </ul>
            )}
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
          <span data-app={app.tint} className="text-tint inline-flex shrink-0">
            {appBadge?.kind === "icon" ? (
              <img src={appBadge.src} alt="" className="size-5 rounded-sm object-cover" />
            ) : (
              <Icon aria-hidden className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{app.label}</span>
          <Trailing badge={appBadge} />
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
      {open && <SectionRows id={listId} app={app} ctx={ctx} collapsibleGroups={false} />}
    </li>
  );
}

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
              <Icon aria-hidden className="text-label-secondary size-5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
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
  const current = getAppForPath(pathname);
  const activeSectionId = current ? getActiveSectionId(current, pathname, searchParams) : undefined;
  const ctx: Ctx = {
    badges,
    onAction,
    onNavigate,
    expanded,
    onToggle,
    activeAppId: current?.id,
    activeSectionId,
    indicatorId: `source-list-${variant}`,
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
          .map((a) => (
            <AppRow key={a.id} app={a} isCurrent={a.id === current?.id} ctx={ctx} />
          ))}
      </ul>
      <FooterLinks apps={apps.filter(isAreaApp)} onNavigate={onNavigate} />
    </nav>
  );
}
