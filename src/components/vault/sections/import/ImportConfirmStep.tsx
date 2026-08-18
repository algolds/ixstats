"use client";

import React from "react";
import { motion } from "motion/react";
import { CheckCircle, Info, ArrowLeft, Download, Package, Coins, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { FacetCard } from "~/components/ui/facet-container";
import NumberFlow from "~/components/ui/number-flow";
import { CardHolographicCover } from "~/components/cards/display/CardHolographicCover";
import { proxyCardArtwork } from "~/lib/cards";

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
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-400/30"
        >
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </motion.div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">Nation Verified</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="font-semibold text-green-600 dark:text-green-400">{nationName}</span> is
          confirmed as yours
        </p>
      </div>

      <FacetCard depth={2} className="rounded-xl border-green-500/30 bg-green-500/10 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="text-muted-foreground text-sm">
            <p className="text-foreground mb-1 font-semibold">Ready to import</p>
            <p>
              This will fetch your NationStates trading card deck and create IxCards versions. The
              process takes a few seconds depending on deck size.
            </p>
          </div>
        </div>
      </FacetCard>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="border-border/60">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onConfirmImport}
          className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600 active:scale-[0.98]"
          size="lg"
        >
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
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 blur-3xl"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 2, 1.5], opacity: [0, 0.8, 0.4] }}
            transition={{ duration: 0.8 }}
          />
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-400"
              initial={{ x: 0, y: 0, opacity: 0 }}
              animate={{
                x: Math.cos((i / 6) * Math.PI * 2) * 50,
                y: Math.sin((i / 6) * Math.PI * 2) * 50,
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
              }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
              style={{ left: "50%", top: "50%" }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
            className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-400/30"
          >
            <CheckCircle className="h-10 w-10 text-green-400" />
          </motion.div>
        </div>

        <motion.h2
          className="text-foreground text-3xl font-bold tracking-tight"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Import Complete!
        </motion.h2>
        <motion.p
          className="text-muted-foreground mt-1 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Your deck from <span className="font-semibold text-green-400">{importResult.nation}</span>{" "}
          has been imported
        </motion.p>
      </div>

      {/* Result stat cards */}
      <motion.div
        className="grid grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-purple-600/5 p-5 text-center">
          <Package className="mx-auto mb-2 h-6 w-6 text-purple-400" />
          <p className="text-3xl font-bold tracking-tight text-purple-400 tabular-nums">
            <NumberFlow value={importResult.cardsImported} />
          </p>
          <p className="text-muted-foreground text-xs font-semibold">Cards Imported</p>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-5 text-center">
          <Coins className="mx-auto mb-2 h-6 w-6 text-amber-400" />
          <p className="text-3xl font-bold tracking-tight text-amber-400 tabular-nums">
            +<NumberFlow value={importResult.bonusCredits} />
          </p>
          <p className="text-muted-foreground text-xs font-semibold">Bonus IxCredits</p>
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
          <p className="text-muted-foreground text-xs font-semibold">Your Cards</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {importResult.cards.slice(0, 12).map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                className={cn(
                  "relative overflow-hidden rounded-lg border bg-gradient-to-b p-1.5",
                  card.rarity === "LEGENDARY" &&
                    "border-amber-400/40 from-amber-500/10 to-amber-600/5",
                  card.rarity === "EPIC" &&
                    "border-purple-400/40 from-purple-500/10 to-purple-600/5",
                  card.rarity === "ULTRA_RARE" && "border-red-400/40 from-red-500/10 to-red-600/5",
                  card.rarity === "RARE" && "border-blue-400/40 from-blue-500/10 to-blue-600/5",
                  card.rarity === "UNCOMMON" &&
                    "border-green-400/40 from-green-500/10 to-green-600/5",
                  (!card.rarity || card.rarity === "COMMON") &&
                    "border-white/10 from-white/5 to-white/[0.02]"
                )}
              >
                <div className="relative mx-auto mb-1 h-10 w-10 overflow-hidden rounded">
                  <CardHolographicCover
                    cardType="NS_IMPORT"
                    rarity={card.rarity || "COMMON"}
                    title={card.title}
                  />
                  {card.artwork && card.artwork !== "/images/cards/placeholder-nation.png" && (
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
                <p className="truncate text-center text-[9px] leading-tight font-bold">
                  {card.title}
                </p>
                <p className="text-muted-foreground text-center text-[8px]">
                  S{card.season} ·{" "}
                  {card.marketValue > 0
                    ? `${card.marketValue.toFixed(2)} MV`
                    : (card.rarity?.toLowerCase() ?? "common")}
                </p>
              </motion.div>
            ))}
          </div>
          {importResult.cards.length > 12 && (
            <p className="text-muted-foreground text-center text-[10px]">
              +{importResult.cards.length - 12} more cards
            </p>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <Button onClick={onReset} variant="outline" className="w-full border-white/10">
          <ArrowRight className="mr-2 h-4 w-4" /> Import Another Nation
        </Button>
      </motion.div>
    </div>
  );
}
