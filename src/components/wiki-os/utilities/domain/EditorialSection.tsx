"use client";

import React from "react";
import Link from "next/link";
import { EditPencil, ViewGrid, GitCommit, Download, PageSearch, ArrowRight } from "iconoir-react";

import { withBasePath } from "~/lib/base-path";

interface EditorialSectionProps {
  searchFilter: string;
}

export function EditorialSection({ searchFilter }: EditorialSectionProps) {
  const query = searchFilter.toLowerCase().trim();

  const tools = [
    {
      id: "templates",
      title: "Template Palette & Custom Infobox Designer",
      description:
        "Interactive palette with canonical schemas, on-the-fly fields, and custom infobox builder.",
      legacyAlias: "Special:Templates",
      icon: ViewGrid,
      href: "/util/templates",
      badge: "Builder Suite",
      color: "border-indigo/20 bg-indigo/10 text-indigo",
    },
    {
      id: "diff-suite",
      title: "Visual Diff Comparator & Revision Revert",
      description: "Scrubbable timeline, side-by-side color diffs, and 1-click rollback engine.",
      legacyAlias: "Special:Diff",
      icon: GitCommit,
      href: "/util/diff",
      badge: "Scrubbable",
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "editor",
      title: "PlateJS WYSIWYG & Wikitext Dual Editor",
      description: "Rich editorial canvas with real-time Parsoid bi-directional transpilation.",
      legacyAlias: "Special:EditPage",
      icon: EditPencil,
      href: "/wiki/Main_Page?action=edit",
      badge: "WYSIWYG",
      color: "border-green/20 bg-green/10 text-green",
    },
    {
      id: "export",
      title: "Portable MDX & JSON Snapshot Exporter",
      description:
        "Download portable Markdown files with YAML frontmatter or structured JSON AST dumps.",
      legacyAlias: "Special:Export",
      icon: Download,
      href: "/api/wiki/export?format=json",
      isExternal: true,
      badge: "MDX / JSON",
      color: "border-yellow/20 bg-yellow/10 text-yellow",
    },
    {
      id: "search",
      title: "Full-Text Spotlight Search Engine",
      description:
        "Ranked full-text search with title weighting, wikitext extracts, and BlurHash thumbnails.",
      legacyAlias: "Special:Search",
      icon: PageSearch,
      href: "/util/search",
      badge: "Ranked",
      color: "border-teal/20 bg-teal/10 text-teal",
    },
  ];

  const filtered = tools.filter(
    (t) =>
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.legacyAlias.toLowerCase().includes(query)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <EditPencil className="text-indigo h-4 w-4" />
        <h3 className="text-label-secondary text-subhead">
          Editorial & Tooling ({filtered.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              href={withBasePath(tool.href)}
              target={(tool as any).isExternal ? "_blank" : undefined}
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
                <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="border-separator text-label-secondary text-footnote mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-footnote tabular-nums opacity-70">{tool.legacyAlias}</span>
                <ArrowRight className="text-label-secondary group-hover:text-tint h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
