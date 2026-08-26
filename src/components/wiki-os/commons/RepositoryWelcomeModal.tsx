"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Xmark as X,
  Globe,
  Database,
  ControlSlider as SlidersHorizontal,
  Bookmark,
  Copy,
  // oxlint-disable-next-line eslint/no-unused-vars
  OpenNewWindow as ExternalLink,
  Sparks as Sparkles,
  InfoCircle as Info,
  Emoji as Smile,
  Eye,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { WIKIOS_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "wikios-repository-welcome-seen";

const MAIN_STEPS = [
  {
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "1. Commons Search",
    description:
      "Explore millions of public domain and creative commons images directly from Wikimedia Commons via high-speed API search.",
  },
  {
    icon: Database,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "2. IxWiki Database",
    description:
      "Switch to the IxWiki tab to search and browse local images uploaded by players directly on our wiki platform.",
  },
  {
    icon: SlidersHorizontal,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    title: "3. Advanced Filters",
    description:
      "Instantly narrow search results by file type (JPEG, PNG, SVG) and aspect ratio orientation (Landscape, Portrait, Square).",
  },
  {
    icon: Bookmark,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "4. Personal Stash",
    description:
      "Save images to your personal library stash so you can access, reuse, and insert them later without searching again.",
  },
];

const ADVANCED_TIPS = [
  {
    icon: Copy,
    color: "text-blue-400",
    title: "Format Selector",
    description:
      "Use the Wikitext copy format segmented bar to instantly grab Thumbnail codes, static pixel embeds, raw file links, or absolute image URLs.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    title: "Interactive Lightbox",
    description:
      "Click on any image preview inside the detail sidebar to trigger an immersive fullscreen zoom view for detailed inspection.",
  },
  {
    icon: Info,
    color: "text-cyan-400",
    title: "Artist & License Tags",
    description:
      "Hover or check the metadata section to copy accurate creator attribution and license requirements to remain copyright compliant.",
  },
  {
    icon: Smile,
    color: "text-pink-400",
    title: "Keyboard Shortcuts",
    description:
      "Close the detail panel by pressing 'Escape'. Use the standard search inputs to instantly filter categories dynamically.",
  },
];

export function RepositoryWelcomeModal({
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
        if (!seen || seen !== WIKIOS_VERSION) {
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
      localStorage.setItem(STORAGE_KEY, WIKIOS_VERSION);
    } catch {}
  }, [onOpenChangeAction]);

  const TABS = ["Getting Started", "Features", "Tips", "FAQ Guide"];

  if (!mounted || !show) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop with premium blur */}
          <motion.div
            key="repo-welcome-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[120000] bg-zinc-950/40 backdrop-blur-[12px] dark:bg-black/60"
            onClick={handleClose}
          />

          {/* Modal Overlay */}
          <motion.div
            key="repo-welcome-modal"
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-foreground text-base font-semibold">
                        Image Repository Guide
                      </h2>
                      <p className="text-muted-foreground text-xs">
                        Search, filter, and copy media wikitext embeds.
                      </p>
                    </div>
                  </div>
                  <span className="bg-muted border-border text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-[10px]">
                    v{WIKIOS_VERSION}
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
                        ? "text-blue-550 border-blue-500 font-bold dark:text-blue-400"
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
                          Welcome to the Image Repository!
                        </h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          The Image Repository serves as a centralized hub to browse media. Editors
                          can quickly fetch assets, view their attributes, and copy formatted
                          MediaWiki wikitext strings to speed up editing.
                        </p>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Search results span millions of licensed graphics from Wikimedia Commons,
                          as well as community-uploaded files.
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
                        {/* Refraction edges - identical to Dynamic Island */}
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
                            <Eye className="h-4 w-4 text-blue-500" />
                            <span className="text-foreground/90 text-xs font-semibold">
                              Visual-First Discovery
                            </span>
                          </div>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            A visual media explorer is vastly superior to blind markup guessing.
                            Browse images interactively, filter by size or orientation, and inspect
                            layouts in real-time before you publish.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 1 && (
                    <motion.div
                      key="steps-grid"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 gap-2.5 text-left"
                    >
                      {MAIN_STEPS.map((step) => {
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
                      key="ui-tips"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 text-left"
                    >
                      <div className="space-y-2">
                        {ADVANCED_TIPS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.title}
                              className="border-border bg-card flex items-start gap-3 rounded-lg border p-2.5"
                            >
                              <div className="bg-muted shrink-0 rounded p-1">
                                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-foreground/90 text-xs font-semibold">
                                  {item.title}
                                </h4>
                                <p className="text-muted-foreground text-[10px] leading-normal">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 3 && (
                    <motion.div
                      key="faq-tab"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3.5 text-left"
                    >
                      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold">
                        <Info className="h-3.5 w-3.5 text-blue-500" />
                        Common Questions
                      </h3>
                      <div className="space-y-3">
                        {[
                          {
                            q: "What do the different format options output?",
                            a: "Thumb produces '[[File:Example.jpg|thumb|Caption]]' which renders as a captioned thumbnail. Embed generates a fixed size '[[File:Example.jpg|250px]]'. File generates raw wikitext '[[File:Example.jpg]]' with no extra properties. URL outputs the raw direct link to the image file.",
                          },
                          {
                            q: "What does the Stash (Bookmark) button do?",
                            a: "If you are logged in, clicking the Stash bookmark saves that media reference into your WikiOS stashes library. You can retrieve it instantly from the 'Stashes' rail sidebar link when drafting articles.",
                          },
                          {
                            q: "How does orientation detection work?",
                            a: "We calculate orientation in real time by comparing width-to-height aspect ratios. Portrait filters files with ratio < 0.9, Landscape filters files with ratio > 1.1, and Square captures anything in between.",
                          },
                        ].map((faq, idx) => (
                          <div key={idx} className="space-y-1">
                            <h4 className="text-foreground flex items-start gap-1.5 text-xs font-bold">
                              <span className="font-bold text-blue-500">Q:</span>
                              {faq.q}
                            </h4>
                            <p className="text-muted-foreground pl-4 text-[10px] leading-relaxed">
                              {faq.a}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="border-border/30 flex items-center justify-between border-t px-6 py-4">
                <div />
                <button
                  onClick={handleClose}
                  className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-blue-400"
                >
                  Explore Repository
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
