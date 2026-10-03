"use client";

/**
 * EditorPanel — Sidebar/Bottom panel supporting left, right, and bottom orientation with tabbed navigation.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  NavArrowUp as ChevronUp,
  NavArrowDown as ChevronDown,
  Settings as Settings2,
  Component as Layers,
  List,
  OpenBook as BookOpen,
  Globe,
  Link as LinkIcon,
  ViewGrid as Layout,
  ClockRotateRight as History,
  MailIn as Inbox,
} from "iconoir-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { FeatureListSkeleton, LayerPanelSkeleton } from "~/components/maps/editor/EditorSkeleton";
import { cn } from "~/lib/utils/cn";

const PANEL_MIN_W = 256;
const PANEL_MAX_W = 480;
const PANEL_DEFAULT_W = 320;
const PANEL_STORAGE_KEY = "ixworld-editor-panel-size";

export type TabId =
  "properties" | "layers" | "features" | "wiki" | "linkages" | "sovereignty" | "history" | "queue";

const TAB_DEFS: Record<
  TabId,
  { label: string; Icon: React.ComponentType<{ className?: string; title?: string }> }
> = {
  layers: { label: "Layers", Icon: Layers },
  features: { label: "Features", Icon: List },
  properties: { label: "Properties", Icon: Settings2 },
  linkages: { label: "Links", Icon: LinkIcon },
  sovereignty: { label: "Sovereign", Icon: Globe },
  wiki: { label: "Wiki", Icon: BookOpen },
  history: { label: "History", Icon: History },
  queue: { label: "Queue", Icon: Inbox },
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
  historyContent?: React.ReactNode;
  queueContent?: React.ReactNode;
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
  panelsLocked?: boolean;
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
  historyContent,
  queueContent,
  featureCount,
  importWizardContent,
  featuresLoading,
  activeTabOverride,
  onTabChange,
  isWorldMode = false,
  isStacked = false,
  panelsLocked = false,
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
      // oxlint-disable-next-line
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  // Keep activeTab in sync with available tabs in this panel
  useEffect(() => {
    if (tabs.length > 0 && !tabs.includes(activeTab)) {
      // oxlint-disable-next-line
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
    return stored ? Math.min(500, Math.max(120, parseInt(stored))) : 240;
  });

  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const panelHeightRef = useRef(panelHeight);
  panelHeightRef.current = panelHeight;

  const isDragging = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = panelWidthRef.current;
      const startH = panelHeightRef.current;

      let pendingW = startW;
      let pendingH = startH;
      let rafId: number | null = null;

      const onMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        if (placement === "bottom") {
          const delta = startY - me.clientY;
          pendingH = Math.min(500, Math.max(120, startH + delta));
        } else {
          const delta = placement === "left" ? me.clientX - startX : startX - me.clientX;
          pendingW = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, startW + delta));
        }

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (placement === "bottom") {
              setPanelHeight(pendingH);
            } else {
              setPanelWidth(pendingW);
            }
          });
        }
      };

      const onUp = () => {
        isDragging.current = false;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);

        if (placement === "bottom") {
          setPanelHeight(pendingH);
          try {
            localStorage.setItem(`${PANEL_STORAGE_KEY}-height`, String(pendingH));
          } catch {
            // Ignore localStorage errors (e.g. quota, private mode)
          }
        } else {
          setPanelWidth(pendingW);
          try {
            localStorage.setItem(`${PANEL_STORAGE_KEY}-width`, String(pendingW));
          } catch {
            // Ignore localStorage errors
          }
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [placement]
  );

  // Auto-switch tabs based on mode (for properties tab)
  useEffect(() => {
    if (userOverrideRef.current) return;
    if (mode.startsWith("add-") || mode.startsWith("edit-")) {
      if (tabs.includes("properties")) {
        // oxlint-disable-next-line
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
      <FacetMaterial
        material="regular"
        className={`flex shrink-0 items-center justify-between px-2 py-2 ${
          placement === "bottom" ? "rounded-control-sm h-9 w-32" : "h-9 w-full rounded-none"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {tabs.map((tabId) => {
            const tabDef = TAB_DEFS[tabId];
            if (!tabDef) return null;
            return (
              <tabDef.Icon
                key={tabId}
                className="text-label-secondary h-3.5 w-3.5 shrink-0"
                title={tabDef.label}
              />
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="text-label-secondary h-6 w-6 shrink-0"
          title="Expand panel"
          aria-label="Expand panel"
        >
          {placement === "bottom" ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
      </FacetMaterial>
    );
  }

  // Import mode takes over the entire panel (only if features tab exists here)
  if (mode === "import-provinces" && importWizardContent && tabs.includes("features")) {
    return (
      <div className="relative flex h-full">
        {!collapsed && (
          <FacetMaterial
            material="regular"
            className="flex flex-col rounded-none"
            style={{
              width: placement === "bottom" ? "100%" : panelWidth,
              height: placement === "bottom" ? panelHeight : "100%",
            }}
          >
            {/* Resize handle */}
            {!panelsLocked && (
              <div
                className={`hover:bg-tint/30 active:bg-tint/50 absolute z-20 transition-colors ${
                  placement === "bottom"
                    ? "top-0 left-0 h-1 w-full cursor-row-resize"
                    : placement === "left"
                      ? "top-0 right-0 h-full w-1 cursor-col-resize"
                      : "top-0 left-0 h-full w-1 cursor-col-resize"
                }`}
                onMouseDown={handleResizeStart}
              />
            )}
            {importWizardContent}
          </FacetMaterial>
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
        className="border-separator text-label-secondary hover:border-tint/40 rounded-control text-footnote m-2 flex flex-col items-center justify-center border-2 border-dashed p-4 transition-colors"
        style={{
          width: placement === "bottom" ? "100%" : 140,
          height: placement === "bottom" ? 80 : "100%",
        }}
      >
        <Layout className="text-label-secondary mb-1 h-4 w-4" aria-hidden />
        <span>Drag tab here</span>
        {onChangePlacement && !panelsLocked && (
          <div className="mt-2 flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChangePlacement("left")}
              title="Dock left"
              aria-label="Dock left"
              className={cn(
                "rounded-control-sm size-5",
                `rounded-control-sm p-0.5 ${placement === "left" ? "text-tint bg-tint-fill" : "hover:text-label"}`
              )}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChangePlacement("bottom")}
              title="Dock bottom"
              aria-label="Dock bottom"
              className={cn(
                "rounded-control-sm size-5",
                `rounded-control-sm p-0.5 ${placement === "bottom" ? "text-tint bg-tint-fill" : "hover:text-label"}`
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChangePlacement("right")}
              title="Dock right"
              aria-label="Dock right"
              className={cn(
                "rounded-control-sm size-5",
                `rounded-control-sm p-0.5 ${placement === "right" ? "text-tint bg-tint-fill" : "hover:text-label"}`
              )}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
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
        <FacetMaterial
          material="regular"
          className={`flex flex-col rounded-none ${placement === "bottom" ? "w-full" : "h-full"}`}
          style={{
            width: placement === "bottom" ? "100%" : panelWidth,
            height: placement === "bottom" ? panelHeight : "100%",
          }}
        >
          {/* Resize handle */}
          {!panelsLocked && (
            <div
              className={`hover:bg-tint/30 active:bg-tint/50 absolute z-20 transition-colors ${
                placement === "bottom"
                  ? "top-0 left-0 h-1 w-full cursor-row-resize"
                  : placement === "left"
                    ? "top-0 right-0 h-full w-1 cursor-col-resize"
                    : "top-0 left-0 h-full w-1 cursor-col-resize"
              }`}
              onMouseDown={handleResizeStart}
            />
          )}

          {/* Tab bar */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const droppedTabId = e.dataTransfer.getData("tabId") as TabId;
              if (droppedTabId && !tabs.includes(droppedTabId) && onTabDrop) {
                onTabDrop(droppedTabId);
              }
            }}
            className="border-separator flex h-9 w-full shrink-0 items-center justify-between border-b"
          >
            <div
              role="tablist"
              aria-label="Editor panels"
              className="flex h-full min-w-0 flex-1 scrollbar-none overflow-x-auto"
            >
              {tabs.map((tabId) => {
                const tabDef = TAB_DEFS[tabId];
                if (!tabDef) return null;
                const isActive = activeTab === tabId;
                return (
                  <button
                    key={tabId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={tabDef.label}
                    draggable={!panelsLocked}
                    onDragStart={
                      panelsLocked
                        ? undefined
                        : (e) => {
                            e.dataTransfer.setData("tabId", tabId);
                          }
                    }
                    onClick={() => handleTabClick(tabId)}
                    className={`text-caption sm:text-footnote flex h-full min-w-[60px] flex-shrink-0 cursor-grab items-center justify-center gap-2 px-3 transition-colors ${
                      isActive
                        ? "border-tint text-label border-b-2"
                        : "text-label-secondary hover:text-label hover:bg-fill-3"
                    }`}
                  >
                    <tabDef.Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">{tabDef.label}</span>
                    {tabId === "features" && featureCount !== undefined && featureCount > 0 && (
                      <Badge variant="default" className="px-1 tabular-nums">
                        {featureCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dock selector buttons */}
            {onChangePlacement && !panelsLocked && (
              <div className="border-separator ml-auto flex shrink-0 items-center gap-0.5 border-l px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChangePlacement("left")}
                  aria-pressed={placement === "left"}
                  className={`h-6 w-6 ${
                    placement === "left" ? "bg-fill-3 text-label" : "text-label-secondary"
                  }`}
                  title="Dock left"
                  aria-label="Dock left"
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChangePlacement("bottom")}
                  aria-pressed={placement === "bottom"}
                  className={`h-6 w-6 ${
                    placement === "bottom" ? "bg-fill-3 text-label" : "text-label-secondary"
                  }`}
                  title="Dock bottom"
                  aria-label="Dock bottom"
                >
                  <ChevronDown aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChangePlacement("right")}
                  aria-pressed={placement === "right"}
                  className={`h-6 w-6 ${
                    placement === "right" ? "bg-fill-3 text-label" : "text-label-secondary"
                  }`}
                  title="Dock right"
                  aria-label="Dock right"
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              key={activeTab}
              className="animate-in fade-in flex h-full min-h-0 flex-col duration-150"
            >
              {activeTab === "properties" && propertiesContent && (
                <div className="h-full overflow-y-auto px-3 py-3">{propertiesContent}</div>
              )}
              {activeTab === "linkages" && linkagesContent && (
                <div className="h-full overflow-y-auto">{linkagesContent}</div>
              )}
              {activeTab === "sovereignty" && sovereigntyContent && (
                <div className="h-full overflow-y-auto">{sovereigntyContent}</div>
              )}
              {activeTab === "history" && historyContent && (
                <div className="h-full overflow-y-auto">{historyContent}</div>
              )}
              {activeTab === "queue" && queueContent && (
                <div className="h-full overflow-y-auto px-3 py-3">{queueContent}</div>
              )}
              {activeTab === "layers" && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
                  {layersContent ?? <LayerPanelSkeleton />}
                </div>
              )}
              {activeTab === "features" && featureListContent && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
                  {featuresLoading ? <FeatureListSkeleton /> : featureListContent}
                </div>
              )}
              {activeTab === "wiki" && (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
                  {wikiContent ?? (
                    <div className="text-label-secondary text-footnote flex flex-1 items-center justify-center px-3 py-8 text-center">
                      Select a country to scan its features for IxWiki pages.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </FacetMaterial>
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
    positionClass = "-top-3 left-1/2 -translate-x-1/2 rounded-t-control-sm border-b-0 w-6 h-3";
  } else if (placement === "left") {
    positionClass = "-right-3 rounded-r-control-sm border-l-0 w-3 h-6 top-1/2 -translate-y-1/2";
  } else {
    positionClass = "-left-3 rounded-l-control-sm border-r-0 w-3 h-6 top-1/2 -translate-y-1/2";
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      title={collapsed ? "Show panel" : "Hide panel"}
      aria-label={collapsed ? "Show panel" : "Hide panel"}
      className={cn(
        "rounded-control-sm size-5",
        `bg-surface border-separator text-label-secondary hover:text-label shadow-card absolute z-10 flex items-center justify-center border transition-colors ${positionClass}`
      )}
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
    </Button>
  );
}
