"use client";

import React from "react";
import { EditPencil, ViewGrid, GitCommit, Download, PageSearch } from "iconoir-react";

import { UtilityToolCard } from "./UtilityToolCard";

interface EditorialSectionProps {
  searchFilter: string;
}

export function EditorialSection({ searchFilter }: EditorialSectionProps) {
  const query = searchFilter.toLowerCase().trim();

  const tools = [
    {
      id: "templates",
      title: "Template palette & custom infobox designer",
      description:
        "Interactive palette with canonical schemas, on-the-fly fields, and custom infobox builder.",
      legacyAlias: "Special:Templates",
      icon: ViewGrid,
      href: "/util/templates",
      badge: "Builder suite",
      color: "border-indigo/20 bg-indigo/10 text-indigo",
    },
    {
      id: "diff-suite",
      title: "Visual diff comparator & revision revert",
      description: "Scrubbable timeline, side-by-side color diffs, and 1-click rollback engine.",
      legacyAlias: "Special:Diff",
      icon: GitCommit,
      href: "/util/diff",
      badge: "Scrubbable",
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "editor",
      title: "PlateJS WYSIWYG & wikitext dual editor",
      description: "Edit visually or as wikitext; changes sync both ways through Parsoid.",
      legacyAlias: "Special:EditPage",
      icon: EditPencil,
      href: "/wiki/Main_Page?action=edit",
      badge: "WYSIWYG",
      color: "border-green/20 bg-green/10 text-green",
    },
    {
      id: "export",
      title: "Portable MDX & JSON snapshot exporter",
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
        {filtered.map((tool) => (
          <UtilityToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
