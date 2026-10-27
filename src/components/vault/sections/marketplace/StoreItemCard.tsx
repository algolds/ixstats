import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Cart as ShoppingCart } from "iconoir-react";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: React.ComponentType<{ className?: string }>;
  quality: string; // "LEGENDARY" | "EPIC" | "RARE" | "COMMON"
  badgeText: string;
  category?: string;
}

interface StoreItemCardProps {
  item: StoreItem;
  onPurchase: (item: StoreItem) => void;
  isPurchasing: boolean;
  isOwned: boolean;
  purchaseCount?: number;
  maxPurchases?: number;
  isPreviewing?: boolean;
  onPreview?: (item: StoreItem) => void;
}

export function StoreItemCard({
  item,
  onPurchase,
  isPurchasing,
  isOwned,
  purchaseCount = 0,
  maxPurchases = 1,
  isPreviewing = false,
  onPreview,
}: StoreItemCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const Icon = item.icon;

  // Rotation springs
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
    translateY.set(-8);
  };

  const handleMouseLeave = () => {
    scale.set(1);
    translateY.set(0);
    x.set(0);
    y.set(0);
  };

  const qualityColors: Record<string, { text: string; border: string }> = {
    LEGENDARY: {
      text: "text-yellow",
      border: "border-yellow/30",
    },
    EPIC: {
      text: "text-purple",
      border: "border-purple/30",
    },
    RARE: {
      text: "text-blue",
      border: "border-blue/30",
    },
    COMMON: {
      text: "text-label-secondary",
      border: "border-separator",
    },
  };

  const colors = qualityColors[item.quality] || qualityColors.COMMON;

  return (
    <div className="group relative flex flex-col items-center select-none">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "bg-surface rounded-card shadow-card duration-fast hover:shadow-floating relative flex h-auto min-h-[280px] w-44 flex-col justify-between border p-4 transition-shadow",
          colors.border,
          isPreviewing && "border-tint"
        )}
        style={{
          transformStyle: "preserve-3d",
          rotateX,
          rotateY,
          scale,
          y: translateY,
          perspective: "1000px",
        }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn("text-caption px-1 py-0", colors.text, colors.border)}
          >
            {item.badgeText}
          </Badge>
          {isOwned ? (
            <Badge
              variant="outline"
              className="border-green/35 bg-green/20 text-caption text-green px-1 py-0"
            >
              {maxPurchases > 1 ? "Maxed out" : "Owned"}
            </Badge>
          ) : (
            purchaseCount > 0 && (
              <Badge
                variant="outline"
                className="border-yellow/35 bg-yellow/20 text-caption text-yellow px-1 py-0"
              >
                Owned x{purchaseCount}
              </Badge>
            )
          )}
        </div>

        {/* Card Artwork / Icon block */}
        <div className="flex flex-1 flex-col items-center justify-center py-4">
          <div
            className={cn(
              "rounded-row bg-surface-secondary mb-2 border p-4 shadow-inner",
              colors.border
            )}
          >
            <Icon className={cn("h-7 w-7", colors.text)} />
          </div>
          <h4 className="text-footnote text-label text-center font-semibold">{item.name}</h4>
          <p className="text-label-secondary text-footnote mt-1 text-center leading-tight">
            {item.description}
          </p>
        </div>

        {/* Card Button / Footer */}
        <div className="border-separator flex w-full flex-col gap-1 border-t pt-2">
          {item.category === "cosmetics" && onPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPreview(item)}
              className={cn(
                "text-footnote h-7 w-full border font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
                isPreviewing
                  ? "border-tint/50 bg-tint-fill text-tint"
                  : "border-separator hover:bg-fill-3 text-label-secondary hover:text-label"
              )}
            >
              {isPreviewing ? "Previewing" : "Preview"}
            </Button>
          )}
          <Button
            onClick={() => onPurchase(item)}
            disabled={isPurchasing || isOwned}
            variant={isOwned || isPurchasing ? "secondary" : "default"}
            className={cn("w-full", isPurchasing && "cursor-wait")}
            size="sm"
          >
            {isOwned ? (
              "Unlocked"
            ) : isPurchasing ? (
              "Acquiring..."
            ) : (
              <span className="flex items-center justify-center gap-1">
                <ShoppingCart className="size-3.5" />
                <span>Buy</span>
                <span className="text-footnote ml-0.5 inline-flex items-center gap-0.5 align-middle tabular-nums opacity-90">
                  <IxCreditsSymbol className="size-3 shrink-0" />
                  {item.price.toLocaleString()}
                </span>
              </span>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
