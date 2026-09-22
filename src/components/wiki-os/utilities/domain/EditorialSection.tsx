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
      color: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
    },
    {
      id: "diff-suite",
      title: "Visual Diff Comparator & Revision Revert",
      description: "Scrubbable timeline, side-by-side color diffs, and 1-click rollback engine.",
      legacyAlias: "Special:Diff",
      icon: GitCommit,
      href: "/util/diff",
      badge: "Scrubbable",
      color: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    },
    {
      id: "editor",
      title: "PlateJS WYSIWYG & Wikitext Dual Editor",
      description: "Rich editorial canvas with real-time Parsoid bi-directional transpilation.",
      legacyAlias: "Special:EditPage",
      icon: EditPencil,
      href: "/wiki/Main_Page?action=edit",
      badge: "WYSIWYG",
      color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
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
      color: "border-amber-500/20 bg-amber-500/10 text-amber-400",
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
      color: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
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
        <EditPencil className="h-4 w-4 text-indigo-400" />
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
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
              className="group border-border/40 bg-card/60 hover:border-wiki/40 hover:bg-card/90 relative flex flex-col justify-between rounded-xl border p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-br ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-border/40 bg-secondary/50 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-medium">
                    {tool.badge}
                  </span>
                </div>

                <h4 className="text-foreground group-hover:text-wiki text-sm font-semibold">
                  {tool.title}
                </h4>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {tool.description}
                </p>
              </div>

              <div className="border-border/30 text-muted-foreground mt-4 flex items-center justify-between border-t pt-3 text-[11px]">
                <span className="font-mono text-[10px] opacity-70">{tool.legacyAlias}</span>
                <ArrowRight className="text-muted-foreground group-hover:text-wiki h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
