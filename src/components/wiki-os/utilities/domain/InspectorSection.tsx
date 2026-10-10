"use client";

import { useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle, NavArrowRight, Refresh, Xmark as X } from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { Button } from "~/components/ui/button";
import { matchesToolQuery } from "./UtilityToolCard";

export interface InspectorTool {
  id: string;
  title: string;
  description: string;
  legacyAlias: string;
  icon: ComponentType<{ className?: string }>;
  badge: ReactNode;
  color: string;
}

interface InspectorSectionProps {
  searchFilter: string;
  heading: string;
  headingIcon: ReactNode;
  ariaLabel: string;
  tools: InspectorTool[];
  /** Tailwind grid-columns classes for the selector cards. */
  gridClass: string;
  /** Governance-style cards: two-line description and an arrow footer. */
  roomy?: boolean;
  panelLabel: string;
  panelCaption: string;
  closeLabel: string;
  panelTitle: (activeId: string) => string;
  renderPanel: (activeId: string) => ReactNode;
}

/** Headed row of selectable cards that open one collapsible inspector panel below them. */
export function InspectorSection({
  searchFilter,
  heading,
  headingIcon,
  ariaLabel,
  tools,
  gridClass,
  roomy,
  panelLabel,
  panelCaption,
  closeLabel,
  panelTitle,
  renderPanel,
}: InspectorSectionProps) {
  const [active, setActive] = useState<string | null>(null);

  const filtered = tools.filter((t) => matchesToolQuery(t, searchFilter));
  if (filtered.length === 0) return null;

  // Pressing the open card again closes its panel.
  const toggleOff = (id: string) => (e: MouseEvent) => {
    if (active === id) {
      e.preventDefault();
      setActive(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        {headingIcon}
        <h3 className="text-label-secondary text-subhead">
          {heading} ({filtered.length})
        </h3>
      </div>

      <RadioCardGroup
        aria-label={ariaLabel}
        value={active}
        onValueChange={setActive}
        className={`grid grid-cols-1 gap-3 ${gridClass}`}
      >
        {filtered.map((tool) => {
          const Icon = tool.icon;
          return (
            <RadioCard
              key={tool.id}
              value={tool.id}
              indicator={false}
              onClick={toggleOff(tool.id)}
              className="group flex-col items-stretch justify-between gap-0 p-4"
            >
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`rounded-control flex h-8 w-8 items-center justify-center border ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-separator bg-fill-3 text-label text-caption rounded-full border px-2 py-0.5">
                    {tool.badge}
                  </span>
                </div>
                <h4 className="text-label group-hover:text-tint text-caption font-semibold">
                  {tool.title}
                </h4>
                <p
                  className={`text-label-secondary text-footnote mt-1 ${roomy ? "line-clamp-2" : "line-clamp-1"}`}
                >
                  {tool.description}
                </p>
              </div>

              {roomy ? (
                <div className="border-separator text-label-secondary text-footnote mt-3 flex items-center justify-between border-t pt-2">
                  <span className="tabular-nums opacity-60">{tool.legacyAlias}</span>
                  <NavArrowRight className="h-3 w-3 opacity-60" />
                </div>
              ) : (
                <div className="text-label-secondary text-footnote mt-2 tabular-nums opacity-60">
                  {tool.legacyAlias}
                </div>
              )}
            </RadioCard>
          );
        })}
      </RadioCardGroup>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: "auto", scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            className="border-separator bg-surface rounded-row shadow-card overflow-hidden border"
          >
            <div className="border-separator bg-fill-4 flex items-center justify-between border-b px-4 py-3">
              <span className="text-label text-caption">
                {panelLabel}: <span className="text-tint font-semibold">{panelTitle(active)}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-label-secondary text-footnote">{panelCaption}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={closeLabel}
                  onClick={() => setActive(null)}
                  title={closeLabel}
                  className="text-label-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="divide-separator max-h-72 divide-y overflow-y-auto p-2">
              {renderPanel(active)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InspectorLoading({ children }: { children: ReactNode }) {
  return (
    <div className="text-label-secondary text-footnote flex items-center justify-center p-8">
      <Refresh className="mr-2 h-4 w-4 animate-spin" /> {children}
    </div>
  );
}

/** "Nothing to report" state; `ok` adds the green check treatment. */
export function InspectorEmpty({ ok = true, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <div
      className={`text-footnote flex flex-col items-center justify-center p-6 text-center ${ok ? "text-green" : "text-label-secondary"}`}
    >
      {ok && <CheckCircle className="mb-1 h-5 w-5" />}
      <span>{children}</span>
    </div>
  );
}

export function InspectorList({ children }: { children: ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

export function InspectorRow({ children }: { children: ReactNode }) {
  return (
    <div className="hover:bg-fill-4 rounded-control text-footnote flex items-center justify-between px-3 py-2 transition-colors">
      {children}
    </div>
  );
}

export function InspectorPageLink({ slug, title }: { slug?: string; title: string }) {
  return (
    <Link
      href={`/wiki/${encodeURIComponent(slug || title)}`}
      data-cuelume-press="page"
      data-cuelume-hover="tick"
      className="text-label hover:text-tint font-medium hover:underline"
    >
      {title}
    </Link>
  );
}
