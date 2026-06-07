"use client";

/**
 * EditorPanel — Sidebar panel supporting left or right orientation with tabbed navigation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronRight, ChevronLeft, Settings2, Layers, List, BookOpen, Search } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { FeatureListSkeleton } from "~/components/maps/editor/EditorSkeleton";

const PANEL_MIN_W = 256;
const PANEL_MAX_W = 480;
const PANEL_DEFAULT_W = 320;
const PANEL_STORAGE_KEY = "ixworld-editor-panel-width";

export type TabId = "properties" | "layers" | "features" | "wiki";

const LEFT_TABS = [
  { id: "layers" as const, label: "Layers", Icon: Layers },
  { id: "features" as const, label: "Features", Icon: List },
  { id: "wiki" as const, label: "Wiki Scan", Icon: BookOpen },
];

const RIGHT_TABS = [
  { id: "properties" as const, label: "Props", Icon: Settings2 },
];

interface EditorPanelProps {
  /** Current editor mode — controls which tab auto-activates */
  mode: EditorMode;
  /** Whether the panel is collapsed (0-width) */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Content for each section */
  propertiesContent?: React.ReactNode;
  featureListContent?: React.ReactNode;
  layersContent?: React.ReactNode;
  wikiContent?: React.ReactNode;
  /** Feature count for badge */
  featureCount?: number;
  /** Whether import wizard should take over the panel */
  importWizardContent?: React.ReactNode;
  /** Whether features are still loading */
  featuresLoading?: boolean;
  /** Which side the panel resides on: "left" | "right" */
  side?: "left" | "right";
  /** Override active tab */
  activeTabOverride?: TabId;
  onTabChange?: (tab: TabId) => void;
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
  side = "right",
  activeTabOverride,
  onTabChange,
}: EditorPanelProps) {
  const defaultTab = side === "left" ? "features" : "properties";
  const [activeTab, setActiveTab] = useState<TabId>(activeTabOverride || defaultTab);
  const userOverrideRef = useRef(false);

  // Sync tab if overridden
  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Panel resize
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_W;
    const stored = localStorage.getItem(`${PANEL_STORAGE_KEY}-${side}`);
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
        // Dragging right makes left panel wider; dragging left makes right panel wider
        const delta = side === "left" ? me.clientX - startX : startX - me.clientX;
        const newW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, startW + delta));
        setPanelWidth(newW);
      };
      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        localStorage.setItem(`${PANEL_STORAGE_KEY}-${side}`, String(panelWidth));
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth, side]
  );

  // Auto-switch tabs based on mode (for right properties panel, unless user manually overrode)
  useEffect(() => {
    if (side === "left") {
      // Keep left panel on features/layers as set by user, don't auto-switch to properties
      return;
    }
    userOverrideRef.current = false;
    if (mode.startsWith("add-") || mode.startsWith("edit-") || mode === "paint") {
      setActiveTab("properties");
    } else {
      setActiveTab("properties");
    }
  }, [mode, side]);

  const handleTabClick = (tab: TabId) => {
    userOverrideRef.current = true;
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const tabs = side === "left" ? LEFT_TABS : RIGHT_TABS;

  // Import mode takes over the entire panel (only applicable to left feature panel in unified layout)
  if (side === "left" && mode === "import-provinces" && importWizardContent) {
    return (
      <div className="relative flex h-full">
        {!collapsed && (
          <div
            className="border-border bg-card/75 backdrop-blur-md flex h-full flex-col border-r shadow-lg relative"
            style={{ width: panelWidth }}
          >
            {/* Resize handle */}
            <div
              className="hover:bg-primary/30 active:bg-primary/50 absolute top-0 right-0 z-20 h-full w-1 cursor-col-resize transition-colors"
              onMouseDown={handleResizeStart}
            />
            {importWizardContent}
          </div>
        )}
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} side={side} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      {side === "right" && (
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} side={side} />
      )}

      {!collapsed && (
        <div
          className={`border-border bg-card/75 backdrop-blur-md flex h-full flex-col shadow-lg relative ${
            side === "left" ? "border-r" : "border-l"
          }`}
          style={{ width: panelWidth }}
        >
          {/* Resize handle */}
          <div
            className={`hover:bg-primary/30 active:bg-primary/50 absolute top-0 z-20 h-full w-1 cursor-col-resize transition-colors ${
              side === "left" ? "right-0" : "left-0"
            }`}
            onMouseDown={handleResizeStart}
          />
          {/* Tab bar — compact 32px height */}
          <div className="border-border bg-muted/20 flex h-8 shrink-0 border-b">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-card/40 text-foreground border-b-2"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                >
                  <tab.Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === "features" && featureCount !== undefined && featureCount > 0 && (
                    <span className="bg-muted text-muted-foreground rounded-full px-1 text-[9px] tabular-nums">
                      {featureCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content — fills remaining space with crossfade */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div key={activeTab} className="h-full" style={{ animation: "editorTabFadeIn 150ms ease" }}>
              {activeTab === "properties" && propertiesContent && (
                <div className="px-3 py-3 h-full">{propertiesContent}</div>
              )}
              {activeTab === "layers" && (
                <div className="flex min-h-0 flex-1 flex-col h-full">
                  {layersContent ?? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center px-3 py-8 text-xs">
                      Layers panel coming soon
                    </div>
                  )}
                </div>
              )}
              {activeTab === "features" && featureListContent && (
                <div className="flex min-h-0 flex-1 flex-col px-3 py-3 h-full">
                  {featuresLoading ? <FeatureListSkeleton /> : featureListContent}
                </div>
              )}
              {activeTab === "wiki" && (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto h-full">
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

      {side === "left" && (
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} side={side} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CollapseToggle({
  collapsed,
  onToggle,
  side = "right",
}: {
  collapsed: boolean;
  onToggle: () => void;
  side?: "left" | "right";
}) {
  const positionClass =
    side === "left" ? "-right-3 rounded-r-md border-l-0" : "-left-3 rounded-l-md border-r-0";
  return (
    <button
      onClick={onToggle}
      className={`bg-card/75 border-border text-muted-foreground hover:text-foreground absolute top-1/2 z-10 flex h-6 w-3 -translate-y-1/2 items-center justify-center border transition-colors ${positionClass} backdrop-blur-sm shadow-md`}
      title={collapsed ? "Show panel" : "Hide panel"}
    >
      {side === "left" ? (
        collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />
      ) : (
        collapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
      )}
    </button>
  );
}

/**
 * SearchableFeatureList — wraps FeatureList with a search filter input.
 * Used as the content for the Features section.
 */
export function FeatureSearchFilter({
  value,
  onChangeAction,
}: {
  value: string;
  onChangeAction: (value: string) => void;
}) {
  return (
    <div className="relative mb-2">
      <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeAction(e.target.value)}
        placeholder="Filter features..."
        className="border-border bg-background focus:ring-primary w-full rounded-md border py-1 pr-2 pl-7 text-xs outline-none focus:ring-1"
      />
    </div>
  );
}
