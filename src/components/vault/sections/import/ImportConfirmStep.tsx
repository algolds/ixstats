"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import {
  CheckCircle,
  InfoCircle as Info,
  ArrowLeft,
  Download,
  Package,
  Coins,
  ArrowRight,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { Card } from "~/components/ui/card";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

export interface ImportResult {
  cardsImported: number;
  bonusCredits: number;
  nation: string;
  cards: Array<{
    id: string;
    title: string;
    artwork: string;
    rarity: string;
    season: number;
    marketValue: number;
  }>;
}

export function ImportConfirmStep({
  nationName,
  onBack,
  onConfirmImport,
}: {
  nationName: string;
  onBack: () => void;
  onConfirmImport: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-2 text-center">
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="bg-green/20 ring-green/30 mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-2"
        >
          <CheckCircle className="text-green h-8 w-8" />
        </motion.div>
        <h2 className="text-label text-title-1">Nation verified</h2>
        <p className="text-label-secondary text-body mt-2">
          <span className="text-green font-semibold">{nationName}</span> is confirmed as yours
        </p>
      </div>

      <Card className="rounded-row border-green/30 bg-green/10 p-5">
        <div className="flex items-start gap-3">
          <Info className="text-green mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-label-secondary text-body">
            <p className="text-label mb-1 font-semibold">Ready to import</p>
            <p>
              This will fetch your NationStates trading card deck and create IxCards versions. The
              process takes a few seconds depending on deck size.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onConfirmImport} className="flex-1" size="lg">
          <Download className="mr-2 h-4 w-4" /> Import Deck
        </Button>
      </div>
    </div>
  );
}

export function ImportCompleteStep({
  importResult,
  onReset,
}: {
  importResult: ImportResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-4 text-center">
        {/* Celebration burst */}
        <div className="relative mb-6">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="bg-yellow absolute h-1.5 w-1.5 rounded-full"
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{
                x: Math.cos((i / 6) * Math.PI * 2) * 50,
                y: Math.sin((i / 6) * Math.PI * 2) * 50,
                opacity: [0, 1, 0],
                scale: [0.2, 1.5, 0],
              }}
              transition={{ ...springSmooth, delay: 0.2 + i * 0.05 }}
              style={{ left: "50%", top: "50%" }}
            />
          ))}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="bg-green/20 ring-green/30 relative flex h-20 w-20 items-center justify-center rounded-full ring-2"
          >
            <CheckCircle className="text-green h-10 w-10" />
          </motion.div>
        </div>

        <motion.h2
          className="text-label text-large-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Import complete
        </motion.h2>
        <motion.p
          className="text-label-secondary text-body mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Your deck from <span className="text-green font-semibold">{importResult.nation}</span> has
          been imported
        </motion.p>
      </div>

      {/* Result stat cards */}
      <motion.div
        className="grid grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="rounded-row border-indigo/20 bg-indigo/10 border p-5 text-center">
          <Package className="text-indigo mx-auto mb-2 h-6 w-6" />
          <p className="text-large-title text-indigo tabular-nums">
            <NumberFlowDisplay value={importResult.cardsImported} />
          </p>
          <p className="text-label-secondary text-footnote font-semibold">Cards imported</p>
        </div>
        <div className="bg-tint-fill rounded-row p-5 text-center">
          <Coins className="text-yellow mx-auto mb-2 h-6 w-6" />
          <p className="text-large-title text-yellow tabular-nums">
            +<NumberFlowDisplay value={importResult.bonusCredits} />
          </p>
          <p className="text-label-secondary text-footnote font-semibold">Bonus IxCredits</p>
        </div>
      </motion.div>

      {/* Imported cards preview */}
      {importResult.cards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="space-y-2"
        >
          <p className="text-label-secondary text-footnote font-semibold">Your cards</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {importResult.cards.slice(0, 12).map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                className={cn(
                  "rounded-control relative overflow-hidden border p-2",
                  card.rarity === "LEGENDARY" && "border-yellow/40 bg-yellow/10",
                  card.rarity === "EPIC" && "border-purple/40 bg-purple/10",
                  card.rarity === "ULTRA_RARE" && "border-red/40 bg-red/10",
                  card.rarity === "RARE" && "border-blue/40 bg-blue/10",
                  card.rarity === "UNCOMMON" && "border-green/40 bg-green/10",
                  (!card.rarity || card.rarity === "COMMON") && "border-separator bg-fill-4"
                )}
              >
                <div className="relative mx-auto mb-1 h-10 w-10 overflow-hidden rounded">
                  <CardHolographicCover
                    cardType="NS_IMPORT"
                    rarity={card.rarity || "COMMON"}
                    title={card.title}
                  />
                  {card.artwork && card.artwork !== CARD_ARTWORK_PLACEHOLDER && (
                    <img
                      src={proxyCardArtwork(card.artwork)}
                      alt={card.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </div>
                <p className="text-footnote truncate text-center leading-tight font-semibold">
                  {card.title}
                </p>
                <p className="text-label-secondary text-footnote text-center">
                  S{card.season} ·{" "}
                  {card.marketValue > 0
                    ? `${card.marketValue.toFixed(2)} MV`
                    : (card.rarity?.toLowerCase() ?? "common")}
                </p>
              </motion.div>
            ))}
          </div>
          {importResult.cards.length > 12 && (
            <p className="text-label-secondary text-footnote text-center">
              +{importResult.cards.length - 12} more cards
            </p>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <Button onClick={onReset} variant="outline" className="w-full">
          <ArrowRight className="mr-2 h-4 w-4" /> Import Another Nation
        </Button>
      </motion.div>
    </div>
  );
}
