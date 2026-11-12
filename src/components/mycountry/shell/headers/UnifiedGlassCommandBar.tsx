"use client";

import React, { useEffect, useRef, useState } from "react";
import { KeyCommand as Command, NavArrowDown } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { tabForSection, visibleTabs, type MyCountryTab } from "../mycountry-tabs";
import { DOMAIN_META } from "../domain-meta";
import { EditMorphButton } from "./EditMorphButton";

interface UnifiedGlassCommandBarProps {
  /** The section on screen. */
  section: string;
  onNavigate?: (section: MyCountryTab) => void;
  onDeclare?: () => void;
  /**
   * The command face's `<h1>`: while it is in view, the actions live on the document ribbon and
   * this bar occupies zero height; once it scrolls away, the compact Chrome bar glides in. Leave
   * out to show the compact bar on its own.
   */
  collapseOn?: HTMLElement | null;
}

/**
 * Edit + Declare Directive controls shared between the document ribbon (unscrolled) and the
 * compact sticky Chrome bar (once the command face scrolls out of view).
 */
export function CommandActions({
  section,
  onDeclare,
  size = "sm",
}: {
  section: string;
  onDeclare?: () => void;
  size?: "default" | "sm";
}) {
  const domain = Object.values(DOMAIN_META).find((meta) => meta.section === section);
  const isDirectives = section === "executive";

  return (
    <>
      <EditMorphButton size={size} />
      <Button
        type="button"
        size={size}
        aria-pressed={isDirectives}
        onClick={onDeclare}
        title={
          domain
            ? `Start a Directive with a suggested ${domain.title.toLowerCase()} goal`
            : undefined
        }
        className={cn(isDirectives && "ring-offset-surface ring-tint/40 ring-2 ring-offset-2")}
      >
        <Command aria-hidden="true" />
        <span>Declare Directive</span>
      </Button>
    </>
  );
}

/**
 * The ribbon's sections as a title menu, for when the ribbon has scrolled away with the face: the
 * compact bar names the section you are in and switches to another without scrolling back up.
 */
function SectionMenu({
  section,
  onNavigate,
}: {
  section: string;
  onNavigate?: (section: MyCountryTab) => void;
}) {
  const tabs = visibleTabs(useHasMycountryPremium("defense"));
  const active = tabForSection(section);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]!;
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-label"
          aria-label={`Section: ${current.label}`}
        >
          <Icon aria-hidden />
          {current.label}
          <NavArrowDown aria-hidden className="text-label-secondary" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={active}
          onValueChange={(value) => {
            const tab = tabs.find((t) => t.id === value);
            if (tab) onNavigate?.(tab.id);
          }}
        >
          {tabs.map((tab) => (
            <DropdownMenuRadioItem key={tab.id} value={tab.id}>
              {tab.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useScrolledPast(
  barRef: React.RefObject<HTMLElement | null>,
  target: HTMLElement | null | undefined
): boolean {
  const [observed, setObserved] = useState<{ target: HTMLElement; past: boolean } | null>(null);

  useEffect(() => {
    if (!target || typeof IntersectionObserver === "undefined") return;
    const bar = barRef.current;
    const stickyTop = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
    const covered = Math.round(stickyTop + 56);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const rootTop = entry.rootBounds?.top ?? covered;
        const past = !entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop + 1;
        setObserved({ target, past });
      },
      { rootMargin: `-${covered}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [barRef, target]);

  return Boolean(target && observed?.target === target && observed.past);
}

/**
 * Sticky compact Chrome bar for MyCountry: stays zero-height and out of the way while the command
 * document is on screen (its ribbon holds Edit and Declare Directive), then fades in around Halo
 * once the nation's heading scrolls above the top edge.
 */
export function UnifiedGlassCommandBar({
  section,
  onNavigate,
  onDeclare,
  collapseOn,
}: UnifiedGlassCommandBarProps) {
  const { country } = useCountryData();
  const name = country?.name?.replace(/_/g, " ") ?? "MyCountry";
  const barRef = useRef<HTMLDivElement>(null);
  const scrolledPast = useScrolledPast(barRef, collapseOn);
  const visible = collapseOn === undefined ? true : scrolledPast;

  return (
    <div
      ref={barRef}
      data-slot="command-chrome-bar"
      data-collapsed={visible ? "" : undefined}
      className={cn(
        "z-sticky sticky top-(--shell-header-top)",
        collapseOn !== undefined && "pointer-events-none h-0 overflow-visible"
      )}
    >
      {visible && (
        <div className="facet-chrome shadow-floating rounded-card pointer-events-auto flex min-h-14 flex-wrap items-center gap-2 px-3 py-1.5">
          <span aria-hidden className="text-headline text-label min-w-0 flex-1 truncate px-1">
            {name}
          </span>
          <div aria-hidden className="hidden h-10 w-(--shell-halo-reserve) shrink lg:block" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end-safe gap-2">
            <SectionMenu section={section} onNavigate={onNavigate} />
            <CommandActions section={section} onDeclare={onDeclare} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
