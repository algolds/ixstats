"use client";

import React from "react";
import { motion } from "motion/react";
import { Card3DViewer } from "../Card3DViewer";
import type { CardInstance } from "~/types/cards-display";

export function Card3DTab({ card }: { card: CardInstance }) {
  return (
    <div className="flex min-h-[500px] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-6"
      >
        <Card3DViewer
          card={card}
          size="large"
          enableFlip={true}
          enableDragRotation={true}
          enableMouseTracking={true}
        />
        <div className="space-y-2 text-center">
          <p className="text-muted-foreground text-sm">Drag to rotate • Click to flip</p>
          <p className="text-muted-foreground/60 text-xs">
            Experience the card in interactive 3D
          </p>
        </div>
      </motion.div>
    </div>
  );
}
