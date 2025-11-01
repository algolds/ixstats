"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Layers,
  Eye,
  EyeOff,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Crown,
  Building2,
  Home,
  House,
  RotateCcw,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  poiTaxonomy,
  type POIMainCategoryKey,
  getMainCategories,
  getSubcategories,
} from "~/lib/poi-taxonomy";

/**
 * LayerControls Component Props
 * Comprehensive layer management for map editor
 */
interface LayerControlsProps {
  /** Visibility state for each layer type */
  layers: {
    boundaries: boolean;
    subdivisions: boolean;
    cities: boolean;
    pois: boolean;
  };
  /** Callback when layer visibility changes */
  onLayerToggle: (layer: keyof LayerControlsProps["layers"], visible: boolean) => void;
  /** Active subdivision levels (1-5) */
  subdivisionLevel?: number[];
  /** Callback when subdivision level filter changes */
  onSubdivisionLevelChange?: (levels: number[]) => void;
  /** Active city types */
  cityTypes?: string[];
  /** Callback when city type filter changes */
  onCityTypeChange?: (types: string[]) => void;
  /** Active POI categories */
  poiCategories?: string[];
  /** Callback when POI category filter changes */
  onPoiCategoryChange?: (categories: string[]) => void;
  /** Opacity settings for each layer (0-100) */
  opacity?: Record<string, number>;
  /** Callback when layer opacity changes */
  onOpacityChange?: (layer: string, opacity: number) => void;
}

/**
 * City type definitions with icons
 */
const CITY_TYPES = [
  { value: "capital", label: "Capital", icon: Crown },
  { value: "city", label: "City", icon: Building2 },
  { value: "town", label: "Town", icon: Home },
  { value: "village", label: "Village", icon: House },
] as const;

/**
 * Subdivision level definitions
 */
const SUBDIVISION_LEVELS = [
  { level: 1, label: "Level 1 (States/Provinces)" },
  { level: 2, label: "Level 2 (Counties/Districts)" },
  { level: 3, label: "Level 3 (Municipalities)" },
  { level: 4, label: "Level 4 (Boroughs)" },
  { level: 5, label: "Level 5 (Neighborhoods)" },
] as const;

/**
 * LayerControls Component
 *
 * Comprehensive layer management panel for the IxStats map editor.
 * Features include:
 * - Layer visibility toggles
 * - Subdivision level filtering
 * - City type filtering
 * - POI category filtering with subcategory expansion
 * - Layer opacity controls
 * - Quick actions (show all, hide all, reset)
 * - Responsive design with collapsible panel
 * - Glass physics design system integration
 * - Full accessibility support
 */
export function LayerControls({
  layers,
  onLayerToggle,
  subdivisionLevel = [1, 2, 3, 4, 5],
  onSubdivisionLevelChange,
  cityTypes = ["capital", "city", "town", "village"],
  onCityTypeChange,
  poiCategories = [],
  onPoiCategoryChange,
  opacity = {
    boundaries: 100,
    subdivisions: 100,
    cities: 100,
    pois: 100,
  },
  onOpacityChange,
}: LayerControlsProps) {
  // Panel state
  const [isOpen, setIsOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["visibility", "subdivisions", "cities", "pois", "opacity"])
  );
  const [expandedPOICategories, setExpandedPOICategories] = useState<Set<string>>(new Set());
  const [poiSearchQuery, setPoiSearchQuery] = useState("");

  // Get POI categories
  const mainCategories = useMemo(() => getMainCategories(), []);

  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  /**
   * Toggle POI category expansion
   */
  const togglePOICategory = useCallback((category: string) => {
    setExpandedPOICategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  /**
   * Handle subdivision level toggle
   */
  const handleSubdivisionLevelToggle = useCallback(
    (level: number) => {
      if (!onSubdivisionLevelChange) return;

      const newLevels = subdivisionLevel.includes(level)
        ? subdivisionLevel.filter((l) => l !== level)
        : [...subdivisionLevel, level].sort();

      onSubdivisionLevelChange(newLevels);
    },
    [subdivisionLevel, onSubdivisionLevelChange]
  );

  /**
   * Handle city type toggle
   */
  const handleCityTypeToggle = useCallback(
    (type: string) => {
      if (!onCityTypeChange) return;

      const newTypes = cityTypes.includes(type)
        ? cityTypes.filter((t) => t !== type)
        : [...cityTypes, type];

      onCityTypeChange(newTypes);
    },
    [cityTypes, onCityTypeChange]
  );

  /**
   * Handle POI category toggle
   */
  const handlePOICategoryToggle = useCallback(
    (category: string) => {
      if (!onPoiCategoryChange) return;

      const newCategories = poiCategories.includes(category)
        ? poiCategories.filter((c) => c !== category)
        : [...poiCategories, category];

      onPoiCategoryChange(newCategories);
    },
    [poiCategories, onPoiCategoryChange]
  );

  /**
   * Handle opacity change
   */
  const handleOpacityChange = useCallback(
    (layer: string, value: number) => {
      if (!onOpacityChange) return;
      onOpacityChange(layer, value);
    },
    [onOpacityChange]
  );

  /**
   * Quick Actions
   */
  const showAllLayers = useCallback(() => {
    onLayerToggle("boundaries", true);
    onLayerToggle("subdivisions", true);
    onLayerToggle("cities", true);
    onLayerToggle("pois", true);
  }, [onLayerToggle]);

  const hideAllLayers = useCallback(() => {
    onLayerToggle("boundaries", false);
    onLayerToggle("subdivisions", false);
    onLayerToggle("cities", false);
    onLayerToggle("pois", false);
  }, [onLayerToggle]);

  const resetToDefault = useCallback(() => {
    showAllLayers();
    onSubdivisionLevelChange?.([1, 2, 3, 4, 5]);
    onCityTypeChange?.(["capital", "city", "town", "village"]);
    onPoiCategoryChange?.(mainCategories.map((c) => c.key as string));
    if (onOpacityChange) {
      onOpacityChange("boundaries", 100);
      onOpacityChange("subdivisions", 100);
      onOpacityChange("cities", 100);
      onOpacityChange("pois", 100);
    }
  }, [showAllLayers, onSubdivisionLevelChange, onCityTypeChange, onPoiCategoryChange, onOpacityChange, mainCategories]);

  /**
   * Select/Clear all helpers
   */
  const selectAllSubdivisionLevels = useCallback(() => {
    onSubdivisionLevelChange?.([1, 2, 3, 4, 5]);
  }, [onSubdivisionLevelChange]);

  const clearAllSubdivisionLevels = useCallback(() => {
    onSubdivisionLevelChange?.([]);
  }, [onSubdivisionLevelChange]);

  const selectAllCityTypes = useCallback(() => {
    onCityTypeChange?.(["capital", "city", "town", "village"]);
  }, [onCityTypeChange]);

  const clearAllCityTypes = useCallback(() => {
    onCityTypeChange?.([]);
  }, [onCityTypeChange]);

  const selectAllPOICategories = useCallback(() => {
    onPoiCategoryChange?.(mainCategories.map((c) => c.key as string));
  }, [onPoiCategoryChange, mainCategories]);

  const clearAllPOICategories = useCallback(() => {
    onPoiCategoryChange?.([]);
  }, [onPoiCategoryChange]);

  /**
   * Filter subcategories by search query
   */
  const filteredSubcategories = useMemo(() => {
    if (!poiSearchQuery) return null;

    const query = poiSearchQuery.toLowerCase();
    const results: Array<{ category: POIMainCategoryKey; subcategory: string; label: string }> = [];

    mainCategories.forEach((mainCat) => {
      const subcats = getSubcategories(mainCat.key);
      subcats.forEach((subcat: any) => {
        if (subcat.label.toLowerCase().includes(query)) {
          results.push({
            category: mainCat.key,
            subcategory: subcat.key,
            label: subcat.label,
          });
        }
      });
    });

    return results;
  }, [poiSearchQuery, mainCategories]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 top-24 z-10 glass-interactive rounded-lg p-3 shadow-lg transition-all duration-200 hover:scale-105"
        aria-label={isOpen ? "Close layer controls" : "Open layer controls"}
        aria-expanded={isOpen}
      >
        <Layers className="h-5 w-5 text-blue-600" />
      </button>

      {/* Layer Controls Panel */}
      <div
        className={`fixed right-4 top-40 z-10 w-80 max-w-[calc(100vw-2rem)] transform transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0 pointer-events-none"
        }`}
        role="region"
        aria-label="Layer controls panel"
      >
        <div className="glass-panel max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Layer Controls</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 hover:bg-gray-100 transition-colors"
              aria-label="Close panel"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={showAllLayers}
                className="flex-1 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                aria-label="Show all layers"
              >
                Show All
              </button>
              <button
                onClick={hideAllLayers}
                className="flex-1 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Hide all layers"
              >
                Hide All
              </button>
            </div>
            <button
              onClick={resetToDefault}
              className="flex items-center justify-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Reset to default settings"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </button>
          </div>

          {/* Layer Visibility Section */}
          <Section
            title="Layer Visibility"
            isExpanded={expandedSections.has("visibility")}
            onToggle={() => toggleSection("visibility")}
          >
            <div className="space-y-2">
              {Object.entries(layers).map(([key, visible]) => (
                <LayerToggle
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  visible={visible}
                  onToggle={(v) => onLayerToggle(key as keyof typeof layers, v)}
                />
              ))}
            </div>
          </Section>

          {/* Subdivisions Section */}
          {layers.subdivisions && (
            <Section
              title="Subdivision Levels"
              isExpanded={expandedSections.has("subdivisions")}
              onToggle={() => toggleSection("subdivisions")}
            >
              <div className="mb-2 flex justify-end gap-2">
                <button
                  onClick={selectAllSubdivisionLevels}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  aria-label="Select all subdivision levels"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-400">|</span>
                <button
                  onClick={clearAllSubdivisionLevels}
                  className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                  aria-label="Clear all subdivision levels"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {SUBDIVISION_LEVELS.map(({ level, label }) => (
                  <Checkbox
                    key={level}
                    label={label}
                    checked={subdivisionLevel.includes(level)}
                    onToggle={() => handleSubdivisionLevelToggle(level)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Cities Section */}
          {layers.cities && (
            <Section
              title="City Types"
              isExpanded={expandedSections.has("cities")}
              onToggle={() => toggleSection("cities")}
            >
              <div className="mb-2 flex justify-end gap-2">
                <button
                  onClick={selectAllCityTypes}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  aria-label="Select all city types"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-400">|</span>
                <button
                  onClick={clearAllCityTypes}
                  className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                  aria-label="Clear all city types"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2">
                {CITY_TYPES.map(({ value, label, icon: Icon }) => (
                  <Checkbox
                    key={value}
                    label={label}
                    checked={cityTypes.includes(value)}
                    onToggle={() => handleCityTypeToggle(value)}
                    icon={<Icon className="h-4 w-4" />}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* POIs Section */}
          {layers.pois && (
            <Section
              title="Points of Interest"
              isExpanded={expandedSections.has("pois")}
              onToggle={() => toggleSection("pois")}
            >
              <div className="mb-3 flex justify-end gap-2">
                <button
                  onClick={selectAllPOICategories}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  aria-label="Select all POI categories"
                >
                  Select All
                </button>
                <span className="text-xs text-gray-400">|</span>
                <button
                  onClick={clearAllPOICategories}
                  className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                  aria-label="Clear all POI categories"
                >
                  Clear All
                </button>
              </div>

              {/* POI Search */}
              <div className="mb-3 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search subcategories..."
                  value={poiSearchQuery}
                  onChange={(e) => setPoiSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  aria-label="Search POI subcategories"
                />
                {poiSearchQuery && (
                  <button
                    onClick={() => setPoiSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {filteredSubcategories && filteredSubcategories.length > 0 ? (
                <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-2">
                  <div className="mb-1 text-xs font-medium text-blue-900">
                    Search Results ({filteredSubcategories.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {filteredSubcategories.map((result) => (
                      <div
                        key={`${result.category}-${result.subcategory}`}
                        className="text-xs text-gray-700 px-2 py-1 hover:bg-blue-100 rounded"
                      >
                        <span className="font-medium">{result.label}</span>
                        <span className="text-gray-500 ml-1">
                          ({poiTaxonomy[result.category].label})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : poiSearchQuery ? (
                <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-center text-xs text-gray-500">
                  No subcategories found
                </div>
              ) : null}

              {/* POI Categories */}
              <div className="space-y-2">
                {mainCategories.map((category) => {
                  const subcategories = getSubcategories(category.key);
                  const isExpanded = expandedPOICategories.has(category.key as string);
                  const isChecked = poiCategories.includes(category.key as string);

                  return (
                    <div key={category.key} className="rounded-md border border-gray-200">
                      <div className="flex items-center gap-2 p-2">
                        <Checkbox
                          label={category.label}
                          checked={isChecked}
                          onToggle={() => handlePOICategoryToggle(category.key as string)}
                          colorIndicator={category.color}
                        />
                        <button
                          onClick={() => togglePOICategory(category.key as string)}
                          className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
                          aria-label={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>

                      {/* Subcategories */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50 p-2 space-y-1">
                          <div className="text-xs font-medium text-gray-600 mb-1">
                            {subcategories.length} subcategories
                          </div>
                          <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                            {subcategories.map((subcat: any) => (
                              <div
                                key={subcat.key}
                                className="text-xs text-gray-700 px-2 py-1 hover:bg-gray-100 rounded"
                              >
                                {subcat.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Opacity Section */}
          <Section
            title="Layer Opacity"
            isExpanded={expandedSections.has("opacity")}
            onToggle={() => toggleSection("opacity")}
          >
            <div className="space-y-3">
              {Object.entries(layers).map(([key, visible]) => (
                <OpacitySlider
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={opacity[key] ?? 100}
                  onChange={(v) => handleOpacityChange(key, v)}
                  disabled={!visible}
                />
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

/**
 * Collapsible Section Component
 */
interface SectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, isExpanded, onToggle, children }: SectionProps) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white/50">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
        aria-expanded={isExpanded}
      >
        <span className="font-medium text-gray-900">{title}</span>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isExpanded && <div className="p-3 pt-0">{children}</div>}
    </div>
  );
}

/**
 * Layer Toggle Component
 */
interface LayerToggleProps {
  label: string;
  visible: boolean;
  onToggle: (visible: boolean) => void;
}

function LayerToggle({ label, visible, onToggle }: LayerToggleProps) {
  return (
    <button
      onClick={() => onToggle(!visible)}
      className={`flex w-full items-center gap-3 rounded-md p-2 transition-all ${
        visible
          ? "glass-interactive bg-blue-50 text-blue-900"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
      }`}
      aria-label={`${visible ? "Hide" : "Show"} ${label} layer`}
      aria-pressed={visible}
    >
      {visible ? (
        <Eye className="h-5 w-5 text-blue-600" />
      ) : (
        <EyeOff className="h-5 w-5 text-gray-400" />
      )}
      <span className="font-medium">{label}</span>
    </button>
  );
}

/**
 * Checkbox Component
 */
interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  colorIndicator?: string;
}

function Checkbox({ label, checked, onToggle, icon, colorIndicator }: CheckboxProps) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-gray-100 transition-colors"
      aria-label={`${checked ? "Uncheck" : "Check"} ${label}`}
      aria-pressed={checked}
      role="checkbox"
      aria-checked={checked}
    >
      {checked ? (
        <CheckSquare className="h-5 w-5 flex-shrink-0 text-blue-600" />
      ) : (
        <Square className="h-5 w-5 flex-shrink-0 text-gray-400" />
      )}
      {icon && <div className="flex-shrink-0 text-gray-600">{icon}</div>}
      {colorIndicator && (
        <div
          className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: colorIndicator }}
          aria-label={`Color indicator for ${label}`}
        />
      )}
      <span className="text-sm text-gray-900">{label}</span>
    </button>
  );
}

/**
 * Opacity Slider Component
 */
interface OpacitySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function OpacitySlider({ label, value, onChange, disabled = false }: OpacitySliderProps) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{value}%</span>
          {value !== 100 && !disabled && (
            <button
              onClick={() => onChange(100)}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
              aria-label={`Reset ${label} opacity to 100%`}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${label} opacity slider`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        style={{
          background: disabled
            ? "#e5e7eb"
            : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)`,
        }}
      />
    </div>
  );
}

// Add CSS for range input styling
const rangeInputStyles = `
  .slider-thumb::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
  }

  .slider-thumb::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  }

  .slider-thumb::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all 0.2s;
  }

  .slider-thumb::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  }

  .slider-thumb:disabled::-webkit-slider-thumb {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .slider-thumb:disabled::-moz-range-thumb {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;

// Inject styles into document
if (typeof document !== "undefined") {
  const styleId = "layer-controls-styles";
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = rangeInputStyles;
    document.head.appendChild(styleEl);
  }
}
