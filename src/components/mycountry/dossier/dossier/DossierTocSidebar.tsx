"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import {
  Search,
  BookOpen,
  Layers,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { parseInfoboxValue } from "~/lib/builder";
import { resolveImageUrl } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import type { CountryInfobox } from "~/types/dossier";
import type { WikiSource } from "~/lib/wiki-os/config";

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
  infobox,
  sections,
  nativeDocs = [],
  activeSectionId,
  onSelectSection,
  flagColors,
  wikiSource = "ixwiki",
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

  const flagUrl =
    infobox?.image_flag || infobox?.flag
      ? resolveImageUrl(infobox.image_flag || infobox.flag, wikiSource)
      : undefined;

  const coatUrl =
    infobox?.image_coat || (infobox as any)?.coat
      ? resolveImageUrl(infobox?.image_coat || (infobox as any)?.coat, wikiSource)
      : undefined;

  const totalEntries = Object.values(groupedFolders).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="sticky top-6 space-y-4">
      {/* Searchable Dynamic Dossier Table of Contents */}
      <FacetCard
        depth={1}
        interactive="none"
        className="bg-card/30 overflow-hidden rounded-xl border border-white/10 shadow-sm backdrop-blur-md"
      >
        <CardHeader className="border-b border-white/10 px-4 py-3 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2 text-xs font-extrabold tracking-wider uppercase">
              <Layers className="h-4 w-4 text-blue-400" />
              Dossier
            </CardTitle>
            <Badge
              variant="outline"
              className="text-muted-foreground border-white/10 font-mono text-[9px]"
            >
              {totalEntries} Entries
            </Badge>
          </div>

          {/* Search Input */}
          <div className="relative mt-2.5">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-3.5 w-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages & subfolders..."
              className="text-foreground placeholder:text-muted-foreground/60 w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pr-3 pl-8 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Source Filter Pills */}
          <div className="flex gap-1 pt-2">
            {(["all", "wiki", "native"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSourceFilter(mode)}
                className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase transition-colors ${
                  sourceFilter === mode
                    ? "border border-blue-500/30 bg-blue-500/20 text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "all" ? "All" : mode === "wiki" ? "Wiki" : "Canvas"}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="max-h-96 space-y-2 overflow-y-auto p-2">
          {Object.keys(groupedFolders).length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-xs">
              No dossier folders or pages found.
            </div>
          ) : (
            Object.entries(groupedFolders).map(([folderName, items]) => {
              const isOpen = searchQuery.trim().length > 0 || openFolders[folderName] !== false;

              return (
                <div key={folderName} className="rounded-lg border border-white/5 bg-white/[0.02]">
                  {/* Folder Header Button */}
                  <button
                    onClick={() => toggleFolder(folderName)}
                    className="text-foreground flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-bold transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen ? (
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                      )}
                      <span className="truncate">{folderName}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-muted-foreground rounded border border-white/5 bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
                        {items.length}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                    </div>
                  </button>

                  {/* Subfolder Item List (Pages & Sections) */}
                  {isOpen && (
                    <div className="space-y-0.5 border-t border-white/5 pt-1 pr-1 pb-1 pl-4">
                      {items.map((item) => {
                        const isSelected = activeSectionId === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs transition-all ${
                              isSelected
                                ? "bg-blue-500/20 font-bold text-blue-400"
                                : item.isPage
                                  ? "text-foreground font-medium hover:bg-blue-500/10 hover:text-blue-300"
                                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {item.isPage ? (
                                <Globe className="h-3 w-3 shrink-0 text-blue-400" />
                              ) : item.source === "wiki" ? (
                                <BookOpen className="h-3 w-3 shrink-0 text-blue-400/80" />
                              ) : (
                                <FileText className="h-3 w-3 shrink-0 text-amber-400/80" />
                              )}
                              <span className="truncate text-[11px] font-medium">{item.title}</span>
                            </div>

                            {item.isPage ? (
                              <ExternalLink className="h-3 w-3 shrink-0 text-blue-400 opacity-70" />
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
      </FacetCard>
    </div>
  );
}
