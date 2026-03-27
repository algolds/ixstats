"use client";

/**
 * MobileEditorSheet - Bottom sheet for mobile editor panels.
 *
 * Adapts the SwipeableBottomSheet pattern for the map editor's property
 * panel and feature list. Only rendered on mobile (<sm breakpoint).
 *
 * Features:
 * - Swipe-down to dismiss (80px threshold)
 * - Smooth drag feedback with translateY
 * - Backdrop tap to close
 * - Safe area padding for iOS home indicator
 * - Mini tab bar: Properties | Features | Wiki
 */

import { useRef, useCallback, useState } from "react";
import { Settings2, List, BookOpen } from "lucide-react";

type MobileTab = "properties" | "features" | "wiki";

interface MobileEditorSheetProps {
  /** Content for the properties tab */
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  maxHeight?: string;
  /** Content for the features tab */
  featureListContent?: React.ReactNode;
  /** Content for the wiki tab */
  wikiContent?: React.ReactNode;
  /** Whether the editor is in an add/edit mode (controls default tab) */
  isEditMode?: boolean;
}

const DISMISS_THRESHOLD = 80;

const MOBILE_TABS: { id: MobileTab; label: string; Icon: typeof Settings2 }[] = [
  { id: "properties", label: "Properties", Icon: Settings2 },
  { id: "features", label: "Features", Icon: List },
  { id: "wiki", label: "Wiki", Icon: BookOpen },
];

export function MobileEditorSheet({
  children,
  onClose,
  title,
  maxHeight = "70vh",
  featureListContent,
  wikiContent,
  isEditMode = true,
}: MobileEditorSheetProps) {
  const startYRef = useRef(0);
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<MobileTab>(
    isEditMode ? "properties" : "features"
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startYRef.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = Math.max(0, touch.clientY - startYRef.current);
      setDragDelta(delta);
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragDelta > DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragDelta(0);
    }
  }, [dragDelta, onClose]);

  return (
    <div className="absolute inset-0 z-30 sm:hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Sheet */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          animation:
            dragDelta === 0 && !isDragging
              ? "editorSheetSlideUp 0.25s ease-out"
              : undefined,
        }}
      >
        <div
          className="rounded-t-2xl bg-card shadow-xl"
          style={{
            maxHeight,
            transform: dragDelta > 0 ? `translateY(${dragDelta}px)` : undefined,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
            opacity: dragDelta > DISMISS_THRESHOLD ? 0.6 : 1,
          }}
        >
          {/* Drag handle */}
          <div
            className="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Mini tab bar */}
          <div className="flex h-9 shrink-0 border-b border-border mx-3">
            {MOBILE_TABS.map((tab) => {
              // Only show Properties when in add/edit mode
              if (tab.id === "properties" && !isEditMode) return null;

              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <tab.Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Title bar (only for properties tab) */}
          {title && activeTab === "properties" && (
            <div className="px-4 pb-2 pt-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
          )}

          {/* Content — scrollable */}
          <div
            className="overflow-y-auto overscroll-contain px-4 pb-8"
            style={{ maxHeight: `calc(${maxHeight} - 5rem)` }}
          >
            {activeTab === "properties" && children}
            {activeTab === "features" && (
              featureListContent ?? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No features content available
                </div>
              )
            )}
            {activeTab === "wiki" && (
              wikiContent ?? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Wiki scanner coming soon
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes editorSheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
