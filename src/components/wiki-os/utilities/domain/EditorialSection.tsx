"use client";

import { EditPencil, ViewGrid, GitCommit, Download, PageSearch } from "iconoir-react";

import { UtilityToolGroup, type UtilityTool } from "./UtilityToolCard";

const TOOLS: UtilityTool[] = [
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
      "Download an article as Markdown with YAML frontmatter or as JSON. Opens the Main Page; change ?slug= for another article.",
    legacyAlias: "Special:Export",
    icon: Download,
    // The hub has no current article, so like the editor card it opens the Main Page (WK-15).
    href: "/api/wiki/export?slug=Main_Page&format=json",
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

export function EditorialSection({ searchFilter }: { searchFilter: string }) {
  return (
    <UtilityToolGroup
      icon={<EditPencil className="text-indigo h-4 w-4" />}
      heading="Editorial & Tooling"
      tools={TOOLS}
      searchFilter={searchFilter}
      gridClass="sm:grid-cols-2 lg:grid-cols-3"
    />
  );
}
