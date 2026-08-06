"use client";

import React from "react";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { parseWikiContent } from "~/lib/dossier-parser";

interface WikiContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: {
    title: string;
    content: string;
    id: string;
  } | null;
  handleWikiLinkClick: (page: string) => void;
  flagColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  enableIxWiki: boolean;
}

const WikiContentModal: React.FC<WikiContentModalProps> = ({
  isOpen,
  onClose,
  section,
  handleWikiLinkClick,
  flagColors,
  enableIxWiki,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-zinc-950/95 border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-white/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold tracking-tight text-foreground">
                {section?.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Full section content from {enableIxWiki ? "IxWiki" : "MediaWiki"} database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {section && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-8 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/[0.06] gap-1.5"
              >
                <Link href={titleToWikiOSPath(section.title)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  WikiOS Source
                </Link>
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          {section && (
            <div className="space-y-6">
              <div className="prose prose-sm prose-invert max-w-none text-xs sm:text-sm leading-relaxed text-muted-foreground/95">
                {parseWikiContent(section.content, handleWikiLinkClick)}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WikiContentModal;
