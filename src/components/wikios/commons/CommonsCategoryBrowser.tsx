"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, Search } from "lucide-react";
import { api } from "~/trpc/react";

// Curated worldbuilding-relevant categories organized by theme
interface CategoryGroup {
  label: string;
  categories: string[];
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

interface CommonsCategoryBrowserProps {
  activeCategories: string[];
  onToggleCategory: (category: string) => void;
  onBrowseCategory: (category: string) => void;
}

// Flatten all categories for the batch info query (max 20 per call)
const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.categories);

export function CommonsCategoryBrowser({
  activeCategories,
  onToggleCategory,
  onBrowseCategory,
}: CommonsCategoryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => ({ [CATEGORY_GROUPS[0]!.label]: true }) // First group open by default
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(val), 300);
  }, []);

  // Recursive total counts — batched in groups of 10 (parallel deepcat queries)
  const { data: counts1 } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: ALL_CATEGORIES.slice(0, 10) },
    { staleTime: 30 * 60 * 1000 }
  );
  const { data: counts2 } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: ALL_CATEGORIES.slice(10, 20) },
    { staleTime: 30 * 60 * 1000, enabled: ALL_CATEGORIES.length > 10 }
  );
  const { data: counts3 } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: ALL_CATEGORIES.slice(20, 30) },
    { staleTime: 30 * 60 * 1000, enabled: ALL_CATEGORIES.length > 20 }
  );
  const { data: counts4 } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: ALL_CATEGORIES.slice(30, 40) },
    { staleTime: 30 * 60 * 1000, enabled: ALL_CATEGORIES.length > 30 }
  );
  const { data: counts5 } = api.commons.getCategoryTotalCounts.useQuery(
    { categories: ALL_CATEGORIES.slice(40) },
    { staleTime: 30 * 60 * 1000, enabled: ALL_CATEGORIES.length > 40 }
  );
  const totalCounts: Record<string, number> = {
    ...counts1,
    ...counts2,
    ...counts3,
    ...counts4,
    ...counts5,
  };

  // Autocomplete when searching
  const { data: autocompleteResults } = api.commons.autocompleteCategories.useQuery(
    { prefix: debouncedQuery, limit: 15 },
    { enabled: debouncedQuery.length >= 2, staleTime: 60_000 }
  );

  const isSearching = debouncedQuery.length >= 2;

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
                totalCount={totalCounts?.[cat]}
                isActive={activeCategories.includes(cat)}
                isExpanded={!!expanded[cat]}
                onToggle={() => onToggleCategory(cat)}
                onBrowse={() => onBrowseCategory(cat)}
                onExpand={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
              />
            ))}
            {(!autocompleteResults || autocompleteResults.length === 0) && (
              <p className="wikios-commons-sidebar-empty">No categories found</p>
            )}
          </>
        ) : (
          /* Grouped curated categories */
          CATEGORY_GROUPS.map((group) => {
            const isGroupOpen = !!expandedGroups[group.label];
            return (
              <div key={group.label} className="wikios-commons-group">
                <button
                  onClick={() =>
                    setExpandedGroups((prev) => ({ ...prev, [group.label]: !prev[group.label] }))
                  }
                  className="wikios-commons-group-header"
                >
                  {isGroupOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span>{group.label}</span>
                </button>
                {isGroupOpen &&
                  group.categories.map((cat) => (
                    <CategoryRow
                      key={cat}
                      name={cat}
                      fileCount={totalCounts?.[cat]}
                      subcatCount={undefined}
                      isActive={activeCategories.includes(cat)}
                      isExpanded={!!expanded[cat]}
                      onToggle={() => onToggleCategory(cat)}
                      onBrowse={() => onBrowseCategory(cat)}
                      onExpand={() => setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                    />
                  ))}
              </div>
            );
          })
        )}
      </div>
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
  onToggle,
  onBrowse,
  onExpand,
}: {
  name: string;
  totalCount?: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onBrowse: () => void;
  onExpand: () => void;
}) {
  const { data: subcats } = api.commons.getSubcategories.useQuery(
    { category: name, limit: 20 },
    { enabled: isExpanded, staleTime: 5 * 60 * 1000 }
  );

  return (
    <div>
      <div className={`wikios-commons-cat-row ${isActive ? "wikios-commons-cat-row--active" : ""}`}>
        <button onClick={onExpand} className="wikios-commons-cat-expand">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button onClick={onBrowse} className="wikios-commons-cat-name" title={`Browse ${name}`}>
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
          {subcats.map((sub) => (
            <button
              key={sub}
              onClick={() => onBrowse()}
              className="wikios-commons-subcat"
              title={`Browse ${sub}`}
            >
              <Folder className="h-2.5 w-2.5 opacity-40" />
              {sub}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
