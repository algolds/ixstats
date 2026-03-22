"use client";

/**
 * EditorPanel — Right-side panel with collapsible accordion sections.
 *
 * Sections:
 * 1. Properties — form fields for the active feature (auto-expands on add/edit)
 * 2. Features — searchable feature list (auto-expands in view mode)
 * 3. Wiki — conflict detection + auto-linker (collapsed by default)
 *
 * Panel can be collapsed entirely via the edge toggle button.
 */

import { useState, useEffect, useCallback } from "react";
import {
  ChevronRight, ChevronLeft, ChevronDown,
  Settings2, List, BookOpen, Search,
} from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface EditorPanelProps {
  /** Current editor mode — controls which sections auto-expand */
  mode: EditorMode;
  /** Whether the panel is collapsed (0-width) */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Content for each section (rendered by parent to avoid prop drilling) */
  propertiesContent: React.ReactNode;
  featureListContent: React.ReactNode;
  wikiContent?: React.ReactNode;
  /** Feature count for badge */
  featureCount?: number;
  /** Whether import wizard should take over the panel */
  importWizardContent?: React.ReactNode;
}

type SectionId = "properties" | "features" | "wiki";

export function EditorPanel({
  mode,
  collapsed,
  onToggleCollapse,
  propertiesContent,
  featureListContent,
  wikiContent,
  featureCount,
  importWizardContent,
}: EditorPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(["properties"])
  );

  // Contextual auto-expand based on active tool
  useEffect(() => {
    setExpandedSections(() => {
      const next = new Set<SectionId>();
      // Features list is always expanded (pinned at bottom)
      next.add("features");
      if (mode.startsWith("add-") || mode.startsWith("edit-") || mode === "paint") {
        // Tool active: also show properties panel at top
        next.add("properties");
      }
      return next;
    });
  }, [mode]);

  const toggleSection = useCallback((id: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Import mode takes over the entire panel
  if (mode === "import-provinces" && importWizardContent) {
    return (
      <div className="relative flex">
        {/* Collapse toggle */}
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />

        {!collapsed && (
          <div className="flex h-full w-72 flex-col border-l border-border bg-card lg:w-80">
            {importWizardContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex">
      {/* Collapse toggle button on the panel edge */}
      <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />

      {!collapsed && (
        <div className="flex h-full w-72 flex-col border-l border-border bg-card lg:w-80">
          {/* ── Top zone: Properties + Wiki (scrollable, shrinks when tool active) ── */}
          {(mode.startsWith("add-") || mode.startsWith("edit-") || mode === "paint") && (
            <div className="shrink-0 overflow-y-auto border-b border-border" style={{ maxHeight: "60%" }}>
              <PanelSection
                title="Properties"
                icon={<Settings2 className="h-3.5 w-3.5" />}
                expanded={expandedSections.has("properties")}
                onToggle={() => toggleSection("properties")}
              >
                {propertiesContent}
              </PanelSection>

              {wikiContent && (
                <PanelSection
                  title="Wiki Scanner"
                  icon={<BookOpen className="h-3.5 w-3.5" />}
                  expanded={expandedSections.has("wiki")}
                  onToggle={() => toggleSection("wiki")}
                >
                  {wikiContent}
                </PanelSection>
              )}
            </div>
          )}

          {/* ── Bottom zone: Features list (fills remaining space, always visible) ── */}
          <div className="flex min-h-0 flex-1 flex-col">
            <PanelSection
              title="Features"
              icon={<List className="h-3.5 w-3.5" />}
              badge={featureCount}
              expanded={expandedSections.has("features")}
              onToggle={() => toggleSection("features")}
              fillHeight
            >
              {featureListContent}
            </PanelSection>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="absolute -left-3 top-1/2 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center rounded-l-md bg-card border border-r-0 border-border text-muted-foreground hover:text-foreground transition-colors"
      title={collapsed ? "Show panel" : "Hide panel"}
    >
      {collapsed ? (
        <ChevronLeft className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
    </button>
  );
}

function PanelSection({
  title,
  icon,
  badge,
  expanded,
  onToggle,
  children,
  fillHeight,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** When true, section content fills remaining vertical space with internal scroll */
  fillHeight?: boolean;
}) {
  return (
    <div className={`border-b border-border last:border-b-0 ${fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      {/* Section header */}
      <button
        onClick={onToggle}
        className="flex w-full shrink-0 items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${
            expanded ? "" : "-rotate-90"
          }`}
        />
        {icon}
        <span className="flex-1 text-xs font-semibold text-foreground">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {badge}
          </span>
        )}
      </button>

      {/* Section content */}
      {expanded && (
        <div className={fillHeight ? "min-h-0 flex-1 overflow-y-auto px-3 pb-3" : "px-3 pb-3"}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * SearchableFeatureList — wraps FeatureList with a search filter input.
 * Used as the content for the Features section.
 */
export function FeatureSearchFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative mb-2">
      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter features..."
        className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
