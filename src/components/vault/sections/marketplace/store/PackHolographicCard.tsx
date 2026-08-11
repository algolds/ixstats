"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Info, Star, Sparkles, Gift } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "~/components/ui/dialog";

export interface PackItem {
  id: string;
  name: string;
  description: string | null;
  artwork: string | null;
  packType: string;
  priceCredits: number;
  cardCount: number;
  guaranteedRarity: string | null;
  commonOdds: number;
  uncommonOdds: number;
  rareOdds: number;
  ultraRareOdds: number;
  epicOdds: number;
  legendaryOdds: number;
  season?: number | null;
  cardType?: string | null;
}

export const getPackConfig = (packType: string) => {
  const type = packType.toUpperCase();
  if (type.includes("LEGENDARY") || type.includes("MYTHIC"))
    return {
      color: "text-purple-600 dark:text-purple-400",
      borderColor: "border-purple-500/30",
      glowColor: "rgba(168,85,247,0.3)",
      icon: Star,
      label: "Elite",
    };
  if (type.includes("PREMIUM") || type.includes("GOLD"))
    return {
      color: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-500/30",
      glowColor: "rgba(245,158,11,0.3)",
      icon: Sparkles,
      label: "Premium",
    };
  if (type.includes("EVENT") || type.includes("LIMITED"))
    return {
      color: "text-red-600 dark:text-red-400",
      borderColor: "border-red-500/30",
      glowColor: "rgba(239,68,68,0.3)",
      icon: Sparkles,
      label: "Event",
    };
  return {
    color: "text-cyan-600 dark:text-cyan-400",
    borderColor: "border-cyan-500/30",
    glowColor: "rgba(6,182,212,0.3)",
    icon: Gift,
    label: "Special",
  };
};

export function PackHolographicCard({
  pack,
  actionButton,
}: {
  pack: PackItem;
  actionButton: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const config = getPackConfig(pack.packType);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-75, 75], [12, -12]), { stiffness: 120, damping: 15 });
  const rotateY = useSpring(useTransform(x, [-50, 50], [-12, 12]), { stiffness: 120, damping: 15 });
  const scale = useSpring(1, { stiffness: 120, damping: 15 });
  const translateY = useSpring(0, { stiffness: 120, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    scale.set(1.04);
    translateY.set(-12);
  };

  const handleMouseLeave = () => {
    scale.set(1);
    translateY.set(0);
    x.set(0);
    y.set(0);
  };

  return (
    <div className="group relative flex flex-col items-center select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="border-border/50 relative w-44 rounded-2xl border bg-black/5 p-2 shadow-2xl backdrop-blur-md transition-shadow hover:shadow-[0_15px_30px_var(--glow)] dark:border-white/10 dark:bg-black/40"
        style={{
          transformStyle: "preserve-3d",
          rotateX,
          rotateY,
          scale,
          y: translateY,
          perspective: "1000px",
          ["--glow" as string]: config.glowColor,
        }}
      >
        <Dialog>
          <DialogTrigger
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 transition-all hover:border-white/40 hover:bg-black/85 hover:text-white active:scale-95"
            title="View Pack Details"
          >
            <Info className="h-3.5 w-3.5" />
          </DialogTrigger>
          <DialogContent className="border-border/50 bg-popover/98 text-foreground max-w-sm p-5 backdrop-blur-md dark:bg-slate-900/98">
            <DialogHeader>
              <DialogTitle className="text-sm font-black tracking-wider text-cyan-600 uppercase dark:text-cyan-400">
                {pack.name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {pack.description || "No detailed description available for this card pack."}
              </DialogDescription>
            </DialogHeader>
            <div className="border-border/50 mt-4 space-y-2 border-t pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-bold text-amber-500">{pack.priceCredits} Credits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cards Included</span>
                <span className="font-bold">{pack.cardCount} cards</span>
              </div>
              {pack.guaranteedRarity && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guaranteed Rarity</span>
                  <span className="font-bold text-purple-400">
                    {pack.guaranteedRarity.replace("_", " ")}
                  </span>
                </div>
              )}
              {pack.season && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Season</span>
                  <span className="font-bold">Season {pack.season}</span>
                </div>
              )}
              {pack.cardType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Card Type</span>
                  <span className="font-bold text-cyan-400 uppercase">{pack.cardType}</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative aspect-[3/4.2] w-full overflow-hidden rounded-xl bg-slate-950">
          <PackHolographicCover
            packType={pack.packType}
            guaranteedRarity={pack.guaranteedRarity}
            packName={pack.name}
            packArtwork={pack.artwork || undefined}
            size="md"
            className="h-full w-full"
          />
        </div>

        <div className="mt-2.5 space-y-2 px-1">
          <div className="flex items-center justify-between">
            <span className="line-clamp-1 text-[11px] font-black text-foreground">
              {pack.name}
            </span>
            <Badge
              variant="outline"
              className={cn("px-1 py-0 text-[8px] font-bold uppercase", config.color)}
            >
              {config.label}
            </Badge>
          </div>
          <p className="text-muted-foreground line-clamp-2 text-[9px] leading-tight">
            {pack.description || `${pack.cardCount} premium cards included`}
          </p>
          <div className="pt-1">{actionButton}</div>
        </div>
      </motion.div>

      <div className="mt-2 h-1.5 w-32 rounded-full bg-black/20 blur-[4px] dark:bg-black/45" />
    </div>
  );
}
