/**
 * WikiContentModal Component
 *
 * Full-screen modal for displaying complete wiki section content with rich media support.
 * Renders parsed wiki content including infoboxes, images, and interactive wiki links.
 *
 * @component
 * @example
 * ```tsx
 * <WikiContentModal
 *   isOpen={!!modalSection}
 *   onClose={() => setModalSection(null)}
 *   section={modalSection}
 *   handleWikiLinkClick={handleWikiLinkClick}
 *   flagColors={{ primary: "#4A90E2", secondary: "#E24A4A", accent: "#4AE290" }}
 *   enableIxWiki={true}
 * />
 * ```
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { RiBookOpenLine, RiExternalLinkLine } from "react-icons/ri";
import { parseWikiContent } from "~/lib/wiki-intelligence-parser";

/**
 * Props for WikiContentModal component
 */
interface WikiContentModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Section data to display (null when closed) */
  section: {
    /** Section title */
    title: string;
    /** Raw wiki content */
    content: string;
    /** Section identifier */
    id: string;
  } | null;
  /** Handler for internal wiki link clicks */
  handleWikiLinkClick: (page: string) => void;
  /** Flag colors for themed styling */
  flagColors: {
    /** Primary theme color */
    primary: string;
    /** Secondary theme color */
    secondary: string;
    /** Accent theme color */
    accent: string;
  };
  /** Whether IxWiki integration is enabled */
  enableIxWiki: boolean;
}

/**
 * Full-screen modal component for displaying complete wiki section content
 * with rich media rendering and external wiki navigation.
 */
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
      <DialogContent className="h-[95vh] max-h-[80vh] w-[95vw] max-w-[80vw] sm:h-[90vh] sm:w-[90vw] lg:h-[80vh] lg:w-[80vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiBookOpenLine className="h-5 w-5" style={{ color: flagColors.primary }} />
            {section?.title}
          </DialogTitle>
          <DialogDescription>
            Full content from {enableIxWiki ? "IxWiki" : "MediaWiki"} archives
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(95vh-120px)] pr-4 sm:h-[calc(90vh-120px)] lg:h-[calc(80vh-120px)]">
          {section && (
            <div className="space-y-4">
              <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                {parseWikiContent(section.content, handleWikiLinkClick)}
              </div>

              <div className="border-border/30 flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Use the section title directly as it's already the correct page name
                    window.open(
                      `https://ixwiki.com/wiki/${encodeURIComponent(section.title)}`,
                      "_blank"
                    );
                  }}
                  className="flex-1"
                >
                  <RiExternalLinkLine className="mr-1 h-3 w-3" />
                  View on IxWiki
                </Button>
                <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default WikiContentModal;
