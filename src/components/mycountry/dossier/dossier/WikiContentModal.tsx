"use client";

import React from "react";
import Link from "next/link";
import { titleToWikiOSPath } from "~/lib/wiki-os/transformers/url-compat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { OpenBook as BookOpen, OpenNewWindow as ExternalLink } from "iconoir-react";
import { parseWikiContent } from "~/lib/builder";

interface WikiContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: {
    title: string;
    content: string;
    id?: string;
  } | null;
  handleWikiLinkClick: (page: string) => void;
  flagColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

const WikiContentModal: React.FC<WikiContentModalProps> = ({
  isOpen,
  onClose,
  section,
  handleWikiLinkClick,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-border flex flex-row items-center justify-between border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-3">
            <BookOpen className="text-muted-foreground h-5 w-5 shrink-0" />
            <div>
              <DialogTitle className="text-foreground text-base font-semibold">
                {section?.title}
              </DialogTitle>
              <p className="text-muted-foreground text-xs">
                Full section content from WikiOS knowledge base
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {section && (
              <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs">
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
