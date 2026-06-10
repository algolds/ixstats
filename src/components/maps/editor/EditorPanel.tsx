"use client";

/**
 * EditorPanel — Sidebar/Bottom panel supporting left, right, and bottom orientation with tabbed navigation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Settings2,
  Layers,
  List,
  BookOpen,
  Search,
  Globe,
  Link as LinkIcon,
  Layout,
} from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { FeatureListSkeleton } from "~/components/maps/editor/EditorSkeleton";

const PANEL_MIN_W = 256;
const PANEL_MAX_W = 480;
const PANEL_DEFAULT_W = 320;
const PANEL_STORAGE_KEY = "ixworld-editor-panel-size";

export type TabId = "properties" | "layers" | "features" | "wiki" | "linkages" | "sovereignty";

const TAB_DEFS: Record<TabId, { label: string; Icon: React.ComponentType<any> }> = {
  layers: { label: "Layers", Icon: Layers },
  features: { label: "Features", Icon: List },
  properties: { label: "Properties", Icon: Settings2 },
  linkages: { label: "Links", Icon: LinkIcon },
  sovereignty: { label: "Sovereign", Icon: Globe },
  wiki: { label: "Wiki", Icon: BookOpen },
};

interface EditorPanelProps {
  /** Current editor mode — controls which tab auto-activates */
  mode: EditorMode;
  /** Whether the panel is collapsed */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Tabs to show in this panel */
  tabs: TabId[];
  /** Callback when a tab is dragged and dropped onto this panel */
  onTabDrop?: (tabId: TabId) => void;
  /** Placement: left sidebar, right sidebar, or bottom horizontal pane */
  placement?: "left" | "right" | "bottom";
  /** Callback to change docking placement */
  onChangePlacement?: (placement: "left" | "right" | "bottom") => void;
  /** Content for each section */
  propertiesContent?: React.ReactNode;
  featureListContent?: React.ReactNode;
  layersContent?: React.ReactNode;
  wikiContent?: React.ReactNode;
  linkagesContent?: React.ReactNode;
  sovereigntyContent?: React.ReactNode;
  /** Feature count for badge */
  featureCount?: number;
  /** Whether import wizard should take over the panel */
  importWizardContent?: React.ReactNode;
  /** Whether features are still loading */
  featuresLoading?: boolean;
  /** Override active tab */
  activeTabOverride?: TabId;
  onTabChange?: (tab: TabId) => void;
  isWorldMode?: boolean;
  isStacked?: boolean;
}

export function EditorPanel({
  mode,
  collapsed,
  onToggleCollapse,
  tabs,
  onTabDrop,
  placement = "right",
  onChangePlacement,
  propertiesContent,
  featureListContent,
  layersContent,
  wikiContent,
  linkagesContent,
  sovereigntyContent,
  featureCount,
  importWizardContent,
  featuresLoading,
  activeTabOverride,
  onTabChange,
  isWorldMode = false,
  isStacked = false,
}: EditorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (activeTabOverride) return activeTabOverride;
    if (tabs.length > 0) return tabs[0];
    return placement === "left" ? (isWorldMode ? "linkages" : "features") : "properties";
  });

  const userOverrideRef = useRef(false);

  // Sync tab if overridden
  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Keep activeTab in sync with available tabs in this panel
  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);

  // Panel size states
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT_W;
    const stored = localStorage.getItem(`${PANEL_STORAGE_KEY}-width`);
    return stored
      ? Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, parseInt(stored)))
      : PANEL_DEFAULT_W;
  });

  const [panelHeight, setPanelHeight] = useState(() => {
    if (typeof window === "undefined") return 240;
    const stored = localStorage.getItem(`${PANEL_STORAGE_KEY}-height`);
    return stored
      ? Math.min(500, Math.max(120, parseInt(stored)))
      : 240;
  });

  useEffect(() => {
    localStorage.setItem(`${PANEL_STORAGE_KEY}-width`, String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    localStorage.setItem(`${PANEL_STORAGE_KEY}-height`, String(panelHeight));
  }, [panelHeight]);

  const isDragging = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panelWidth;
      const startH = panelHeight;

      const onMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        if (placement === "bottom") {
          const delta = startY - me.clientY;
          const newH = Math.min(500, Math.max(120, startH + delta));
          setPanelHeight(newH);
        } else {
          const delta = placement === "left" ? me.clientX - startX : startX - me.clientX;
          const newW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, startW + delta));
          setPanelWidth(newW);
        }
      };

      const onUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth, panelHeight, placement]
  );

  // Auto-switch tabs based on mode (for properties tab)
  useEffect(() => {
    if (userOverrideRef.current) return;
    if (mode.startsWith("add-") || mode.startsWith("edit-") || mode === "paint") {
      if (tabs.includes("properties")) {
        setActiveTab("properties");
      }
    }
  }, [mode, tabs]);

  const handleTabClick = (tab: TabId) => {
    userOverrideRef.current = true;
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  if (collapsed && isStacked) {
    return (
      <div
        className={`border-border bg-card/75 flex shrink-0 items-center justify-between px-2 py-1.5 backdrop-blur-md ${
          placement === "bottom"
            ? "h-9 w-32 border rounded-md"
            : "h-9 w-full border-b border-t"
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {tabs.map((tabId) => {
            const tabDef = TAB_DEFS[tabId];
            if (!tabDef) return null;
            return (
              <tabDef.Icon
                key={tabId}
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                title={tabDef.label}
              />
            );
          })}
        </div>
        <button
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-accent/40 transition-colors shrink-0"
          title="Expand Panel"
        >
          {placement === "bottom" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    );
  }

  // Import mode takes over the entire panel (only if features tab exists here)
  if (mode === "import-provinces" && importWizardContent && tabs.includes("features")) {
    return (
      <div className="relative flex h-full">
        {!collapsed && (
          <div
            className="border-border bg-card/75 relative flex flex-col border-r shadow-lg backdrop-blur-md"
            style={{
              width: placement === "bottom" ? "100%" : panelWidth,
              height: placement === "bottom" ? panelHeight : "100%",
            }}
          >
            {/* Resize handle */}
            <div
              className={`hover:bg-primary/30 active:bg-primary/50 absolute z-20 transition-colors ${
                placement === "bottom"
                  ? "top-0 left-0 w-full h-1 cursor-row-resize"
                  : placement === "left"
                    ? "top-0 right-0 h-full w-1 cursor-col-resize"
                    : "top-0 left-0 h-full w-1 cursor-col-resize"
              }`}
              onMouseDown={handleResizeStart}
            />
            {importWizardContent}
          </div>
        )}
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} placement={placement} />
      </div>
    );
  }

  // Render empty slot placeholder if no tabs are here
  if (tabs.length === 0) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const tabId = e.dataTransfer.getData("tabId") as TabId;
          if (tabId && onTabDrop) {
            onTabDrop(tabId);
          }
        }}
        className={`border-dashed border-2 border-border/40 bg-card/20 flex flex-col items-center justify-center p-4 text-[11px] text-muted-foreground rounded-lg m-2 backdrop-blur-sm transition-colors hover:border-primary/40`}
        style={{
          width: placement === "bottom" ? "100%" : 140,
          height: placement === "bottom" ? 80 : "100%",
        }}
      >
        <Layout className="h-4 w-4 mb-1 text-muted-foreground/60" />
        <span>Drag tab here</span>
        {onChangePlacement && (
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => onChangePlacement("left")}
              className={`p-0.5 rounded ${placement === "left" ? "text-primary bg-primary/10" : "hover:text-foreground"}`}
              title="Dock Left"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => onChangePlacement("bottom")}
              className={`p-0.5 rounded ${placement === "bottom" ? "text-primary bg-primary/10" : "hover:text-foreground"}`}
              title="Dock Bottom"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => onChangePlacement("right")}
              className={`p-0.5 rounded ${placement === "right" ? "text-primary bg-primary/10" : "hover:text-foreground"}`}
              title="Dock Right"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative flex ${placement === "bottom" ? "w-full flex-col" : "h-full"}`}>
      {placement === "right" && (
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} placement={placement} />
      )}

      {!collapsed && (
        <div
          className={`border-border bg-card/75 relative flex flex-col shadow-lg backdrop-blur-md ${
            placement === "bottom"
              ? "border-t w-full"
              : placement === "left"
                ? "border-r h-full"
                : "border-l h-full"
          }`}
          style={{
            width: placement === "bottom" ? "100%" : panelWidth,
            height: placement === "bottom" ? panelHeight : "100%",
          }}
        >
          {/* Resize handle */}
          <div
            className={`hover:bg-primary/30 active:bg-primary/50 absolute z-20 transition-colors ${
              placement === "bottom"
                ? "top-0 left-0 w-full h-1 cursor-row-resize"
                : placement === "left"
                  ? "top-0 right-0 h-full w-1 cursor-col-resize"
                  : "top-0 left-0 h-full w-1 cursor-col-resize"
            }`}
            onMouseDown={handleResizeStart}
          />
          
          {/* Tab bar */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const droppedTabId = e.dataTransfer.getData("tabId") as TabId;
              if (droppedTabId && !tabs.includes(droppedTabId) && onTabDrop) {
                onTabDrop(droppedTabId);
              }
            }}
            className="border-border bg-muted/20 flex h-9 w-full shrink-0 items-center justify-between border-b"
          >
            <div className="flex h-full min-w-0 flex-1 overflow-x-auto scrollbar-none">
              {tabs.map((tabId) => {
                const tabDef = TAB_DEFS[tabId];
                if (!tabDef) return null;
                const isActive = activeTab === tabId;
                return (
                  <button
                    key={tabId}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("tabId", tabId);
                    }}
                    onClick={() => handleTabClick(tabId)}
                    className={`flex h-full min-w-[60px] flex-shrink-0 cursor-grab items-center justify-center gap-1.5 px-3 text-[10px] font-medium transition-colors sm:text-[11px] ${
                      isActive
                        ? "border-primary bg-card/40 text-foreground border-b-2"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                    }`}
                  >
                    <tabDef.Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tabDef.label}</span>
                    {tabId === "features" && featureCount !== undefined && featureCount > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-1 text-[9px] tabular-nums">
                        {featureCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dock selector buttons */}
            {onChangePlacement && (
              <div className="flex items-center gap-1 border-l border-border px-2 ml-auto shrink-0 py-1 bg-muted/5">
                <button
                  onClick={() => onChangePlacement("left")}
                  className={`p-1 rounded transition-colors ${
                    placement === "left"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                  title="Dock Left"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onChangePlacement("bottom")}
                  className={`p-1 rounded transition-colors ${
                    placement === "bottom"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                  title="Dock Bottom"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onChangePlacement("right")}
                  className={`p-1 rounded transition-colors ${
                    placement === "right"
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                  }`}
                  title="Dock Right"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              key={activeTab}
              className="h-full flex flex-col min-h-0"
              style={{ animation: "editorTabFadeIn 150ms ease" }}
            >
              {activeTab === "properties" && propertiesContent && (
                <div className="h-full px-3 py-3 overflow-y-auto">{propertiesContent}</div>
              )}
              {activeTab === "linkages" && linkagesContent && (
                <div className="h-full overflow-y-auto">{linkagesContent}</div>
              )}
              {activeTab === "sovereignty" && sovereigntyContent && (
                <div className="h-full overflow-y-auto">{sovereigntyContent}</div>
              )}
              {activeTab === "layers" && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
                  {layersContent ?? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center px-3 py-8 text-xs">
                      Layers panel coming soon
                    </div>
                  )}
                </div>
              )}
              {activeTab === "features" && featureListContent && (
                <div className="flex h-full min-h-0 flex-1 flex-col px-3 py-3 overflow-y-auto">
                  {featuresLoading ? <FeatureListSkeleton /> : featureListContent}
                </div>
              )}
              {activeTab === "wiki" && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
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

      {(placement === "left" || placement === "bottom") && (
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} placement={placement} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CollapseToggle({
  collapsed,
  onToggle,
  placement = "right",
}: {
  collapsed: boolean;
  onToggle: () => void;
  placement?: "left" | "right" | "bottom";
}) {
  let positionClass = "";
  if (placement === "bottom") {
    positionClass = "-top-3 left-1/2 -translate-x-1/2 rounded-t-md border-b-0 w-6 h-3";
  } else if (placement === "left") {
    positionClass = "-right-3 rounded-r-md border-l-0 w-3 h-6 top-1/2 -translate-y-1/2";
  } else {
    positionClass = "-left-3 rounded-l-md border-r-0 w-3 h-6 top-1/2 -translate-y-1/2";
  }

  return (
    <button
      onClick={onToggle}
      className={`bg-card/75 border-border text-muted-foreground hover:text-foreground absolute z-10 flex items-center justify-center border transition-colors ${positionClass} shadow-md backdrop-blur-sm`}
      title={collapsed ? "Show panel" : "Hide panel"}
    >
      {placement === "bottom" ? (
        collapsed ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : placement === "left" ? (
        collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )
      ) : collapsed ? (
        <ChevronLeft className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
    </button>
  );
}

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
