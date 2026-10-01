"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  Database,
  ControlSlider as SlidersHorizontal,
  Bookmark,
  Copy,
  Sparks as Sparkles,
  InfoCircle as Info,
  Emoji as Smile,
  Eye,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { tweenFast } from "~/lib/design/motion";
import { WIKIOS_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "wikios-repository-welcome-seen";

const MAIN_STEPS = [
  {
    icon: Globe,
    color: "text-blue",
    bg: "bg-blue/10",
    title: "1. Commons Search",
    description:
      "Explore millions of public domain and creative commons images directly from Wikimedia Commons via high-speed API search.",
  },
  {
    icon: Database,
    color: "text-indigo",
    bg: "bg-indigo/10",
    title: "2. IxWiki Database",
    description:
      "Switch to the IxWiki tab to search and browse local images uploaded by players directly on our wiki platform.",
  },
  {
    icon: SlidersHorizontal,
    color: "text-teal",
    bg: "bg-teal/10",
    title: "3. Advanced Filters",
    description:
      "Instantly narrow search results by file type (JPEG, PNG, SVG) and aspect ratio orientation (Landscape, Portrait, Square).",
  },
  {
    icon: Bookmark,
    color: "text-yellow",
    bg: "bg-yellow/10",
    title: "4. Personal Stash",
    description:
      "Save images to your personal library stash so you can access, reuse, and insert them later without searching again.",
  },
];

const ADVANCED_TIPS = [
  {
    icon: Copy,
    color: "text-blue",
    title: "Format Selector",
    description:
      "Use the Wikitext copy format segmented bar to instantly grab Thumbnail codes, static pixel embeds, raw file links, or absolute image URLs.",
  },
  {
    icon: Sparkles,
    color: "text-yellow",
    title: "Interactive Lightbox",
    description:
      "Click on any image preview inside the detail sidebar to trigger an immersive fullscreen zoom view for detailed inspection.",
  },
  {
    icon: Info,
    color: "text-teal",
    title: "Artist & License Tags",
    description:
      "Hover or check the metadata section to copy accurate creator attribution and license requirements to remain copyright compliant.",
  },
  {
    icon: Smile,
    color: "text-blue",
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
    } catch {
      // storage unavailable (private mode) — preference is not persisted
    }
  }, [onOpenChangeAction]);

  const TABS = ["Getting Started", "Features", "Tips", "FAQ Guide"];

  return (
    <Dialog open={show} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pr-14 pb-3">
          <div className="flex items-center gap-3 text-left">
            <div className="rounded-row bg-tint-fill text-tint flex size-10 shrink-0 items-center justify-center">
              <Globe className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-title-3">Image Repository Guide</DialogTitle>
              <DialogDescription className="text-footnote">
                Search, filter, and copy media wikitext embeds.
              </DialogDescription>
            </div>
          </div>
          <Badge variant="neutral" className="tabular-nums">
            v{WIKIOS_VERSION}
          </Badge>
        </div>

        {/* Tab selector */}
        <div className="border-separator border-b px-6 pb-3">
          <SegmentedControl
            aria-label="Guide sections"
            size="sm"
            fullWidth
            value={String(activeTab)}
            onValueChange={(v) => setActiveTab(Number(v))}
            options={TABS.map((tab, i) => ({ value: String(i), label: tab }))}
          />
        </div>

        {/* Content pages */}
        <div className="flex max-h-[380px] min-h-[300px] flex-col overflow-y-auto px-6 py-4">
          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 0 && (
              <motion.div key="welcome-tab" {...tabMotion} className="space-y-4 text-left">
                <div className="space-y-2">
                  <h3 className="text-headline text-label">Welcome to the Image Repository!</h3>
                  <p className="text-callout text-label-secondary">
                    The Image Repository serves as a centralized hub to browse media. Editors can
                    quickly fetch assets, view their attributes, and copy formatted MediaWiki
                    wikitext strings to speed up editing.
                  </p>
                  <p className="text-callout text-label-secondary">
                    Search results span millions of licensed graphics from Wikimedia Commons, as
                    well as community-uploaded files.
                  </p>
                </div>

                <div className="rounded-row bg-surface-secondary p-3 text-left">
                  <div className="mb-2 flex items-center gap-2">
                    <Eye className="text-tint size-4" aria-hidden="true" />
                    <span className="text-headline text-label">Visual-First Discovery</span>
                  </div>
                  <p className="text-footnote text-label-secondary">
                    A visual media explorer is vastly superior to blind markup guessing. Browse
                    images interactively, filter by size or orientation, and inspect layouts in
                    real-time before you publish.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 1 && (
              <motion.div
                key="steps-grid"
                {...tabMotion}
                className="grid grid-cols-2 gap-2 text-left"
              >
                {MAIN_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="rounded-row bg-surface-secondary p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className={cn("size-3.5 shrink-0", step.color)} aria-hidden="true" />
                        <span className="text-caption text-label">{step.title}</span>
                      </div>
                      <p className="text-footnote text-label-secondary">{step.description}</p>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {activeTab === 2 && (
              <motion.div key="ui-tips" {...tabMotion} className="space-y-2 text-left">
                {ADVANCED_TIPS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-row bg-surface-secondary flex items-start gap-3 p-3"
                    >
                      <div className="rounded-control-sm bg-fill-3 shrink-0 p-1">
                        <Icon className={cn("size-3.5", item.color)} aria-hidden="true" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-caption text-label">{item.title}</h4>
                        <p className="text-footnote text-label-secondary">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {activeTab === 3 && (
              <motion.div key="faq-tab" {...tabMotion} className="space-y-3 text-left">
                <h3 className="text-subhead text-label-secondary flex items-center gap-2">
                  <Info className="text-tint size-3.5" aria-hidden="true" />
                  Common questions
                </h3>
                <div className="space-y-3">
                  {REPOSITORY_FAQ.map((faq) => (
                    <div key={faq.q} className="space-y-1">
                      <h4 className="text-caption text-label flex items-start gap-2">
                        <span className="text-tint">Q:</span>
                        {faq.q}
                      </h4>
                      <p className="text-footnote text-label-secondary pl-4">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-separator flex items-center justify-end border-t px-6 py-4">
          <Button size="sm" onClick={handleClose}>
            Explore Repository
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const tabMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: tweenFast,
} as const;

const REPOSITORY_FAQ = [
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
];
