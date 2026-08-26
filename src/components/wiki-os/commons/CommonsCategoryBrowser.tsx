"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  NavArrowRight as ChevronRight,
  NavArrowDown as ChevronDown,
  Folder,
  Search,
} from "iconoir-react";
import { api } from "~/trpc/react";

// Curated worldbuilding-relevant categories organized by theme
interface CategoryGroup {
  label: string;
  categories: string[];
  counts?: Record<string, number>;
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Government & Royalty",
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
    label: "Architecture & Places",
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
    label: "Military & Warfare",
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
    label: "People & Culture",
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
    label: "Geography & Nature",
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
    label: "Economy & Trade",
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
    label: "Government & Royalty",
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
    label: "Architecture & Places",
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
    label: "Military & Warfare",
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
    label: "People & Culture",
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
    label: "Geography & Nature",
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
    label: "Economy & Trade",
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
    label: "General & Misc",
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
      setExpandedGroups({ [groups[0]!.label]: true });
    }
    setExpanded({});
  }, [wiki, groups]);

  // Auto-expand parent category and group if browsingCategory is selected
  useEffect(() => {
    if (!browsingCategory) return;

    // Auto-expand the main category folder
    if (allCats.includes(browsingCategory)) {
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

  const { data: commonsSearchCounts } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: autocompleteResults ?? [] },
    {
      enabled: isCommons && isSearching && !!autocompleteResults && autocompleteResults.length > 0,
      staleTime: 30 * 60 * 1000,
    }
  );

  const { data: localSearchCounts } = api.wikios.getCategoryTotalCounts.useQuery(
    { categories: autocompleteResults ?? [], wiki: wiki === "iiwiki" ? "iiwiki" : "ixwiki" },
    {
      enabled: !isCommons && isSearching && !!autocompleteResults && autocompleteResults.length > 0,
      staleTime: 30 * 60 * 1000,
    }
  );

  const searchCounts = isCommons ? commonsSearchCounts : localSearchCounts;

  return (
    <div className="wikios-commons-sidebar">
      {/* Search */}
      <div className="wikios-commons-sidebar-search">
        <Search className="wikios-commons-sidebar-search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search categories..."
          className="wikios-commons-sidebar-search-input"
        />
      </div>

      <div className="wikios-commons-sidebar-list">
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
              <p className="wikios-commons-sidebar-empty">No categories found</p>
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
    <div className="wikios-commons-group">
      <button onClick={onToggleGroup} className="wikios-commons-group-header">
        {isGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>{group.label}</span>
      </button>
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
        className={`wikios-commons-cat-row ${isActive ? "wikios-commons-cat-row--active" : ""} ${
          isBrowsingThisCat
            ? "wikios-commons-cat-row--browsing bg-white/5 font-bold text-[var(--wikios-accent)]"
            : ""
        }`}
      >
        <button onClick={onExpand} className="wikios-commons-cat-expand">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button
          onClick={() => onBrowse(name)}
          className="wikios-commons-cat-name"
          title={`Browse ${name}`}
        >
          {name}
        </button>
        {totalCount != null && totalCount > 0 && (
          <span className="wikios-commons-cat-count">{totalCount.toLocaleString()}</span>
        )}
        <button
          onClick={onToggle}
          className={`wikios-commons-cat-chip ${isActive ? "wikios-commons-cat-chip--on" : ""}`}
          title={isActive ? "Remove filter" : "Add as filter"}
        >
          {isActive ? "✓" : "+"}
        </button>
      </div>

      {isExpanded && subcats && subcats.length > 0 && (
        <div className="wikios-commons-subcats">
          {subcats.map((sub) => {
            const isSubActive = browsingCategory === sub;
            return (
              <button
                key={sub}
                onClick={() => onBrowse(sub)}
                className={`wikios-commons-subcat flex w-full items-center gap-1.5 py-1 text-left text-[10px] transition-colors ${
                  isSubActive
                    ? "font-bold text-[var(--wikios-accent)]"
                    : "text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
                }`}
                title={`Browse ${sub}`}
              >
                <Folder
                  className={`h-2.5 w-2.5 ${isSubActive ? "text-blue-500 opacity-100" : "opacity-40"}`}
                />
                <span className="truncate">{sub}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
