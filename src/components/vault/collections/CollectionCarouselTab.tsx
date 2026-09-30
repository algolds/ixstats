"use client";

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
      className="facet-hierarchy-parent rounded-lg p-6 sm:p-8"
    >
      <h2 className="mb-6 text-center text-xl font-bold text-white sm:text-2xl">
        3D Card Showcase
      </h2>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Sparkles className="mb-4 h-16 w-16 text-white/20" />
          <p className="mb-2 text-white/70">No cards in this collection yet</p>
          <Button
            size="sm"
            className="from-gold-500 mt-4 bg-gradient-to-r to-orange-500 text-black"
          >
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
              transition={{ duration: 0.5 }}
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
            <Button onClick={onPrev} variant="outline" size="sm" className="facet-hierarchy-child">
              Previous
            </Button>
            <span className="text-sm text-white/70">
              {currentIndex + 1} / {cards.length}
            </span>
            <Button onClick={onNext} variant="outline" size="sm" className="facet-hierarchy-child">
              Next
            </Button>
          </div>

          {/* Card info */}
          <div className="facet-hierarchy-child max-w-md rounded-lg p-4 text-center">
            <h3 className="mb-2 text-lg font-bold text-white">{cards[currentIndex]?.title}</h3>
            <p className="text-sm text-white/70">
              {cards[currentIndex]?.description || "No description"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
