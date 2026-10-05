"use client";
// User guide for the Stash System across WikiOS & IxStates.
// Features unslop writing, 4-tab feature overview.

import { motion, AnimatePresence } from "motion/react";
import {
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
  Search,
  Download,
  ShareIos,
} from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { tweenFast } from "~/lib/design/motion";
import { STASHES_WELCOME_VERSION } from "~/lib/buildVersion";
import { useWelcomeModal } from "~/components/wiki-os/shared/useWelcomeModal";

const STORAGE_KEY = "wikios-stashes-welcome-seen";

const OVERVIEW_STEPS = [
  {
    icon: FolderOpen,
    color: "text-red",
    title: "Color-coded collections",
    description:
      "Group research into named folders like Fleet Doctrine or Treaties with 8 preset color tags.",
  },
  {
    icon: Plus,
    color: "text-yellow",
    title: "Quick creation popover",
    description:
      "Open the creation popover from the header or sidebar to add a collection without leaving the page.",
  },
  {
    icon: Download,
    color: "text-green",
    title: "Markdown and JSON export",
    description:
      "Download any collection as a formatted markdown document or structured JSON data file.",
  },
  {
    icon: ShareIos,
    color: "text-teal",
    title: "Shareable links",
    description: "Copy direct links to any collection to share research lists with other players.",
  },
];

const ARTICLE_STEPS = [
  {
    icon: WikiOSLogomark,
    color: "text-blue",
    title: "Article bookmarks",
    description:
      "Save wiki pages with automatic lead thumbnail images, word counts, and edit dates.",
  },
  {
    icon: Highlighter,
    color: "text-yellow",
    title: "Quotes and highlights",
    description:
      "Highlights created in WikiOS Margin sync to your Quotes tab with their comments and direct links.",
  },
  {
    icon: Search,
    color: "text-indigo",
    title: "Search your stash",
    description: "Filter saved pages, quotes, media, and threads by title or quoted text.",
  },
  {
    icon: Clock,
    color: "text-teal",
    title: "Fast reader jumping",
    description:
      "Click any saved quote or page to open the article at that exact section in WikiOS.",
  },
];

const MEDIA_STEPS = [
  {
    icon: Globe,
    color: "text-blue",
    title: "Commons and uploads",
    description:
      "Save Wikimedia Commons graphics or local image uploads directly to your collection.",
  },
  {
    icon: Sparkles,
    color: "text-yellow",
    title: "Wikitext snippets",
    description: "Copy ready-to-paste wikitext markup for thumbnails, links, or full-width embeds.",
  },
  {
    icon: Info,
    color: "text-teal",
    title: "Metadata inspection",
    description: "View file dimensions, MIME types, licenses, and artist attribution.",
  },
  {
    icon: Eye,
    color: "text-blue",
    title: "Interactive lightbox",
    description: "Inspect images in full resolution with keyboard navigation and zoom.",
  },
];

const FORUM_STEPS = [
  {
    icon: MessageSquare,
    color: "text-orange",
    title: "Thread bookmarks",
    description:
      "Save regional forum threads, debates, and policy proposals in your research lists.",
  },
  {
    icon: Download,
    color: "text-green",
    title: "Exports included",
    description:
      "Saved threads go out with the rest of the collection in markdown and JSON exports.",
  },
  {
    icon: Clock,
    color: "text-teal",
    title: "Activity links",
    description: "Jump straight to the live thread on the regional forum board.",
  },
  {
    icon: Bookmark,
    color: "text-red",
    title: "Unified lore vault",
    description:
      "Keep articles, clipped quotes, media, and forum threads together under one topic.",
  },
];

const TABS = [
  { label: "Overview", steps: OVERVIEW_STEPS },
  { label: "Articles & quotes", steps: ARTICLE_STEPS },
  { label: "Media assets", steps: MEDIA_STEPS },
  { label: "Forum threads", steps: FORUM_STEPS },
];

export function StashWelcomeModal({
  open,
  onOpenChangeAction,
}: {
  open?: boolean;
  onOpenChangeAction?: (open: boolean) => void;
}) {
  const { show, activeTab, setActiveTab, handleClose } = useWelcomeModal({
    open,
    onOpenChangeAction,
    storageKey: STORAGE_KEY,
    version: STASHES_WELCOME_VERSION,
  });

  const currentSteps = TABS[activeTab]?.steps ?? OVERVIEW_STEPS;

  return (
    <Dialog open={show} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 select-none">
        {/* Header */}
        <div className="px-6 pt-6 pr-14 pb-3">
          <div className="flex items-center gap-3 text-left">
            <div className="rounded-row bg-red/15 text-red flex size-10 shrink-0 items-center justify-center">
              <Bookmark className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-title-3">Stash guide</DialogTitle>
              <DialogDescription className="text-footnote">
                Save-for-later, built for lore.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="border-separator border-b px-6 pb-3">
          <SegmentedControl
            aria-label="Guide sections"
            size="sm"
            fullWidth
            value={String(activeTab)}
            onValueChange={(v) => setActiveTab(Number(v))}
            options={TABS.map((tab, i) => ({ value: String(i), label: tab.label }))}
          />
        </div>

        {/* Content grid */}
        <div className="max-h-[360px] min-h-[260px] overflow-y-auto px-6 py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tweenFast}
              className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2"
            >
              {currentSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-row bg-surface-secondary space-y-2 p-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-control-sm bg-fill-3 flex size-6 shrink-0 items-center justify-center">
                        <Icon className={cn("size-3.5", step.color)} aria-hidden="true" />
                      </div>
                      <h4 className="text-caption text-label">{step.title}</h4>
                    </div>
                    <p className="text-footnote text-label-secondary">{step.description}</p>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-separator flex items-center justify-end border-t px-6 py-4">
          <Button size="sm" onClick={handleClose}>
            Start stashing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
