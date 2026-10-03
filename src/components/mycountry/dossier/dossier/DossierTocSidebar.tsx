"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import {
  Search,
  OpenBook as BookOpen,
  Component as Layers,
  NavArrowRight as ChevronRight,
  NavArrowDown as ChevronDown,
  Page as FileText,
  Folder,
  Folder as FolderOpen,
  Globe,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import type { CountryInfobox } from "~/types/dossier";
import type { WikiSource } from "~/lib/wiki-os/config";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export interface TocItem {
  id: string;
  title: string;
  source: "wiki" | "native";
  pageTitle?: string;
  isPage?: boolean;
  classification?: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "ALLIANCE" | "PRIVATE";
  category?: string;
}

interface DossierTocSidebarProps {
  countryName: string;
  infobox: CountryInfobox | null;
  sections: TocItem[];
  nativeDocs?: TocItem[];
  activeSectionId?: string | null;
  onSelectSection: (sectionId: string) => void;
  flagColors: { primary: string; secondary: string; accent: string };
  wikiSource?: WikiSource;
}

const CATEGORY_KEYWORDS: Array<[category: string, keywords: string[]]> = [
  ["Geography & Demographics", ["geograph", "climat", "demograph", "populat", "land", "territor"]],
  [
    "Government & Politics",
    ["govern", "politi", "execut", "foreign", "diploma", "law", "constitut"],
  ],
  ["Economy & Infrastructure", ["econom", "trad", "financ", "currenc", "industr", "infrastruct"]],
  ["History & Culture", ["histor", "cultur", "religi", "languag", "ethni", "societ"]],
  ["Military & Defense", ["militar", "defens", "securit", "force", "navy", "army"]],
];

function categorizeTitle(title: string, source: "wiki" | "native"): string {
  if (source === "native") return "Native Canvas Lore";
  const lower = title.toLowerCase();
  const match = CATEGORY_KEYWORDS.find(([, keywords]) => keywords.some((k) => lower.includes(k)));
  return match?.[0] ?? "General Dossier Sections";
}

/** The WikiOS topic pages injected into the category folders: [id key, page title, label, category]. */
const WIKI_PAGES: Array<
  [key: string, page: (name: string) => string, label: (name: string) => string, category: string]
> = [
  ["main", (n) => n, (n) => `${n} (Main WikiOS Article)`, "General Dossier Sections"],
  ["geo", (n) => `Geography of ${n}`, (n) => `Geography of ${n}`, "Geography & Demographics"],
  [
    "demog",
    (n) => `Demographics of ${n}`,
    (n) => `Demographics of ${n}`,
    "Geography & Demographics",
  ],
  [
    "gov",
    (n) => `Government of ${n}`,
    (n) => `Government & Politics of ${n}`,
    "Government & Politics",
  ],
  ["econ", (n) => `Economy of ${n}`, (n) => `Economy of ${n}`, "Economy & Infrastructure"],
  ["hist", (n) => `History of ${n}`, (n) => `History of ${n}`, "History & Culture"],
  ["mil", (n) => `Military of ${n}`, (n) => `Military of ${n}`, "Military & Defense"],
];

const wikiPagesFor = (countryName: string): TocItem[] =>
  countryName
    ? WIKI_PAGES.map(([key, page, label, category]) => ({
        id: `page_${key}_${countryName}`,
        title: label(countryName),
        pageTitle: page(countryName),
        isPage: true,
        source: "wiki",
        category,
      }))
    : [];

function TocRow({
  item,
  isSelected,
  onClick,
}: {
  item: TocItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const ItemIcon = item.isPage ? Globe : item.source === "wiki" ? BookOpen : FileText;
  return (
    <button
      type="button"
      aria-current={isSelected ? "true" : undefined}
      onClick={onClick}
      className={`text-footnote rounded-control-sm flex w-full items-center justify-between px-2 py-1 text-left transition-[background-color,border-color,transform] duration-150 ${
        isSelected
          ? "bg-fill-3 text-label font-semibold"
          : item.isPage
            ? "text-label hover:bg-fill-3 font-medium"
            : "text-label-secondary hover:text-label hover:bg-fill-3"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ItemIcon className="text-label-secondary h-3 w-3 shrink-0" />
        <span className="text-caption truncate">{item.title}</span>
      </div>

      {item.isPage ? (
        <ExternalLink className="text-label-secondary h-3 w-3 shrink-0" />
      ) : (
        <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
      )}
    </button>
  );
}

function TocFolder({
  name,
  items,
  isOpen,
  activeSectionId,
  onToggle,
  onSelect,
}: {
  name: string;
  items: TocItem[];
  isOpen: boolean;
  activeSectionId: string | null | undefined;
  onToggle: () => void;
  onSelect: (item: TocItem) => void;
}) {
  const FolderIcon = isOpen ? FolderOpen : Folder;
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className="border-separator rounded-control border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="text-label h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
      >
        <div className="flex min-w-0 items-center gap-2">
          <FolderIcon className="text-label-secondary h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-label-secondary bg-fill-3 text-footnote rounded-control-sm px-2 py-0.5 tabular-nums">
            {items.length}
          </span>
          <Chevron className="text-label-secondary h-3.5 w-3.5" />
        </div>
      </Button>

      {isOpen && (
        <div className="border-separator space-y-0.5 border-t pt-1 pr-1 pb-1 pl-4">
          {items.map((item) => (
            <TocRow
              key={item.id}
              item={item}
              isSelected={activeSectionId === item.id}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DossierTocSidebar({
  countryName,
  sections,
  nativeDocs = [],
  activeSectionId,
  onSelectSection,
}: DossierTocSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "wiki" | "native">("all");
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const query = searchQuery.trim().toLowerCase();
  const allTocItems: TocItem[] = [
    ...wikiPagesFor(countryName),
    ...sections.map((s) => ({
      ...s,
      source: "wiki" as const,
      category: s.category || categorizeTitle(s.title, "wiki"),
    })),
    ...nativeDocs.map((d) => ({ ...d, source: "native" as const, category: "Native Canvas Lore" })),
  ];

  // Group the matching items into category folders.
  const groupedFolders: Record<string, TocItem[]> = {};
  for (const item of allTocItems) {
    const matchesSearch = [item.title, item.category, item.pageTitle].some((field) =>
      field?.toLowerCase().includes(query)
    );
    if (!matchesSearch || (sourceFilter !== "all" && item.source !== sourceFilter)) continue;
    const folderName = item.category || categorizeTitle(item.title, item.source);
    (groupedFolders[folderName] ??= []).push(item);
  }

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderName]: prev[folderName] === undefined ? false : !prev[folderName],
    }));
  };

  const handleItemClick = (item: TocItem) => {
    if (item.isPage && item.pageTitle) {
      // Navigate directly to WikiOS page
      router.push(titleToWikiOSPath(item.pageTitle));
    } else {
      // Scroll to or select section anchor
      onSelectSection(item.id);
    }
  };

  const totalEntries = Object.values(groupedFolders).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-4 lg:sticky lg:top-(--shell-top-offset)">
      {/* Searchable Dynamic Dossier Table of Contents */}
      <Card className="rounded-card overflow-hidden">
        <CardHeader className="border-separator gap-0 border-b px-4 py-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-label text-headline flex items-center gap-2">
              <Layers className="text-label-secondary h-4 w-4" />
              Dossier
            </h3>
            <Badge variant="outline" className="text-label-secondary tabular-nums">
              {totalEntries} Entries
            </Badge>
          </div>

          {/* Search Input */}
          <div className="relative mt-2">
            <Search className="text-label-secondary absolute top-3 left-3 h-3.5 w-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages & subfolders..."
              aria-label="Search dossier"
              className="text-label placeholder:text-label-secondary border-separator bg-surface focus-visible:ring-tint rounded-control text-footnote w-full border py-2 pr-3 pl-8 outline-none focus-visible:ring-2"
            />
          </div>

          {/* Source filter */}
          <SegmentedControl
            aria-label="Source"
            className="mt-2"
            fullWidth
            size="sm"
            value={sourceFilter}
            onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "wiki", label: "Wiki" },
              { value: "native", label: "Canvas" },
            ]}
          />
        </CardHeader>

        <CardContent className="max-h-96 space-y-2 overflow-y-auto p-2">
          {Object.keys(groupedFolders).length === 0 ? (
            <div className="text-label-secondary text-footnote p-4 text-center">
              No dossier folders or pages found.
            </div>
          ) : (
            Object.entries(groupedFolders).map(([folderName, items]) => (
              <TocFolder
                key={folderName}
                name={folderName}
                items={items}
                isOpen={query.length > 0 || openFolders[folderName] !== false}
                activeSectionId={activeSectionId}
                onToggle={() => toggleFolder(folderName)}
                onSelect={handleItemClick}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
