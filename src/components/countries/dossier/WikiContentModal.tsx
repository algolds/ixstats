"use client";

import React from "react";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
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
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden rounded-2xl border-white/10 bg-zinc-950/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/15 p-2 text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-base font-extrabold tracking-tight">
                {section?.title}
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
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
                className="text-muted-foreground hover:text-foreground h-8 gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold hover:bg-white/[0.06]"
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
              <div className="prose prose-sm prose-invert text-muted-foreground/95 max-w-none text-xs leading-relaxed sm:text-sm">
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
