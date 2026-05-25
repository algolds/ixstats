"use client";

/**
 * EditorPanel — Right-side panel with tabbed navigation.
 *
 * Tabs:
 * 1. Properties (Settings2) — form fields for the active feature
 * 2. Layers (Layers) — placeholder for future layer management
 * 3. Features (List) — searchable feature list
 * 4. Wiki (BookOpen) — placeholder for wiki scanner
 *
 * Auto-switches to Properties on add/edit modes, Features on view mode.
 * User can manually override by clicking tabs.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, Settings2, Layers, List, BookOpen, Search } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { FeatureListSkeleton } from "~/components/maps/editor/EditorSkeleton";

const PANEL_MIN_W = 256;
const PANEL_MAX_W = 480;
const PANEL_DEFAULT_W = 320;
const PANEL_STORAGE_KEY = "ixworld-editor-panel-width";

type TabId = "properties" | "layers" | "features" | "wiki";

const TABS: { id: TabId; label: string; Icon: typeof Settings2 }[] = [
  { id: "properties", label: "Props", Icon: Settings2 },
  { id: "layers", label: "Layers", Icon: Layers },
  { id: "features", label: "List", Icon: List },
  { id: "wiki", label: "Wiki", Icon: BookOpen },
];

interface EditorPanelProps {
  /** Current editor mode — controls which tab auto-activates */
  mode: EditorMode;
  /** Whether the panel is collapsed (0-width) */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Content for each section (rendered by parent to avoid prop drilling) */
  propertiesContent: React.ReactNode;
  featureListContent: React.ReactNode;
  layersContent?: React.ReactNode;
  wikiContent?: React.ReactNode;
  /** Feature count for badge */
  featureCount?: number;
  /** Whether import wizard should take over the panel */
  importWizardContent?: React.ReactNode;
  /** Whether features are still loading */
  featuresLoading?: boolean;
}

export function EditorPanel({
  mode,
  collapsed,
  onToggleCollapse,
  propertiesContent,
  featureListContent,
  layersContent,
  wikiContent,
  featureCount,
  importWizardContent,
  featuresLoading,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("features");
  const userOverrideRef = useRef(false);

  // Panel resize
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_W;
    const stored = localStorage.getItem(PANEL_STORAGE_KEY);
    return stored
      ? Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, parseInt(stored)))
      : PANEL_DEFAULT_W;
  });
  const isDragging = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startW = panelWidth;
      const onMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX - me.clientX; // dragging left = wider
        const newW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, startW + delta));
        setPanelWidth(newW);
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        localStorage.setItem(PANEL_STORAGE_KEY, String(panelWidth));
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth]
  );

  // Auto-switch tabs based on mode (unless user manually overrode)
  useEffect(() => {
    // Reset override flag when mode changes
    userOverrideRef.current = false;

    if (mode.startsWith("add-") || mode.startsWith("edit-") || mode === "paint") {
      setActiveTab("properties");
    } else {
      setActiveTab("features");
    }
  }, [mode]);

  const handleTabClick = (tab: TabId) => {
    userOverrideRef.current = true;
    setActiveTab(tab);
  };

  // Import mode takes over the entire panel
  if (mode === "import-provinces" && importWizardContent) {
    return (
      <div className="relative flex">
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
        {!collapsed && (
          <div
            className="border-border bg-card flex h-full flex-col border-l"
            style={{ width: panelWidth }}
          >
            {/* Resize handle */}
            <div
              className="hover:bg-primary/30 active:bg-primary/50 absolute top-0 left-0 z-20 h-full w-1 cursor-col-resize transition-colors"
              onMouseDown={handleResizeStart}
            />
            {importWizardContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex">
      <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />

      {!collapsed && (
        <div
          className="border-border bg-card flex h-full flex-col border-l"
          style={{ width: panelWidth }}
        >
          {/* Resize handle */}
          <div
            className="hover:bg-primary/30 active:bg-primary/50 absolute top-0 left-0 z-20 h-full w-1 cursor-col-resize transition-colors"
            onMouseDown={handleResizeStart}
          />
          {/* Tab bar — compact 32px height */}
          <div className="border-border bg-muted/30 flex h-8 shrink-0 border-b">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-card text-foreground border-b-2"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <tab.Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === "features" && featureCount !== undefined && featureCount > 0 && (
                    <span className="bg-muted rounded-full px-1 text-[9px] tabular-nums">
                      {featureCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content — fills remaining space with crossfade */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div key={activeTab} style={{ animation: "editorTabFadeIn 150ms ease" }}>
              {activeTab === "properties" && <div className="px-3 py-3">{propertiesContent}</div>}
              {activeTab === "layers" && (
                <div className="flex min-h-0 flex-1 flex-col">
                  {layersContent ?? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center px-3 py-8 text-xs">
                      Layers panel coming soon
                    </div>
                  )}
                </div>
              )}
              {activeTab === "features" && (
                <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                  {featuresLoading ? <FeatureListSkeleton /> : featureListContent}
                </div>
              )}
              {activeTab === "wiki" && (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {wikiContent ?? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center px-3 py-8 text-xs">
                      Wiki scanner coming soon
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes editorTabFadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CollapseToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="bg-card border-border text-muted-foreground hover:text-foreground absolute top-1/2 -left-3 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 transition-colors"
      title={collapsed ? "Show panel" : "Hide panel"}
    >
      {collapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
    </button>
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
      <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter features..."
        className="border-border bg-background focus:ring-primary w-full rounded-md border py-1 pr-2 pl-7 text-xs outline-none focus:ring-1"
      />
    </div>
  );
}
