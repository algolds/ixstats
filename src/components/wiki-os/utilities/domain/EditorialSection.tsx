"use client";

import React from "react";
import Link from "next/link";
import {
  EditPencil,
  ViewGrid,
  GitCommit,
  Download,
  PageSearch,
  ArrowRight,
} from "iconoir-react";

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
      description: "Interactive palette with canonical schemas, on-the-fly fields, and custom infobox builder.",
      legacyAlias: "Special:Templates",
      icon: ViewGrid,
      href: "/util/templates",
      badge: "Builder Suite",
      color: "from-purple-500/10 to-indigo-500/10 text-purple-400 border-purple-500/20",
    },
    {
      id: "diff-suite",
      title: "Visual Diff Comparator & Revision Revert",
      description: "Scrubbable timeline, side-by-side color diffs, and 1-click rollback engine.",
      legacyAlias: "Special:Diff",
      icon: GitCommit,
      href: "/util/diff",
      badge: "Scrubbable",
      color: "from-blue-500/10 to-cyan-500/10 text-blue-400 border-blue-500/20",
    },
    {
      id: "editor",
      title: "PlateJS WYSIWYG & Wikitext Dual Editor",
      description: "Rich editorial canvas with real-time Parsoid bi-directional transpilation.",
      legacyAlias: "Special:EditPage",
      icon: EditPencil,
      href: "/wiki/Main_Page?action=edit",
      badge: "WYSIWYG",
      color: "from-emerald-500/10 to-green-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "export",
      title: "Portable MDX & JSON Snapshot Exporter",
      description: "Download portable Markdown files with YAML frontmatter or structured JSON AST dumps.",
      legacyAlias: "Special:Export",
      icon: Download,
      href: "/api/wiki/export?format=json",
      isExternal: true,
      badge: "MDX / JSON",
      color: "from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "search",
      title: "Full-Text Spotlight Search Engine",
      description: "Ranked full-text search with title weighting, wikitext extracts, and BlurHash thumbnails.",
      legacyAlias: "Special:Search",
      icon: PageSearch,
      href: "/util/search",
      badge: "Ranked",
      color: "from-rose-500/10 to-pink-500/10 text-rose-400 border-rose-500/20",
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
        <EditPencil className="h-4 w-4 text-purple-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              className="group relative flex flex-col justify-between rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-wiki/40 hover:bg-card/90 hover:shadow-lg active:scale-[0.98]"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-br ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-border/40 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tool.badge}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-foreground group-hover:text-wiki">
                  {tool.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] opacity-70">{tool.legacyAlias}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-wiki" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
