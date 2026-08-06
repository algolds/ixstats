"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
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
import { parseInfoboxValue } from "~/lib/dossier-parser";
import { resolveImageUrl } from "~/lib/unified-wiki-parser";
import type { CountryInfobox } from "~/lib/mediawiki-service";
import type { WikiSource } from "~/lib/mediawiki-config";

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
  if (lower.includes("geograph") || lower.includes("climat") || lower.includes("demograph") || lower.includes("populat") || lower.includes("land") || lower.includes("territor")) {
    return "Geography & Demographics";
  }
  if (lower.includes("govern") || lower.includes("politi") || lower.includes("execut") || lower.includes("foreign") || lower.includes("diploma") || lower.includes("law") || lower.includes("constitut")) {
    return "Government & Politics";
  }
  if (lower.includes("econom") || lower.includes("trad") || lower.includes("financ") || lower.includes("currenc") || lower.includes("industr") || lower.includes("infrastruct")) {
    return "Economy & Infrastructure";
  }
  if (lower.includes("histor") || lower.includes("cultur") || lower.includes("religi") || lower.includes("languag") || lower.includes("ethni") || lower.includes("societ")) {
    return "History & Culture";
  }
  if (lower.includes("militar") || lower.includes("defens") || lower.includes("securit") || lower.includes("force") || lower.includes("navy") || lower.includes("army")) {
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

      const matchesSource =
        sourceFilter === "all" || item.source === sourceFilter;

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

  const flagUrl = infobox?.image_flag || infobox?.flag
    ? resolveImageUrl(infobox.image_flag || infobox.flag, wikiSource)
    : undefined;

  const coatUrl = infobox?.image_coat || infobox?.coat
    ? resolveImageUrl(infobox.image_coat || infobox.coat, wikiSource)
    : undefined;

  const totalEntries = Object.values(groupedFolders).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-4 sticky top-6">
      {/* Searchable Dynamic Dossier Table of Contents */}
      <FacetCard
        depth={1}
        interactive="none"
        className="overflow-hidden rounded-xl border border-white/10 bg-card/30 backdrop-blur-md shadow-sm"
      >
        <CardHeader className="px-4 py-3 pb-2 border-b border-white/10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-foreground">
              <Layers className="h-4 w-4 text-blue-400" />
              Dossier 
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-mono border-white/10 text-muted-foreground">
              {totalEntries} Entries
            </Badge>
          </div>

          {/* Search Input */}
          <div className="relative mt-2.5">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pages & subfolders..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Source Filter Pills */}
          <div className="flex gap-1 pt-2">
            {(["all", "wiki", "native"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSourceFilter(mode)}
                className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded transition-colors ${
                  sourceFilter === mode
                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "all" ? "All" : mode === "wiki" ? "Wiki" : "Canvas"}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-2 max-h-96 overflow-y-auto space-y-2">
          {Object.keys(groupedFolders).length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
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
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs font-bold text-foreground hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                      )}
                      <span className="truncate">{folderName}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                        {items.length}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Subfolder Item List (Pages & Sections) */}
                  {isOpen && (
                    <div className="pl-4 pr-1 pb-1 space-y-0.5 border-t border-white/5 pt-1">
                      {items.map((item) => {
                        const isSelected = activeSectionId === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={`w-full flex items-center justify-between rounded px-2 py-1 text-left transition-all text-xs ${
                              isSelected
                                ? "bg-blue-500/20 text-blue-400 font-bold"
                                : item.isPage
                                ? "hover:bg-blue-500/10 text-foreground hover:text-blue-300 font-medium"
                                : "hover:bg-white/[0.05] text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
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
