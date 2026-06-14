"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Bookmark,
  Highlighter,
  Globe,
  MessageSquare,
  BookOpen,
  Sparkles,
  Info,
  Clock,
  // eslint-disable-next-line unused-imports/no-unused-imports
  HelpCircle,
  Eye,
  FolderOpen,
  Plus,
  StickyNote,
} from "lucide-react";
import { cn } from "~/lib/utils";
// eslint-disable-next-line unused-imports/no-unused-imports
import { WIKIOS_VERSION, STASHES_WELCOME_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "wikios-stashes-welcome-seen";

const MARKUP_STEPS = [
  {
    icon: Highlighter,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "1. Highlight Text",
    description:
      "Select any text segment on a stashed article to instantly highlight it using the inline markup toolbar.",
  },
  {
    icon: StickyNote,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "2. Personal Notes",
    description:
      "Attach rich markdown descriptions and context notes to any stashed page for quick reference during worldbuilding.",
  },
  {
    icon: Clock,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "3. Persistent Session",
    description:
      "Your annotations are saved to the cloud and automatically rendered inline next time you open the article.",
  },
  {
    icon: BookOpen,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "4. Inline Reader",
    description:
      "Jump straight to the specific sections you highlighted directly from the stashes manager panel.",
  },
];

const IMAGE_STEPS = [
  {
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Repository Integration",
    description:
      "Browse the centralized media repository and stash Wikimedia Commons graphics or local uploads with one click.",
  },
  {
    icon: FolderOpen,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "Visual Collections",
    description:
      "Group your stashed visual assets into color-coded folders like 'Characters', 'Military', or 'Atlas Maps'.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Quick-Embed Preview",
    description:
      "Enables fast wikitext code snippet copying (thumbnails, embeds, or links) for immediate editor insertion.",
  },
  {
    icon: Info,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Metadata Viewer",
    description:
      "Inspect artist attribution, dimensions, MIME types, and creative commons licenses directly from your stash.",
  },
];

const THREAD_STEPS = [
  {
    icon: MessageSquare,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    title: "Forum Bookmarks",
    description:
      "Bookmark community discussion threads, regional proposals, and administrative logs for quick reading.",
  },
  {
    icon: Plus,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Custom Summaries",
    description:
      "Add personal annotations and descriptions to bookmarked threads to capture context and outstanding tasks.",
  },
  {
    icon: Clock,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Thread Activity Tracking",
    description:
      "Keep track of the date saved and click directly through to the original post on the regional forum.",
  },
  {
    icon: Bookmark,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    title: "Unified Collections",
    description:
      "Keep wiki articles, images, and discussions grouped together under a single cohesive research theme.",
  },
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open !== undefined) {
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
    setShow(false);
    onOpenChangeAction?.(false);
    try {
      localStorage.setItem(STORAGE_KEY, STASHES_WELCOME_VERSION);
    } catch {}
  }, [onOpenChangeAction]);

  const TABS = ["Getting Started", "Page Markups", "Image Repository", "Forum Threads"];

  if (!mounted || !show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with premium blur */}
          <motion.div
            key="stash-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[120000] bg-zinc-950/40 backdrop-blur-[12px] dark:bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="stash-welcome-modal"
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-1/2 left-1/2 z-[120001] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4 focus:outline-none"
          >
            <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-2xl backdrop-blur-2xl dark:border-white/20 dark:bg-zinc-950/70">
              {/* Close button */}
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 z-10 cursor-pointer rounded-lg p-1.5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-2">
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                      <Bookmark className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-foreground text-base font-semibold">Stash Guide</h2>
                      <p className="text-muted-foreground text-xs">
                        Save articles, media assets, and forum threads.
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-[10px]">
                    v{STASHES_WELCOME_VERSION}
                  </span>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="border-border/30 bg-muted/20 flex border-b px-6">
                {TABS.map((tab, i) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(i)}
                    className={cn(
                      "relative cursor-pointer border-b-2 px-3 py-2.5 text-xs font-semibold transition-all",
                      activeTab === i
                        ? "border-rose-500 font-bold text-rose-500 dark:text-rose-400"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content pages */}
              <div className="flex max-h-[380px] min-h-[300px] scrollbar-thin scrollbar-thumb-zinc-800 flex-col justify-between overflow-y-auto px-6 py-4">
                <AnimatePresence mode="wait">
                  {activeTab === 0 && (
                    <motion.div
                      key="welcome-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 text-left"
                    >
                      <div className="space-y-2">
                        <h3 className="text-foreground text-sm font-semibold">
                          Welcome to your Stash!
                        </h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Stashes help you organize your research notes. Keep wiki pages, save
                          media, and forum threads cataloged together.
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Create color-coded folders to organize your Stashes into distinct themes
                          like <em>Characters</em>, <em>Locations</em>, or <em>Read later</em>.
                        </p>
                      </div>

                      <div
                        className="force-gpu relative overflow-hidden rounded-xl border border-black/10 bg-gradient-to-br from-black/[0.06] to-black/[0.02] p-3 shadow-lg transition-all duration-300 dark:border-white/20 dark:from-white/15 dark:to-white/5"
                        style={{
                          backdropFilter: "blur(20px) saturate(145%)",
                          WebkitBackdropFilter: "blur(20px) saturate(145%)",
                          isolation: "isolate",
                        }}
                      >
                        {/* Refraction edges */}
                        <div className="pointer-events-none absolute inset-0 z-0">
                          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-black/15 to-transparent dark:via-white/35" />
                          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-black/10 to-transparent dark:via-white/25" />
                          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-black/15 to-transparent dark:via-white/35" />
                          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-black/10 to-transparent dark:via-white/25" />
                          <div
                            className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-black/5 to-transparent dark:via-white/10"
                            style={{
                              animationDuration: "3s",
                              animationTimingFunction: "ease-in-out",
                            }}
                          />
                        </div>

                        {/* Content */}
                        <div className="relative z-10 text-left">
                          <div className="mb-1.5 flex items-center gap-2">
                            <Eye className="h-4 w-4 text-rose-500" />
                            <span className="text-foreground/90 text-xs font-semibold">
                              Seamless Workflow
                            </span>
                          </div>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            No more bookmarking raw browser links or copying text to external
                            notebooks. Stashed articles feature inline markup capabilities, letting
                            you overlay highlights and personal notes directly onto live wiki
                            content.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 1 && (
                    <motion.div
                      key="markup-tab"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 text-left"
                    >
                      {MARKUP_STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div
                            key={step.title}
                            className="border-border bg-card hover:border-border-accent hover:bg-muted/50 rounded-xl border p-3 transition-colors"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                              <span className="text-foreground/90 text-xs font-semibold">
                                {step.title}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {activeTab === 2 && (
                    <motion.div
                      key="image-tab"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 text-left"
                    >
                      {IMAGE_STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div
                            key={step.title}
                            className="border-border bg-card hover:border-border-accent hover:bg-muted/50 rounded-xl border p-3 transition-colors"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                              <span className="text-foreground/90 text-xs font-semibold">
                                {step.title}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}

                  {activeTab === 3 && (
                    <motion.div
                      key="threads-tab"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 text-left"
                    >
                      {THREAD_STEPS.map((step) => {
                        const Icon = step.icon;
                        return (
                          <div
                            key={step.title}
                            className="border-border bg-card hover:border-border-accent hover:bg-muted/50 rounded-xl border p-3 transition-colors"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${step.color}`} />
                              <span className="text-foreground/90 text-xs font-semibold">
                                {step.title}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[10px] leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-border/30 flex items-center justify-between border-t px-6 py-4">
                <div />
                <button
                  onClick={handleClose}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-rose-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-rose-400"
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
