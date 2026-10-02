"use client";

import React, { useState, useMemo } from "react";
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

function categorizeTitle(title: string, source: "wiki" | "native"): string {
  if (source === "native") return "Native Canvas Lore";

  const lower = title.toLowerCase();
  if (
    lower.includes("geograph") ||
    lower.includes("climat") ||
    lower.includes("demograph") ||
    lower.includes("populat") ||
    lower.includes("land") ||
    lower.includes("territor")
  ) {
    return "Geography & Demographics";
  }
  if (
    lower.includes("govern") ||
    lower.includes("politi") ||
    lower.includes("execut") ||
    lower.includes("foreign") ||
    lower.includes("diploma") ||
    lower.includes("law") ||
    lower.includes("constitut")
  ) {
    return "Government & Politics";
  }
  if (
    lower.includes("econom") ||
    lower.includes("trad") ||
    lower.includes("financ") ||
    lower.includes("currenc") ||
    lower.includes("industr") ||
    lower.includes("infrastruct")
  ) {
    return "Economy & Infrastructure";
  }
  if (
    lower.includes("histor") ||
    lower.includes("cultur") ||
    lower.includes("religi") ||
    lower.includes("languag") ||
    lower.includes("ethni") ||
    lower.includes("societ")
  ) {
    return "History & Culture";
  }
  if (
    lower.includes("militar") ||
    lower.includes("defens") ||
    lower.includes("securit") ||
    lower.includes("force") ||
    lower.includes("navy") ||
    lower.includes("army")
  ) {
    return "Military & Defense";
  }
  return "General Dossier Sections";
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

  // Individual WikiOS Topic Pages to inject into category folders
  const wikiPages = useMemo<TocItem[]>(() => {
    if (!countryName) return [];
    return [
      {
        id: `page_main_${countryName}`,
        title: `${countryName} (Main WikiOS Article)`,
        pageTitle: countryName,
        isPage: true,
        source: "wiki",
        category: "General Dossier Sections",
      },
      {
        id: `page_geo_${countryName}`,
        title: `Geography of ${countryName}`,
        pageTitle: `Geography of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "Geography & Demographics",
      },
      {
        id: `page_demog_${countryName}`,
        title: `Demographics of ${countryName}`,
        pageTitle: `Demographics of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "Geography & Demographics",
      },
      {
        id: `page_gov_${countryName}`,
        title: `Government & Politics of ${countryName}`,
        pageTitle: `Government of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "Government & Politics",
      },
      {
        id: `page_econ_${countryName}`,
        title: `Economy of ${countryName}`,
        pageTitle: `Economy of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "Economy & Infrastructure",
      },
      {
        id: `page_hist_${countryName}`,
        title: `History of ${countryName}`,
        pageTitle: `History of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "History & Culture",
      },
      {
        id: `page_mil_${countryName}`,
        title: `Military of ${countryName}`,
        pageTitle: `Military of ${countryName}`,
        isPage: true,
        source: "wiki",
        category: "Military & Defense",
      },
    ];
  }, [countryName]);

  // Combined list of items (Pages + Sections + Native Docs)
  const allTocItems = useMemo(() => {
    const wikiItems: TocItem[] = sections.map((s) => ({
      ...s,
      source: "wiki",
      category: s.category || categorizeTitle(s.title, "wiki"),
    }));

    const nativeItems: TocItem[] = nativeDocs.map((d) => ({
      ...d,
      source: "native",
      category: "Native Canvas Lore",
    }));

    return [...wikiPages, ...wikiItems, ...nativeItems];
  }, [wikiPages, sections, nativeDocs]);

  // Group items by category subfolders
  const groupedFolders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = allTocItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.pageTitle && item.pageTitle.toLowerCase().includes(query));

      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;

      return matchesSearch && matchesSource;
    });

    const folderMap: Record<string, TocItem[]> = {};

    for (const item of filtered) {
      const folderName = item.category || categorizeTitle(item.title, item.source);
      if (!folderMap[folderName]) {
        folderMap[folderName] = [];
      }
      folderMap[folderName].push(item);
    }

    return folderMap;
  }, [allTocItems, searchQuery, sourceFilter]);

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
            Object.entries(groupedFolders).map(([folderName, items]) => {
              const isOpen = searchQuery.trim().length > 0 || openFolders[folderName] !== false;

              return (
                <div key={folderName} className="border-separator rounded-control border">
                  {/* Folder Header Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFolder(folderName)}
                    aria-expanded={isOpen}
                    className="text-label h-auto min-h-(--control-height-sm) w-full justify-between justify-start py-2 text-left whitespace-normal"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen ? (
                        <FolderOpen className="text-label-secondary h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Folder className="text-label-secondary h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{folderName}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-label-secondary bg-fill-3 text-footnote rounded-control-sm px-2 py-0.5 tabular-nums">
                        {items.length}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
                      )}
                    </div>
                  </Button>

                  {/* Subfolder Item List (Pages & Sections) */}
                  {isOpen && (
                    <div className="border-separator space-y-0.5 border-t pt-1 pr-1 pb-1 pl-4">
                      {items.map((item) => {
                        const isSelected = activeSectionId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-current={isSelected ? "true" : undefined}
                            onClick={() => handleItemClick(item)}
                            className={`text-footnote rounded-control-sm flex w-full items-center justify-between px-2 py-1 text-left transition-[background-color,border-color,transform] duration-150 ${
                              isSelected
                                ? "bg-fill-3 text-label font-semibold"
                                : item.isPage
                                  ? "text-label hover:bg-fill-3 font-medium"
                                  : "text-label-secondary hover:text-label hover:bg-fill-3"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {item.isPage ? (
                                <Globe className="text-label-secondary h-3 w-3 shrink-0" />
                              ) : item.source === "wiki" ? (
                                <BookOpen className="text-label-secondary h-3 w-3 shrink-0" />
                              ) : (
                                <FileText className="text-label-secondary h-3 w-3 shrink-0" />
                              )}
                              <span className="text-caption truncate">{item.title}</span>
                            </div>

                            {item.isPage ? (
                              <ExternalLink className="text-label-secondary h-3 w-3 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
