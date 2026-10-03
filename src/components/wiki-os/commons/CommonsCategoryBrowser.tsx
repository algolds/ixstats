"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  NavArrowRight as ChevronRight,
  NavArrowDown as ChevronDown,
  Folder,
  Search,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

// Curated worldbuilding-relevant categories organized by theme
interface CategoryGroup {
  label: string;
  categories: string[];
  counts?: Record<string, number>;
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Government & royalty",
    categories: [
      "Royal residences by country",
      "Coats of arms by country",
      "Flags by country",
      "Heraldry by country",
      "Crowns",
      "Thrones",
      "Government buildings by country",
      "Coronations",
    ],
  },
  {
    label: "Architecture & places",
    categories: [
      "Castles by country",
      "Cathedrals by country",
      "Fortifications by country",
      "Palaces by country",
      "Houses by country",
      "Bridges by country",
      "City walls",
      "Historical maps",
    ],
  },
  {
    label: "Military & warfare",
    categories: [
      "Military uniforms by country",
      "Battles by country",
      "Naval ships",
      "Armour",
      "Swords",
      "Military flags",
      "Fortifications",
      "Siege warfare",
    ],
  },
  {
    label: "People & culture",
    categories: [
      "Portrait paintings",
      "National costumes by country",
      "Ceremonies by country",
      "Sculptures by country",
      "Historical clothing",
      "Ethnography",
      "Paintings by country",
    ],
  },
  {
    label: "Geography & nature",
    categories: [
      "Landscapes by country",
      "Mountains by country",
      "Rivers by country",
      "Islands by country",
      "Old maps of the world",
      "Topographic maps",
    ],
  },
  {
    label: "Economy & trade",
    categories: [
      "Markets by country",
      "Ships by country",
      "Banknotes by country",
      "Agriculture by country",
      "Trade routes",
    ],
  },
  {
    label: "Religion",
    categories: [
      "Religious buildings by country",
      "Church architecture",
      "Mosques by country",
      "Monasteries by country",
      "Religious art",
    ],
  },
];

const THEMATIC_GROUPS = [
  {
    label: "Government & royalty",
    keywords: [
      "government",
      "royal",
      "crown",
      "throne",
      "coronation",
      "flag",
      "heraldry",
      "coat of arm",
      "monarch",
      "emblem",
      "sovereign",
      "capit",
    ],
  },
  {
    label: "Architecture & places",
    keywords: [
      "architecture",
      "building",
      "castle",
      "bridge",
      "wall",
      "house",
      "palace",
      "cathedral",
      "monument",
      "ruins",
      "fortification",
      "landmark",
    ],
  },
  {
    label: "Military & warfare",
    keywords: [
      "military",
      "uniform",
      "battle",
      "ship",
      "navy",
      "weapon",
      "sword",
      "armour",
      "war",
      "army",
      "soldier",
    ],
  },
  {
    label: "People & culture",
    keywords: [
      "people",
      "costume",
      "clothing",
      "ceremony",
      "sculpture",
      "painting",
      "portrait",
      "culture",
      "ethnography",
      "art",
      "music",
    ],
  },
  {
    label: "Geography & nature",
    keywords: [
      "geography",
      "map",
      "landscape",
      "mountain",
      "river",
      "lake",
      "sea",
      "ocean",
      "island",
      "forest",
      "terrain",
      "topo",
      "region",
      "border",
    ],
  },
  {
    label: "Economy & trade",
    keywords: [
      "economy",
      "market",
      "banknote",
      "money",
      "coin",
      "trade",
      "agriculture",
      "industry",
      "business",
      "company",
    ],
  },
  {
    label: "Religion",
    keywords: [
      "religion",
      "church",
      "mosque",
      "temple",
      "monastery",
      "religious",
      "cathedral",
      "belief",
      "deity",
    ],
  },
];

const mapLocalCategories = (categoriesList: Array<{ name: string; fileCount: number }>) => {
  const mapped = THEMATIC_GROUPS.map((g) => ({
    label: g.label,
    categories: [] as string[],
    counts: {} as Record<string, number>,
  }));

  const generalGroup = {
    label: "General & misc",
    categories: [] as string[],
    counts: {} as Record<string, number>,
  };

  for (const cat of categoriesList) {
    const name = cat.name;
    const lower = name.toLowerCase();

    let matched = false;
    for (const group of THEMATIC_GROUPS) {
      if (group.keywords.some((kw) => lower.includes(kw))) {
        const target = mapped.find((m) => m.label === group.label)!;
        target.categories.push(name);
        target.counts[name] = cat.fileCount;
        matched = true;
        break;
      }
    }

    if (!matched) {
      generalGroup.categories.push(name);
      generalGroup.counts[name] = cat.fileCount;
    }
  }

  const activeGroups = mapped.filter((g) => g.categories.length > 0);
  if (generalGroup.categories.length > 0) {
    activeGroups.push(generalGroup);
  }

  return activeGroups;
};

interface CommonsCategoryBrowserProps {
  activeCategories: string[];
  browsingCategory: string | null;
  onToggleCategory: (category: string) => void;
  onBrowseCategory: (category: string) => void;
  wiki?: "commons" | "ixwiki" | "iiwiki";
}

// Flatten all categories for the batch info query (max 20 per call)
// oxlint-disable-next-line eslint/no-unused-vars
const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

export function CommonsCategoryBrowser({
  activeCategories,
  browsingCategory,
  onToggleCategory,
  onBrowseCategory,
  wiki = "commons",
}: CommonsCategoryBrowserProps) {
  const isCommons = wiki === "commons";

  const { data: localDynamicCats } = api.wikios.getCategories.useQuery(
    { wiki: wiki === "iiwiki" ? "iiwiki" : "ixwiki" },
    { enabled: !isCommons, staleTime: 30 * 60 * 1000 }
  );

  const groups = useMemo(() => {
    if (isCommons) {
      return CATEGORY_GROUPS.map((g) => ({
        label: g.label,
        categories: g.categories,
        counts: {} as Record<string, number>,
      }));
    }
    return mapLocalCategories(localDynamicCats || []);
  }, [isCommons, localDynamicCats]);

  const allCats = useMemo(() => {
    return groups.flatMap((g) => g.categories);
  }, [groups]);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Reset expansion states when wiki source changes or groups load
  useEffect(() => {
    if (groups && groups.length > 0) {
      // oxlint-disable-next-line
      setExpandedGroups({ [groups[0]!.label]: true });
    }
    setExpanded({});
    // oxlint-disable-next-line
  }, [wiki, groups]);

  // Auto-expand parent category and group if browsingCategory is selected
  useEffect(() => {
    if (!browsingCategory) return;

    // Auto-expand the main category folder
    if (allCats.includes(browsingCategory)) {
      // oxlint-disable-next-line
      setExpanded((prev) => ({ ...prev, [browsingCategory]: true }));
    }

    // Auto-expand the parent group that contains the browsingCategory
    const parentGroup = groups.find((g) => g.categories.includes(browsingCategory));
    if (parentGroup) {
      setExpandedGroups((prev) => ({ ...prev, [parentGroup.label]: true }));
    }
  }, [browsingCategory, groups, allCats]);

  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }, []);

  const isSearching = debouncedQuery.length >= 2;

  // Autocomplete when searching
  const { data: commonsAutocomplete } = api.commons.autocompleteCategories.useQuery(
    { prefix: debouncedQuery, limit: 15 },
    { enabled: isCommons && isSearching, staleTime: 60_000 }
  );

  const { data: localAutocomplete } = api.wikios.autocompleteCategories.useQuery(
    { prefix: debouncedQuery, limit: 15, wiki: wiki === "iiwiki" ? "iiwiki" : "ixwiki" },
    { enabled: !isCommons && isSearching, staleTime: 60_000 }
  );

  const autocompleteResults = isCommons ? commonsAutocomplete : localAutocomplete;
  const safeAutocompleteResults = useMemo(
    () => (autocompleteResults ? autocompleteResults.slice(0, 25) : []),
    [autocompleteResults]
  );

  const { data: commonsSearchCounts } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: safeAutocompleteResults },
    {
      enabled: isCommons && isSearching && safeAutocompleteResults.length > 0,
      staleTime: 30 * 60 * 1000,
    }
  );

  const { data: localSearchCounts } = api.wikios.getCategoryTotalCounts.useQuery(
    { categories: safeAutocompleteResults, wiki: wiki === "iiwiki" ? "iiwiki" : "ixwiki" },
    {
      enabled: !isCommons && isSearching && safeAutocompleteResults.length > 0,
      staleTime: 30 * 60 * 1000,
    }
  );

  const searchCounts = isCommons ? commonsSearchCounts : localSearchCounts;

  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
      {/* Search */}
      <div className="rounded-control bg-fill-3 border-separator focus-within:border-separator mx-2 mb-2 flex items-center gap-2 border px-3 py-2 transition-colors">
        <Search className="text-label-secondary h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search categories..."
          className="text-footnote text-label placeholder:text-label-secondary flex-1 border-none bg-transparent outline-none"
        />
      </div>

      <div className="space-y-0.5 overflow-y-auto px-2">
        {isSearching ? (
          /* Autocomplete search results */
          <>
            {(autocompleteResults ?? []).map((cat) => (
              <CategoryRow
                key={cat}
                name={cat}
                totalCount={searchCounts?.[cat]}
                isActive={activeCategories.includes(cat)}
                isExpanded={!!expanded[cat]}
                browsingCategory={browsingCategory}
                onToggle={() => onToggleCategory(cat)}
                onBrowse={(catToBrowse) => {
                  onBrowseCategory(catToBrowse);
                  if (!expanded[cat]) {
                    setExpanded((prev) => ({ ...prev, [cat]: true }));
                  }
                }}
                onExpand={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                wiki={wiki}
              />
            ))}
            {(!autocompleteResults || autocompleteResults.length === 0) && (
              <p className="text-footnote text-label-secondary py-4 text-center">
                No categories found
              </p>
            )}
          </>
        ) : (
          groups.map((group) => (
            <CategoryGroupSection
              key={group.label}
              group={group}
              isGroupOpen={!!expandedGroups[group.label]}
              onToggleGroup={() =>
                setExpandedGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
              }
              activeCategories={activeCategories}
              expanded={expanded}
              browsingCategory={browsingCategory}
              onToggleCategory={onToggleCategory}
              onBrowseCategory={onBrowseCategory}
              setExpanded={setExpanded}
              wiki={wiki}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category group section with lazy-loaded counts
// ---------------------------------------------------------------------------

interface CategoryGroupSectionProps {
  group: CategoryGroup;
  isGroupOpen: boolean;
  onToggleGroup: () => void;
  activeCategories: string[];
  expanded: Record<string, boolean>;
  browsingCategory: string | null;
  onToggleCategory: (category: string) => void;
  onBrowseCategory: (category: string) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  wiki?: "commons" | "ixwiki" | "iiwiki";
}

function CategoryGroupSection({
  group,
  isGroupOpen,
  onToggleGroup,
  activeCategories,
  expanded,
  browsingCategory,
  onToggleCategory,
  onBrowseCategory,
  setExpanded,
  wiki = "commons",
}: CategoryGroupSectionProps) {
  const isCommons = wiki === "commons";

  const { data: commonsGroupCounts } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: group.categories },
    { enabled: isCommons && isGroupOpen, staleTime: 30 * 60 * 1000 }
  );

  const groupCounts = isCommons ? commonsGroupCounts : group.counts || {};

  return (
    <div className="mb-1">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={isGroupOpen}
        onClick={onToggleGroup}
        className="text-eyebrow text-label-secondary hover:text-label h-auto w-full justify-start px-2 py-1"
      >
        {isGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{group.label}</span>
      </Button>
      {isGroupOpen &&
        group.categories.map((cat) => (
          <CategoryRow
            key={cat}
            name={cat}
            totalCount={groupCounts?.[cat]}
            isActive={activeCategories.includes(cat)}
            isExpanded={!!expanded[cat]}
            browsingCategory={browsingCategory}
            onToggle={() => onToggleCategory(cat)}
            onBrowse={(catToBrowse) => {
              onBrowseCategory(catToBrowse);
              if (!expanded[cat]) {
                setExpanded((prev) => ({ ...prev, [cat]: true }));
              }
            }}
            onExpand={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
            wiki={wiki}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category row with optional subcategory expansion
// ---------------------------------------------------------------------------

function CategoryRow({
  name,
  totalCount,
  isActive,
  isExpanded,
  browsingCategory,
  onToggle,
  onBrowse,
  onExpand,
  wiki = "commons",
}: {
  name: string;
  totalCount?: number;
  isActive: boolean;
  isExpanded: boolean;
  browsingCategory: string | null;
  onToggle: () => void;
  onBrowse: (categoryName: string) => void;
  onExpand: () => void;
  wiki?: "commons" | "ixwiki" | "iiwiki";
}) {
  const isCommons = wiki === "commons";

  const { data: commonsSubcats } = api.commons.getSubcategories.useQuery(
    { category: name, limit: 20 },
    { enabled: isCommons && isExpanded, staleTime: 5 * 60 * 1000 }
  );

  const { data: localSubcats } = api.wikios.getSubcategories.useQuery(
    { category: name, limit: 20, wiki: wiki === "iiwiki" ? "iiwiki" : "ixwiki" },
    { enabled: !isCommons && isExpanded, staleTime: 5 * 60 * 1000 }
  );

  const subcats = isCommons ? commonsSubcats : localSubcats;

  const isBrowsingThisCat = browsingCategory === name;

  return (
    <div>
      <div
        className={cn(
          "group/row rounded-control-sm text-footnote hover:bg-fill-3 flex items-center gap-2 px-2 py-1 transition-colors select-none",
          isActive && "bg-tint-fill text-tint",
          isBrowsingThisCat && "bg-fill-3 text-label font-semibold"
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={isExpanded}
          onClick={onExpand}
          aria-label={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
          className="text-label-secondary hover:text-label size-5"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-current={isBrowsingThisCat ? "true" : undefined}
          onClick={() => onBrowse(name)}
          title={`Browse ${name}`}
          className="text-footnote text-label-secondary hover:text-label h-auto min-w-0 flex-1 justify-start truncate px-0 font-normal hover:bg-transparent"
        >
          {name}
        </Button>
        {totalCount != null && totalCount > 0 && (
          <span className="text-footnote text-label-secondary mr-1 shrink-0 tabular-nums">
            {totalCount.toLocaleString()}
          </span>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-pressed={isActive}
          onClick={onToggle}
          className={cn(
            "text-footnote text-label-secondary hover:border-tint hover:text-tint size-5 shrink-0",
            isActive && "bg-tint-fill border-tint/40 text-tint font-semibold"
          )}
          title={isActive ? "Remove filter" : "Add as filter"}
          aria-label={isActive ? `Remove ${name} filter` : `Add ${name} filter`}
        >
          {isActive ? "✓" : "+"}
        </Button>
      </div>

      {isExpanded && subcats && subcats.length > 0 && (
        <div className="space-y-0.5 py-0.5 pr-1 pl-5">
          {subcats.map((sub) => {
            const isSubActive = browsingCategory === sub;
            return (
              <Button
                variant="ghost"
                size="sm"
                aria-current={isSubActive ? "true" : undefined}
                key={sub}
                onClick={() => onBrowse(sub)}
                className={cn(
                  "text-footnote h-auto w-full justify-start px-2 py-1 font-normal",
                  isSubActive ? "text-tint font-semibold" : "text-label-secondary hover:text-label"
                )}
                title={`Browse ${sub}`}
              >
                <Folder
                  className={cn(
                    "h-2.5 w-2.5 shrink-0",
                    isSubActive ? "text-tint opacity-100" : "opacity-40"
                  )}
                />
                <span className="truncate">{sub}</span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
