"use client";

import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { InfoCircle as Info, Star, Sparks as Sparkles, Gift } from "iconoir-react";
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
      color: "text-purple",
      borderColor: "border-purple/30",
      glowColor: "rgba(168,85,247,0.3)",
      icon: Star,
      label: "Elite",
    };
  if (type.includes("PREMIUM") || type.includes("GOLD"))
    return {
      color: "text-yellow",
      borderColor: "border-yellow/30",
      glowColor: "rgba(245,158,11,0.3)",
      icon: Sparkles,
      label: "Premium",
    };
  if (type.includes("EVENT") || type.includes("LIMITED"))
    return {
      color: "text-red",
      borderColor: "border-red/30",
      glowColor: "rgba(239,68,68,0.3)",
      icon: Sparkles,
      label: "Event",
    };
  return {
    color: "text-teal",
    borderColor: "border-teal/30",
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
        className="border-separator bg-surface rounded-card shadow-card duration-fast hover:shadow-floating relative w-44 border p-2 transition-shadow"
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
            className="absolute top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-black/85"
            title="View pack details"
          >
            <Info className="h-3.5 w-3.5" />
          </DialogTrigger>
          <DialogContent className="max-w-sm p-5">
            <DialogHeader>
              <DialogTitle className="text-headline text-label">{pack.name}</DialogTitle>
              <DialogDescription className="text-label-secondary text-footnote mt-2 leading-relaxed">
                {pack.description || "No detailed description available for this card pack."}
              </DialogDescription>
            </DialogHeader>
            <div className="border-separator text-footnote mt-4 space-y-2 border-t pt-3">
              <div className="flex justify-between">
                <span className="text-label-secondary">Price</span>
                <span className="text-yellow font-semibold">{pack.priceCredits} Credits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-label-secondary">Cards included</span>
                <span className="font-semibold">{pack.cardCount} cards</span>
              </div>
              {pack.guaranteedRarity && (
                <div className="flex justify-between">
                  <span className="text-label-secondary">Guaranteed rarity</span>
                  <span className="text-purple font-semibold">
                    {pack.guaranteedRarity.replace("_", " ")}
                  </span>
                </div>
              )}
              {pack.season && (
                <div className="flex justify-between">
                  <span className="text-label-secondary">Season</span>
                  <span className="font-semibold">Season {pack.season}</span>
                </div>
              )}
              {pack.cardType && (
                <div className="flex justify-between">
                  <span className="text-label-secondary">Card type</span>
                  <span className="font-semibold">{pack.cardType}</span>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <div className="rounded-row bg-surface-secondary relative aspect-[3/4.2] w-full overflow-hidden">
          <PackHolographicCover
            packType={pack.packType}
            guaranteedRarity={pack.guaranteedRarity}
            packName={pack.name}
            packArtwork={pack.artwork || undefined}
            size="md"
            className="h-full w-full"
          />
        </div>

        <div className="mt-2 space-y-2 px-1">
          <div className="flex items-center justify-between">
            <span className="text-label text-footnote line-clamp-1 font-semibold">{pack.name}</span>
            <Badge variant="outline" className={cn("text-eyebrow px-1 py-0", config.color)}>
              {config.label}
            </Badge>
          </div>
          <p className="text-label-secondary text-footnote line-clamp-2 leading-tight">
            {pack.description || `${pack.cardCount} premium cards included`}
          </p>
          <div className="pt-1">{actionButton}</div>
        </div>
      </motion.div>
    </div>
  );
}
