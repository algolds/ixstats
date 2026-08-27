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
  // oxlint-disable-next-line eslint/no-unused-vars
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
              "fixed top-14 right-0 bottom-0 z-35 flex flex-col border-l border-[var(--wikios-border)] shadow-2xl backdrop-blur-2xl transition-[width] duration-300",
              "bg-[var(--wikios-surface)]/80 text-[var(--wikios-text)]",
              isExpandedFull ? "w-full sm:w-[440px]" : "w-full sm:w-80"
            )}
          >
            {/* Header Lockup (Matches Left Sidebar Profile / Nav Header Parity) */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 p-3 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="wikios-sidebar-icon-box bg-margin-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-400/60 font-bold text-stone-950 shadow-[0_0_14px_rgba(254,240,54,0.45)]">
                  <Highlighter className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-bold tracking-tight text-[var(--wikios-text)]">
                    Margin
                  </span>
                  <span className="max-w-[160px] truncate text-[10px] text-[var(--wikios-text-dim)]">
                    {articleTitle.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              {/* Compact Window Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="hover:bg-margin-accent/15 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-xs transition-all duration-150 hover:border-yellow-400/50 hover:text-[var(--wikios-text)] active:scale-95"
                  title="Margin Guide & Shortcuts"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isExpandedFull;
                    setIsExpandedFull(next);
                    onExpandedChange?.(next);
                  }}
                  className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-xs transition-all duration-150 hover:bg-white/10 hover:text-[var(--wikios-text)] active:scale-95 sm:flex"
                  title={isExpandedFull ? "Standard (320px)" : "Wider (440px)"}
                >
                  {isExpandedFull ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.release();
                    onClose();
                  }}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-[var(--wikios-border)] bg-white/5 text-[var(--wikios-text-dim)] shadow-xs transition-all duration-150 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95"
                  title="Close (Esc)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Segmented Highlighter Tab Rail Switcher */}
            <div className="shrink-0 border-b border-[var(--wikios-border)] bg-[var(--wikios-card-bg)]/30 px-3 pt-2.5 pb-2 backdrop-blur-md">
              <div className="relative grid grid-cols-2 gap-1 rounded-xl border border-[var(--wikios-border)] bg-white/5 p-1 shadow-xs">
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
                        "relative flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all select-none",
                        isActive
                          ? "font-bold text-[var(--wikios-text)] shadow-xs"
                          : "text-[var(--wikios-text-muted)] hover:text-[var(--wikios-text)]"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="margin-compact-tab-pill"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                          className="absolute inset-0 rounded-lg border border-yellow-400/50 bg-[var(--wikios-surface)] shadow-xs"
                        />
                      )}
                      <Icon
                        className={cn(
                          "relative z-10 h-3.5 w-3.5 transition-colors",
                          isActive
                            ? "dark:text-margin-accent text-yellow-600"
                            : "text-[var(--wikios-text-dim)]"
                        )}
                      />
                      <span className="relative z-10">{tab.label}</span>
                      {tab.badge !== undefined && (
                        <span className="py-0.2 bg-margin-accent relative z-10 ml-0.5 rounded-full px-1.5 text-[8.5px] leading-none font-black text-stone-950 shadow-xs">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
            <div className="flex shrink-0 items-center justify-between border-t border-[var(--wikios-border)] bg-[var(--wikios-surface)]/80 px-3 py-2 text-[10px] text-[var(--wikios-text-dim)] backdrop-blur-xl select-none">
              <span className="max-w-[130px] truncate font-medium">
                {articleTitle.replace(/_/g, " ")}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal("history");
                  }}
                  className="hover:bg-margin-accent/15 flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--wikios-border)] bg-white/5 px-2 py-0.5 shadow-xs transition-all duration-150 hover:border-yellow-400/50 hover:text-[var(--wikios-text)] active:scale-95"
                  title="Revision History"
                >
                  <Clock className="dark:text-margin-accent h-3 w-3 text-yellow-600" />
                  <span>History</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal("backlinks");
                  }}
                  className="flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--wikios-border)] bg-white/5 px-2 py-0.5 shadow-xs transition-all duration-150 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 active:scale-95"
                  title="What Links Here"
                >
                  <Link2 className="h-3 w-3 text-cyan-400" />
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
