"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "~/components/ui/button";
import { Sparks as Sparkles, Plus } from "iconoir-react";
import type { CardInstance } from "~/types/cards-display";

const Card3DViewer = dynamic(
  () => import("~/components/cards/display/Card3DViewer").then((m) => m.Card3DViewer),
  { ssr: false }
);

export interface CollectionCarouselTabProps {
  cards: CardInstance[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}

export function CollectionCarouselTab({
  cards,
  currentIndex,
  onNext,
  onPrev,
}: CollectionCarouselTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface border-separator shadow-card rounded-control border p-6 sm:p-8"
    >
      <h2 className="text-title-2 text-label sm:text-title-1 mb-6 text-center">3D Card Showcase</h2>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Sparkles className="text-label-tertiary mb-4 h-16 w-16" />
          <p className="text-label-secondary mb-2">No cards in this collection yet</p>
          <Button size="sm" className="mt-4 text-black">
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Card
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* 3D Card Viewer */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              transition={springSmooth}
            >
              <Card3DViewer
                card={cards[currentIndex]!}
                size="large"
                enableFlip={true}
                enableDragRotation={true}
                enableMouseTracking={true}
              />
            </motion.div>
          </AnimatePresence>

          {/* Carousel controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={onPrev}
              variant="outline"
              size="sm"
              className="bg-surface-secondary border"
            >
              Previous
            </Button>
            <span className="text-body text-label-secondary">
              {currentIndex + 1} / {cards.length}
            </span>
            <Button
              onClick={onNext}
              variant="outline"
              size="sm"
              className="bg-surface-secondary border"
            >
              Next
            </Button>
          </div>

          {/* Card info */}
          <div className="bg-surface-secondary border-separator rounded-control max-w-md border p-4 text-center">
            <h3 className="text-title-3 text-label mb-2">{cards[currentIndex]?.title}</h3>
            <p className="text-body text-label-secondary">
              {cards[currentIndex]?.description || "No description"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
