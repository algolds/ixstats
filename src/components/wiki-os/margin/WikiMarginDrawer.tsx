"use client";
// Compact Right Sidebar Inspector for WikiOS (Threads, Markup, Live Sim Fact Inspect)
// Signature Highlighter Yellow / Warm Amber branding for Margin.

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ChatBubble as MessageSquare,
  DesignPencil as Highlighter,
  Xmark as X,
  Expand as Maximize2,
  Collapse as Minimize2,
  Clock,
  Link as Link2,
  HelpCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { springSmooth, tweenExit, tweenFast } from "~/lib/design/motion";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";

import { MarginThreadsTab } from "./tabs/MarginThreadsTab";
import { MarginMarkupTab } from "./tabs/MarginMarkupTab";
import { MarginInspectTab } from "./tabs/MarginInspectTab";
import { MarginHelpModal } from "./modals/MarginHelpModal";

type MarginTab = "threads" | "markup" | "inspect";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface WikiMarginDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  articleTitle: string;
  initialTab?: MarginTab;
  activeAnchor: string | null;
  draftQuote?: string | null;
  onClearDraftQuote?: () => void;
  selectedThreadId: string | null;
  onSelectThread: (id: string | null) => void;
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  isAuthenticated: boolean;
  themeColors?: ThemeColors | null;
  onExpandedChange?: (expanded: boolean) => void;
}

export function WikiMarginDrawer({
  isOpen,
  onClose,
  articleTitle,
  initialTab = "threads",
  activeAnchor,
  draftQuote,
  onClearDraftQuote,
  selectedThreadId,
  onSelectThread,
  selectedAnnotationId,
  onSelectAnnotation,
  contentRef,
  isAuthenticated,
  themeColors,
  onExpandedChange,
}: WikiMarginDrawerProps) {
  const { setActiveModal } = useWikiContext();
  const [activeTab, setActiveTab] = useState<MarginTab>(initialTab);
  const [isExpandedFull, setIsExpandedFull] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [proposedEditDraft, setProposedEditDraft] = useState<string | null>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  // Sync initial tab if passed from caller
  useEffect(() => {
    // oxlint-disable-next-line
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Query discussion threads and counts
  const {
    data: marginData,
    isLoading,
    refetch,
  } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle, status: "ALL" },
    { enabled: isOpen, staleTime: 10_000 }
  );

  const threads = marginData?.threads ?? [];
  const openThreadsCount = marginData?.totalOpenCount ?? 0;

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    // The help dialog handles its own Escape.
    if (!isOpen || helpOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, helpOpen, onClose]);

  // Touch swipe-to-dismiss gesture tracking
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      dragStartX.current = e.touches[0].clientX;
      dragStartTime.current = Date.now();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0]) {
      const deltaX = e.changedTouches[0].clientX - dragStartX.current;
      const deltaTime = Date.now() - dragStartTime.current;
      const velocity = deltaX / Math.max(deltaTime, 1);

      if (deltaX > 80 || velocity > 0.11) {
        onClose();
      }
    }
  };

  // Note: "inspect" tab is hidden for now pending UI revisit.
  const tabs = [
    {
      id: "threads" as MarginTab,
      label: "Threads",
      icon: MessageSquare,
      badge: openThreadsCount > 0 ? openThreadsCount : undefined,
    },
    {
      id: "markup" as MarginTab,
      label: "Markup",
      icon: Highlighter,
    },
    // TODO (Revisit): "inspect" tab parked for dedicated redesign pass.
  ];

  const handleProposeInspectEdit = (originalText: string, _suggestedText: string) => {
    setProposedEditDraft(originalText);
    setActiveTab("threads");
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="wikios-margin-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tweenFast}
            onClick={onClose}
            className="z-chrome fixed inset-x-0 top-14 bottom-(--shell-tabbar-height) bg-black/25 lg:hidden"
          />
        )}
        {isOpen && (
          <motion.aside
            key="wikios-margin-drawer"
            aria-label="Margin"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: tweenExit }}
            transition={springSmooth}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
              // Floating side inspector (non-modal: the article stays interactive), so chrome
              // material rather than a modal Sheet.
              "material-regular z-chrome border-separator text-label shadow-floating fixed top-14 right-0 bottom-(--shell-tabbar-height) flex flex-col border-l",
              isExpandedFull ? "w-full sm:w-[440px]" : "w-full sm:w-80"
            )}
          >
            {/* Header */}
            <div className="border-separator flex shrink-0 items-center justify-between gap-2 border-b p-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="bg-margin-accent rounded-row flex size-9 shrink-0 items-center justify-center text-(--margin-badge-text)">
                  <Highlighter className="size-4" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-headline text-label">Margin</span>
                  <span className="text-footnote text-label-secondary max-w-[160px] truncate">
                    {articleTitle.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Window actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setHelpOpen(true)}
                  title="Margin guide & shortcuts"
                  aria-label="Margin guide & shortcuts"
                  className="text-label-secondary"
                >
                  <HelpCircle aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    const next = !isExpandedFull;
                    setIsExpandedFull(next);
                    onExpandedChange?.(next);
                  }}
                  title={isExpandedFull ? "Standard (320px)" : "Wider (440px)"}
                  aria-label={isExpandedFull ? "Standard width" : "Wider"}
                  className="text-label-secondary hidden sm:inline-flex"
                >
                  {isExpandedFull ? (
                    <Minimize2 aria-hidden="true" />
                  ) : (
                    <Maximize2 aria-hidden="true" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  title="Close (Esc)"
                  aria-label="Close margin"
                  className="text-label-secondary"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-separator shrink-0 border-b px-3 py-2">
              <SegmentedControl
                aria-label="Margin sections"
                fullWidth
                size="sm"
                value={activeTab}
                onValueChange={setActiveTab}
                options={tabs.map((tab) => {
                  const Icon = tab.icon;
                  return {
                    value: tab.id,
                    icon: <Icon aria-hidden="true" />,
                    label: (
                      <span className="flex items-center gap-1">
                        {tab.label}
                        {tab.badge !== undefined && (
                          <span className="bg-margin-accent text-caption rounded-full px-2 leading-4 text-(--margin-badge-text) tabular-nums">
                            {tab.badge}
                          </span>
                        )}
                      </span>
                    ),
                  };
                })}
              />
            </div>

            {/* Scrollable Content Canvas */}
            <div className="flex-1 scrollbar-thin space-y-3 overflow-y-auto p-3">
              {activeTab === "threads" && (
                <MarginThreadsTab
                  articleTitle={articleTitle}
                  threads={threads as any}
                  isLoading={isLoading}
                  activeAnchor={activeAnchor}
                  draftQuote={proposedEditDraft || draftQuote}
                  onClearDraftQuote={() => {
                    setProposedEditDraft(null);
                    onClearDraftQuote?.();
                  }}
                  selectedThreadId={selectedThreadId}
                  onSelectThread={onSelectThread}
                  isAuthenticated={isAuthenticated}
                  onRefetch={refetch}
                />
              )}

              {activeTab === "markup" && (
                <MarginMarkupTab
                  articleTitle={articleTitle}
                  contentRef={contentRef}
                  isAuthenticated={isAuthenticated}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={onSelectAnnotation}
                />
              )}

              {activeTab === "inspect" && (
                <MarginInspectTab
                  articleTitle={articleTitle}
                  onProposeEdit={handleProposeInspectEdit}
                  isAuthenticated={isAuthenticated}
                />
              )}
            </div>

            {/* Footer: quick tools */}
            <div className="border-separator flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 select-none">
              <span className="text-footnote text-label-secondary max-w-[130px] truncate">
                {articleTitle.replace(/_/g, " ")}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveModal("history")}
                  title="Revision history"
                >
                  <Clock aria-hidden="true" />
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveModal("backlinks")}
                  title="What links here"
                >
                  <Link2 aria-hidden="true" />
                  Backlinks
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <MarginHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        themeColors={themeColors}
      />
    </>,
    document.body
  );
}
