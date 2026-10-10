"use client";

import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "iconoir-react";

export interface UtilityTool {
  id: string;
  title: string;
  description: string;
  legacyAlias: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  badge: string;
  color: string;
  isExternal?: boolean;
}

/** Link tile for a WikiOS utility: icon, badge, description and the MediaWiki special page it replaces. */
export function UtilityToolCard({ tool }: { tool: UtilityTool }) {
  const Icon = tool.icon;

  return (
    <Link
      href={tool.href}
      target={tool.isExternal ? "_blank" : undefined}
      rel={tool.isExternal ? "noreferrer" : undefined}
      data-cuelume-press="press"
      data-cuelume-hover="tick"
      className="group border-separator bg-surface hover:border-tint/40 hover:bg-surface rounded-row hover:shadow-floating relative flex flex-col justify-between border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div
            className={`rounded-control flex h-9 w-9 items-center justify-center border ${tool.color}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="border-separator bg-fill-3 text-label-secondary text-caption rounded-full border px-2 py-0.5">
            {tool.badge}
          </span>
        </div>

        <h4 className="text-label group-hover:text-tint text-headline">{tool.title}</h4>
        <p className="text-label-secondary text-footnote mt-1 line-clamp-2">{tool.description}</p>
      </div>

      <div className="border-separator text-label-secondary text-footnote mt-4 flex items-center justify-between border-t pt-3">
        <span className="text-footnote tabular-nums opacity-70">{tool.legacyAlias}</span>
        <ArrowRight className="text-label-secondary group-hover:text-tint h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/** Case-insensitive match on a tool's title, description or legacy MediaWiki alias. */
export const matchesToolQuery = (
  tool: { title: string; description: string; legacyAlias: string },
  searchFilter: string
) => {
  const query = searchFilter.toLowerCase().trim();
  return (
    !query ||
    tool.title.toLowerCase().includes(query) ||
    tool.description.toLowerCase().includes(query) ||
    tool.legacyAlias.toLowerCase().includes(query)
  );
};

/** A headed grid of UtilityToolCards, filtered by the deck's search box. */
export function UtilityToolGroup({
  icon,
  heading,
  tools,
  searchFilter,
  gridClass,
}: {
  icon: ReactNode;
  heading: string;
  tools: UtilityTool[];
  searchFilter: string;
  gridClass: string;
}) {
  const filtered = tools.filter((t) => matchesToolQuery(t, searchFilter));
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <h3 className="text-label-secondary text-subhead">
          {heading} ({filtered.length})
        </h3>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${gridClass}`}>
        {filtered.map((tool) => (
          <UtilityToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
