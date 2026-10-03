"use client";

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
const PANEL_MIN_H = 120;
const PANEL_MAX_H = 500;
const PANEL_DEFAULT_H = 240;
const PANEL_STORAGE_KEY = "ixworld-editor-panel-size";

type Placement = "left" | "right" | "bottom";

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
  placement?: Placement;
  /** Callback to change docking placement */
  onChangePlacement?: (placement: Placement) => void;
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

const DOCK_OPTIONS = [
  { placement: "left", title: "Dock left", Icon: ChevronLeft },
  { placement: "bottom", title: "Dock bottom", Icon: ChevronDown },
  { placement: "right", title: "Dock right", Icon: ChevronRight },
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function readStoredSize(axis: "width" | "height", fallback: number, min: number, max: number) {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(`${PANEL_STORAGE_KEY}-${axis}`);
  return stored ? clamp(parseInt(stored), min, max) : fallback;
}

/** Panel width/height (persisted per axis) with a drag handler that resizes along the docked axis. */
function usePanelResize(placement: Placement) {
  const [panelWidth, setPanelWidth] = useState(() =>
    readStoredSize("width", PANEL_DEFAULT_W, PANEL_MIN_W, PANEL_MAX_W)
  );
  const [panelHeight, setPanelHeight] = useState(() =>
    readStoredSize("height", PANEL_DEFAULT_H, PANEL_MIN_H, PANEL_MAX_H)
  );
  const sizeRef = useRef({ width: panelWidth, height: panelHeight });
  sizeRef.current = { width: panelWidth, height: panelHeight };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const isBottom = placement === "bottom";
      const start = isBottom
        ? { pos: e.clientY, size: sizeRef.current.height }
        : { pos: e.clientX, size: sizeRef.current.width };
      const setSize = isBottom ? setPanelHeight : setPanelWidth;
      const [min, max] = isBottom ? [PANEL_MIN_H, PANEL_MAX_H] : [PANEL_MIN_W, PANEL_MAX_W];
      const storageKey = `${PANEL_STORAGE_KEY}-${isBottom ? "height" : "width"}`;

      let pending = start.size;
      let rafId: number | null = null;

      const onMove = (me: MouseEvent) => {
        const pos = isBottom ? me.clientY : me.clientX;
        // Dragging toward the map grows the panel: up for bottom, right for left, left for right.
        const delta = placement === "left" ? pos - start.pos : start.pos - pos;
        pending = clamp(start.size + delta, min, max);
        rafId ??= requestAnimationFrame(() => {
          rafId = null;
          setSize(pending);
        });
      };

      const onUp = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setSize(pending);
        try {
          localStorage.setItem(storageKey, String(pending));
        } catch {
          // Ignore localStorage errors (e.g. quota, private mode)
        }
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [placement]
  );

  return { panelWidth, panelHeight, handleResizeStart };
}

function ResizeHandle({
  placement,
  onMouseDown,
}: {
  placement: Placement;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const position =
    placement === "bottom"
      ? "top-0 left-0 h-1 w-full cursor-row-resize"
      : `top-0 ${placement === "left" ? "right-0" : "left-0"} h-full w-1 cursor-col-resize`;
  return (
    <div
      className={`hover:bg-tint/30 active:bg-tint/50 absolute z-20 transition-colors ${position}`}
      onMouseDown={onMouseDown}
    />
  );
}

function TabBody({
  tab,
  props,
}: {
  tab: TabId;
  props: Pick<
    EditorPanelProps,
    | "propertiesContent"
    | "featureListContent"
    | "layersContent"
    | "wikiContent"
    | "linkagesContent"
    | "sovereigntyContent"
    | "historyContent"
    | "queueContent"
    | "featuresLoading"
  >;
}) {
  const scroll = "h-full overflow-y-auto";
  const flexScroll = "flex h-full min-h-0 flex-1 flex-col overflow-y-auto";
  switch (tab) {
    case "properties":
      return (
        props.propertiesContent && (
          <div className={`${scroll} px-3 py-3`}>{props.propertiesContent}</div>
        )
      );
    case "queue":
      return (
        props.queueContent && <div className={`${scroll} px-3 py-3`}>{props.queueContent}</div>
      );
    case "linkages":
      return props.linkagesContent && <div className={scroll}>{props.linkagesContent}</div>;
    case "sovereignty":
      return props.sovereigntyContent && <div className={scroll}>{props.sovereigntyContent}</div>;
    case "history":
      return props.historyContent && <div className={scroll}>{props.historyContent}</div>;
    case "layers":
      return <div className={flexScroll}>{props.layersContent ?? <LayerPanelSkeleton />}</div>;
    case "features":
      return (
        props.featureListContent && (
          <div className={`${flexScroll} px-3 py-3`}>
            {props.featuresLoading ? <FeatureListSkeleton /> : props.featureListContent}
          </div>
        )
      );
    case "wiki":
      return (
        <div className={flexScroll}>
          {props.wikiContent ?? (
            <div className="text-label-secondary text-footnote flex flex-1 items-center justify-center px-3 py-8 text-center">
              Select a country to scan its features for IxWiki pages.
            </div>
          )}
        </div>
      );
  }
}

function DockButtons({
  placement,
  onChangePlacement,
}: {
  placement: Placement;
  onChangePlacement: (placement: Placement) => void;
}) {
  return (
    <div className="border-separator ml-auto flex shrink-0 items-center gap-0.5 border-l px-2 py-1">
      {DOCK_OPTIONS.map(({ placement: target, title, Icon }) => (
        <Button
          key={target}
          variant="ghost"
          size="icon"
          onClick={() => onChangePlacement(target)}
          aria-pressed={placement === target}
          className={`h-6 w-6 ${
            placement === target ? "bg-fill-3 text-label" : "text-label-secondary"
          }`}
          title={title}
          aria-label={title}
        >
          <Icon aria-hidden />
        </Button>
      ))}
    </div>
  );
}

function EmptySlot({
  placement,
  panelsLocked,
  onTabDrop,
  onChangePlacement,
}: Pick<EditorPanelProps, "onTabDrop" | "onChangePlacement"> & {
  placement: Placement;
  panelsLocked: boolean;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const tabId = e.dataTransfer.getData("tabId") as TabId;
        if (tabId && onTabDrop) onTabDrop(tabId);
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
          {DOCK_OPTIONS.map(({ placement: target, title, Icon }) => (
            <Button
              key={target}
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChangePlacement(target)}
              title={title}
              aria-label={title}
              className={cn(
                "rounded-control-sm size-5",
                `rounded-control-sm p-0.5 ${placement === target ? "text-tint bg-tint-fill" : "hover:text-label"}`
              )}
            >
              <Icon className="h-3 w-3" />
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsedStrip({
  tabs,
  placement,
  onToggleCollapse,
}: Pick<EditorPanelProps, "tabs" | "onToggleCollapse"> & { placement: Placement }) {
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
          return (
            tabDef && (
              <tabDef.Icon
                key={tabId}
                className="text-label-secondary h-3.5 w-3.5 shrink-0"
                title={tabDef.label}
              />
            )
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

export function EditorPanel(props: EditorPanelProps) {
  const {
    mode,
    collapsed,
    onToggleCollapse,
    tabs,
    onTabDrop,
    placement = "right",
    onChangePlacement,
    featureCount,
    importWizardContent,
    activeTabOverride,
    onTabChange,
    isWorldMode = false,
    isStacked = false,
    panelsLocked = false,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (activeTabOverride) return activeTabOverride;
    if (tabs.length > 0) return tabs[0];
    return placement === "left" ? (isWorldMode ? "linkages" : "features") : "properties";
  });

  const userOverrideRef = useRef(false);

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

  const { panelWidth, panelHeight, handleResizeStart } = usePanelResize(placement);

  // Auto-switch to the properties tab when a feature is being added or edited
  useEffect(() => {
    if (userOverrideRef.current) return;
    if ((mode.startsWith("add-") || mode.startsWith("edit-")) && tabs.includes("properties")) {
      // oxlint-disable-next-line
      setActiveTab("properties");
    }
  }, [mode, tabs]);

  const handleTabClick = (tab: TabId) => {
    userOverrideRef.current = true;
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  if (collapsed && isStacked) {
    return <CollapsedStrip tabs={tabs} placement={placement} onToggleCollapse={onToggleCollapse} />;
  }

  const isBottom = placement === "bottom";
  const frameStyle = {
    width: isBottom ? "100%" : panelWidth,
    height: isBottom ? panelHeight : "100%",
  };
  const resizeHandle = !panelsLocked && (
    <ResizeHandle placement={placement} onMouseDown={handleResizeStart} />
  );
  const collapseToggle = (
    <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} placement={placement} />
  );

  // Import mode takes over the entire panel (only if features tab exists here)
  if (mode === "import-provinces" && importWizardContent && tabs.includes("features")) {
    return (
      <div className="relative flex h-full">
        {!collapsed && (
          <FacetMaterial
            material="regular"
            className="flex flex-col rounded-none"
            style={frameStyle}
          >
            {resizeHandle}
            {importWizardContent}
          </FacetMaterial>
        )}
        {collapseToggle}
      </div>
    );
  }

  if (tabs.length === 0) {
    return (
      <EmptySlot
        placement={placement}
        panelsLocked={panelsLocked}
        onTabDrop={onTabDrop}
        onChangePlacement={onChangePlacement}
      />
    );
  }

  return (
    <div className={`relative flex ${isBottom ? "w-full flex-col" : "h-full"}`}>
      {placement === "right" && collapseToggle}

      {!collapsed && (
        <FacetMaterial
          material="regular"
          className={`flex flex-col rounded-none ${isBottom ? "w-full" : "h-full"}`}
          style={frameStyle}
        >
          {resizeHandle}

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
                      panelsLocked ? undefined : (e) => e.dataTransfer.setData("tabId", tabId)
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

            {onChangePlacement && !panelsLocked && (
              <DockButtons placement={placement} onChangePlacement={onChangePlacement} />
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div
              key={activeTab}
              className="animate-in fade-in flex h-full min-h-0 flex-col duration-150"
            >
              <TabBody tab={activeTab} props={props} />
            </div>
          </div>
        </FacetMaterial>
      )}

      {placement !== "right" && collapseToggle}
    </div>
  );
}

const COLLAPSE_POSITION: Record<Placement, string> = {
  bottom: "-top-3 left-1/2 -translate-x-1/2 rounded-t-control-sm border-b-0 w-6 h-3",
  left: "-right-3 rounded-r-control-sm border-l-0 w-3 h-6 top-1/2 -translate-y-1/2",
  right: "-left-3 rounded-l-control-sm border-r-0 w-3 h-6 top-1/2 -translate-y-1/2",
};

/** The chevron points toward the map edge the panel collapses into (or away from it when collapsed). */
const COLLAPSE_ICONS: Record<Placement, [open: typeof ChevronUp, closed: typeof ChevronUp]> = {
  bottom: [ChevronDown, ChevronUp],
  left: [ChevronLeft, ChevronRight],
  right: [ChevronRight, ChevronLeft],
};

function CollapseToggle({
  collapsed,
  onToggle,
  placement = "right",
}: {
  collapsed: boolean;
  onToggle: () => void;
  placement?: Placement;
}) {
  const Icon = COLLAPSE_ICONS[placement][collapsed ? 1 : 0];
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
        `bg-surface border-separator text-label-secondary hover:text-label shadow-card absolute z-10 flex items-center justify-center border transition-colors ${COLLAPSE_POSITION[placement]}`
      )}
    >
      <Icon className="h-3 w-3" />
    </Button>
  );
}
