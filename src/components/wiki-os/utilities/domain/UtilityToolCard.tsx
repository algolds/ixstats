"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";

interface UtilityTool {
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
      href={withBasePath(tool.href)}
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
