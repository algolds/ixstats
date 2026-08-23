// src/components/wiki-os/margin/WikiMarginDrawer.tsx
// Compact Right Sidebar Inspector for WikiOS (Threads, Markup, Live Sim Fact Inspect)
// Signature Highlighter Yellow / Warm Amber branding for Margin.

"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ChatBubble as MessageSquare,
  DesignPencil as Highlighter,
  StatsReport as Activity,
  Bookmark,
  Xmark as X,
  Expand as Maximize2,
  Collapse as Minimize2,
  Clock,
  Link as Link2,
  HelpCircle,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { api } from "~/trpc/react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";

import { MarginThreadsTab } from "./tabs/MarginThreadsTab";
import { MarginMarkupTab } from "./tabs/MarginMarkupTab";
import { MarginInspectTab } from "./tabs/MarginInspectTab";
import { MarginHelpModal } from "./modals/MarginHelpModal";

export type MarginTab = "threads" | "markup" | "inspect";

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

  const _primaryColor = themeColors?.primary || "var(--wikios-accent, #fef036)";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync initial tab if passed from caller
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Query discussion threads and counts
  const { data: marginData, isLoading, refetch } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle, status: "ALL" },
    { enabled: isOpen, staleTime: 10_000 }
  );

  const threads = marginData?.threads ?? [];
  const openThreadsCount = marginData?.totalOpenCount ?? 0;

  // Keyboard shortcut listener: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        soundEffects.release();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
        soundEffects.release();
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 top-14 z-30 bg-black/35 backdrop-blur-xs lg:hidden"
          />
        )}
        {isOpen && (
          <motion.aside
            key="wikios-margin-drawer"
            initial={{ transform: "translateX(100%)" }}
            animate={{ transform: "translateX(0%)" }}
            exit={{ transform: "translateX(100%)" }}
            transition={{
              type: "spring",
              damping: 32,
              stiffness: 380,
              mass: 0.7,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={cn(
              "fixed right-0 top-14 bottom-0 z-35 flex flex-col border-l border-[var(--wikios-border)] shadow-2xl backdrop-blur-2xl transition-[width] duration-300",
              "bg-[var(--wikios-surface)]/80 text-[var(--wikios-text)]",
              isExpandedFull ? "w-full sm:w-[440px]" : "w-full sm:w-80"
            )}
          >
            {/* Header Lockup (Matches Left Sidebar Profile / Nav Header Parity) */}
            <div className="flex items-center justify-between p-3 border-b border-[var(--wikios-border)] shrink-0 bg-[var(--wikios-surface)]/80 backdrop-blur-xl">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="wikios-sidebar-icon-box flex h-9 w-9 items-center justify-center rounded-xl border border-yellow-400/60 bg-margin-accent text-stone-950 shadow-[0_0_14px_rgba(254,240,54,0.45)] shrink-0 font-bold">
                  <Highlighter className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--wikios-text)] tracking-tight">Margin</span>
                  <span className="text-[10px] text-[var(--wikios-text-dim)] truncate max-w-[160px]">
                    {articleTitle.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Compact Window Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:border-yellow-400/50 hover:bg-margin-accent/15 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  title="Margin Guide & Shortcuts"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isExpandedFull;
                    setIsExpandedFull(next);
                    onExpandedChange?.(next);
                  }}
                  className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)] hover:bg-white/10 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  title={isExpandedFull ? "Standard (320px)" : "Wider (440px)"}
                >
                  {isExpandedFull ? (
                    <Minimize2 className="w-3 h-3" />
                  ) : (
                    <Maximize2 className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.release();
                    onClose();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  title="Close (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Segmented Highlighter Tab Rail Switcher */}
            <div className="px-3 pt-2.5 pb-2 border-b border-[var(--wikios-border)] shrink-0 bg-[var(--wikios-card-bg)]/30 backdrop-blur-md">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-[var(--wikios-border)] relative shadow-xs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        soundEffects.press();
                        setActiveTab(tab.id);
                      }}
                      className={cn(
                        "relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                        isActive
                          ? "text-[var(--wikios-text)] font-bold shadow-xs"
                          : "text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="margin-compact-tab-pill"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-[var(--wikios-surface)] border border-yellow-400/50 shadow-xs"
                        />
                      )}
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 relative z-10 transition-colors",
                          isActive ? "text-yellow-600 dark:text-margin-accent" : "text-[var(--wikios-text-dim)]"
                        )}
                      />
                      <span className="relative z-10">{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span
                          className="relative z-10 ml-0.5 px-1.5 py-0.2 rounded-full text-[8.5px] font-black text-stone-950 leading-none bg-margin-accent shadow-xs"
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Content Canvas */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin space-y-3">
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
                  themeColors={themeColors}
                />
              )}

              {activeTab === "markup" && (
                <MarginMarkupTab
                  articleTitle={articleTitle}
                  contentRef={contentRef}
                  isAuthenticated={isAuthenticated}
                  selectedAnnotationId={selectedAnnotationId}
                  onSelectAnnotation={onSelectAnnotation}
                  themeColors={themeColors}
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

            {/* Sleek Footbar Wayfinding & Quick Tools (Parity with Left Sidebar Nav Tools) */}
            <div className="px-3 py-2 border-t border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 text-[10px] text-[var(--wikios-text-dim)] flex items-center justify-between shrink-0 select-none backdrop-blur-xl">
              <span className="truncate max-w-[130px] font-medium">{articleTitle.replace(/_/g, " ")}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal("history");
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[var(--wikios-border)] bg-white/5 hover:bg-margin-accent/15 hover:border-yellow-400/50 hover:text-[var(--wikios-text)] active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  title="Revision History"
                >
                  <Clock className="w-3 h-3 text-yellow-600 dark:text-margin-accent" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal("backlinks");
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-[var(--wikios-border)] bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-300 active:scale-95 transition-all duration-150 cursor-pointer shadow-xs"
                  title="What Links Here"
                >
                  <Link2 className="w-3 h-3 text-cyan-400" />
                  <span>Backlinks</span>
                </button>
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
