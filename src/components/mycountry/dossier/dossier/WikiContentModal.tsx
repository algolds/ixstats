"use client";

import React from "react";
import Link from "next/link";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { OpenBook as BookOpen, OpenNewWindow as ExternalLink } from "iconoir-react";
import { parseWikiContent } from "~/lib/builder";
import { FACET_PROSE } from "~/components/maps/shared/facet-prose";
import { cn } from "~/lib/utils/cn";

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="wide" className="flex flex-col overflow-hidden p-0">
        <SheetHeader className="border-separator flex flex-row items-center justify-between border-b px-6 py-4 pr-12">
          <div className="flex items-center gap-3">
            <BookOpen className="text-label-secondary h-5 w-5 shrink-0" />
            <div>
              <SheetTitle className="text-label text-title-3">{section?.title}</SheetTitle>
              <p className="text-label-secondary text-footnote">
                Full section content from WikiOS knowledge base
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {section && (
              <Button size="sm" variant="outline" asChild className="text-footnote h-8 gap-2">
                <Link href={titleToWikiOSRoute(section.title)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  WikiOS source
                </Link>
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6">
          {section && (
            <div className="space-y-6">
              <div
                className={cn(FACET_PROSE, "prose-sm text-footnote sm:text-body leading-relaxed")}
              >
                {parseWikiContent(section.content, handleWikiLinkClick)}
              </div>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default WikiContentModal;
