"use client";
// src/components/wiki-os/shared/StashWelcomeModal.tsx
// User guide for the Stash System across WikiOS & IxStates.
// Features unslop writing, 4-tab feature overview, and Apple Design modal styling.

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Xmark as X,
  Bookmark,
  DesignPencil as Highlighter,
  Globe,
  ChatBubble as MessageSquare,
  Sparks as Sparkles,
  InfoCircle as Info,
  Clock,
  Eye,
  Folder as FolderOpen,
  Plus,
  Page as StickyNote,
  Download,
  ShareIos,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { STASHES_WELCOME_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "wikios-stashes-welcome-seen";

const OVERVIEW_STEPS = [
  {
    icon: FolderOpen,
    color: "text-rose-400",
    title: "Color-coded collections",
    description:
      "Group research into named folders like Fleet Doctrine or Treaties with 8 preset color tags.",
  },
  {
    icon: Plus,
    color: "text-amber-400",
    title: "Quick creation popover",
    description:
      "Open the creation popover from the header or sidebar to add a collection without leaving the page.",
  },
  {
    icon: Download,
    color: "text-emerald-400",
    title: "Markdown and JSON export",
    description:
      "Download any collection as a formatted markdown document or structured JSON data file.",
  },
  {
    icon: ShareIos,
    color: "text-cyan-400",
    title: "Shareable links",
    description: "Copy direct links to any collection to share research lists with other players.",
  },
];

const ARTICLE_STEPS = [
  {
    icon: WikiOSLogomark,
    color: "text-blue-400",
    title: "Article bookmarks",
    description:
      "Save wiki pages with automatic lead thumbnail images, word counts, and edit dates.",
  },
  {
    icon: Highlighter,
    color: "text-yellow-400",
    title: "Quotes and highlights",
    description:
      "Highlights created in WikiOS Margin sync to your Quotes tab with lore notes and direct links.",
  },
  {
    icon: StickyNote,
    color: "text-purple-400",
    title: "Personal notes",
    description: "Attach markdown notes to saved pages to record lore observations or todo items.",
  },
  {
    icon: Clock,
    color: "text-teal-400",
    title: "Fast reader jumping",
    description:
      "Click any saved quote or page to open the article at that exact section in WikiOS.",
  },
];

const MEDIA_STEPS = [
  {
    icon: Globe,
    color: "text-blue-400",
    title: "Commons and uploads",
    description:
      "Save Wikimedia Commons graphics or local image uploads directly to your collection.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    title: "Wikitext snippets",
    description: "Copy ready-to-paste wikitext markup for thumbnails, links, or full-width embeds.",
  },
  {
    icon: Info,
    color: "text-cyan-400",
    title: "Metadata inspection",
    description: "View file dimensions, MIME types, licenses, and artist attribution.",
  },
  {
    icon: Eye,
    color: "text-pink-400",
    title: "Interactive lightbox",
    description: "Inspect images in full resolution with keyboard navigation and zoom.",
  },
];

const FORUM_STEPS = [
  {
    icon: MessageSquare,
    color: "text-orange-400",
    title: "Thread bookmarks",
    description:
      "Save regional forum threads, debates, and policy proposals in your research lists.",
  },
  {
    icon: StickyNote,
    color: "text-emerald-400",
    title: "Custom summaries",
    description: "Write context summaries on saved threads to keep track of decisions.",
  },
  {
    icon: Clock,
    color: "text-cyan-400",
    title: "Activity links",
    description: "Jump straight to the live thread on the regional forum board.",
  },
  {
    icon: Bookmark,
    color: "text-rose-400",
    title: "Unified lore vault",
    description:
      "Keep articles, clipped quotes, media, and forum threads together under one topic.",
  },
];

const TABS = [
  { label: "Overview", steps: OVERVIEW_STEPS },
  { label: "Articles & Quotes", steps: ARTICLE_STEPS },
  { label: "Media Assets", steps: MEDIA_STEPS },
  { label: "Forum Threads", steps: FORUM_STEPS },
];

export function StashWelcomeModal({
  open,
  onOpenChangeAction,
}: {
  open?: boolean;
  onOpenChangeAction?: (open: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open !== undefined) {
      // oxlint-disable-next-line
      setShow(open);
      if (open) {
        setActiveTab(0);
      }
    }
  }, [open]);

  useEffect(() => {
    if (open === undefined) {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen || seen !== STASHES_WELCOME_VERSION) {
          const timer = setTimeout(() => setShow(true), 800);
          return () => clearTimeout(timer);
        }
      } catch {
        // localStorage unavailable
      }
    }
    return;
  }, [open]);

  const handleClose = useCallback(() => {
    soundEffects.release();
    setShow(false);
    onOpenChangeAction?.(false);
    try {
      localStorage.setItem(STORAGE_KEY, STASHES_WELCOME_VERSION);
    } catch {}
  }, [onOpenChangeAction]);

  if (!mounted || !show) return null;

  const currentSteps = TABS[activeTab]?.steps ?? OVERVIEW_STEPS;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            key="stash-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-90 bg-black/40 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="stash-welcome-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="fixed top-1/2 left-1/2 z-100 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4 select-none focus:outline-none"
          >
            <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white text-stone-900 shadow-2xl dark:border-white/15 dark:bg-zinc-900 dark:text-stone-100">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-3.5 right-3.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-all hover:bg-stone-200 hover:text-stone-950 active:scale-90 dark:bg-zinc-800 dark:text-stone-400 dark:hover:bg-zinc-700 dark:hover:text-white"
                title="Close guide"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="border-b border-black/8 px-6 pt-6 pb-3 dark:border-white/10">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/15 text-rose-500 shadow-2xs">
                    <Bookmark className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-stone-950 dark:text-white">
                      Stash Guide
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Save-for-later, built for lore.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-black/8 bg-stone-50/50 px-6 dark:border-white/10 dark:bg-zinc-900/50">
                {TABS.map((tab, i) => (
                  <button
                    key={tab.label}
                    onClick={() => {
                      soundEffects.press();
                      setActiveTab(i);
                    }}
                    className={cn(
                      "relative cursor-pointer border-b-2 px-3 py-2.5 text-xs font-semibold transition-all",
                      activeTab === i
                        ? "border-rose-500 font-bold text-rose-600 dark:text-rose-400"
                        : "border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content Grid */}
              <div className="max-h-[360px] min-h-[260px] overflow-y-auto px-6 py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2"
                  >
                    {currentSteps.map((step) => {
                      const Icon = step.icon;
                      return (
                        <div
                          key={step.title}
                          className="space-y-1.5 rounded-2xl border border-black/8 bg-stone-50 p-3.5 shadow-2xs transition-colors hover:border-black/15 dark:border-white/10 dark:bg-zinc-900/80 dark:hover:border-white/20"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-black/5 bg-stone-100 dark:border-white/8 dark:bg-zinc-800">
                              <Icon className={cn("h-3.5 w-3.5", step.color)} />
                            </div>
                            <h4 className="text-xs font-bold tracking-tight text-stone-900 dark:text-white">
                              {step.title}
                            </h4>
                          </div>
                          <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                            {step.description}
                          </p>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-black/8 bg-stone-50/50 px-6 py-3.5 dark:border-white/10 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-rose-600 active:scale-95"
                >
                  Start Stashing
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
