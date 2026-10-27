"use client";

/**
 * MobileEditorSheet - Bottom sheet for mobile editor panels.
 *
 * The map editor's property panel and feature list on phones, as a bottom `Sheet`:
 * medium/large detents, grabber and drag-to-dismiss, scrim tap and Escape to
 * close, safe-area padding. A `SegmentedControl` switches Properties | Features.
 */

import { useState } from "react";
import { Settings as Settings2, List } from "iconoir-react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";

type MobileTab = "properties" | "features";

interface MobileEditorSheetProps {
  /** Content for the properties tab */
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  /** Content for the features tab */
  featureListContent?: React.ReactNode;
  /** Content for the wiki tab */
  wikiContent?: React.ReactNode;
  /** Whether the editor is in an add/edit mode (controls default tab) */
  isEditMode?: boolean;
}

const MOBILE_TABS: { id: MobileTab; label: string; Icon: typeof Settings2 }[] = [
  { id: "properties", label: "Properties", Icon: Settings2 },
  { id: "features", label: "Features", Icon: List },
];

export function MobileEditorSheet({
  children,
  onClose,
  title,
  featureListContent,
  // oxlint-disable-next-line eslint/no-unused-vars
  wikiContent,
  isEditMode = true,
}: MobileEditorSheetProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>(isEditMode ? "properties" : "features");

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" detents={["medium", "large"]} className="gap-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{title ?? "Map editor"}</SheetTitle>
        </SheetHeader>

        <div className="border-separator shrink-0 border-b pb-2">
          <SegmentedControl
            aria-label="Editor panel"
            asTabs
            fullWidth
            size="sm"
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as MobileTab)}
            options={MOBILE_TABS.filter((tab) => tab.id !== "properties" || isEditMode).map(
              (tab) => ({ value: tab.id, label: tab.label, icon: <tab.Icon aria-hidden /> })
            )}
          />
        </div>

        {title && activeTab === "properties" && (
          <div className="pt-2 pb-2">
            <h3 className="text-label text-headline">{title}</h3>
          </div>
        )}

        <div className="pb-4">
          {activeTab === "properties" && children}
          {activeTab === "features" &&
            (featureListContent ?? (
              <div className="text-label-secondary text-footnote py-6 text-center">
                No features content available
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
