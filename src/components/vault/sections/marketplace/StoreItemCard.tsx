import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any; // Lucide icon component
  glowColor: string;
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

  const qualityColors: Record<string, { text: string; border: string; bg: string }> = {
    LEGENDARY: {
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
      bg: "from-amber-500/10 to-yellow-500/5",
    },
    EPIC: {
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-500/30",
      bg: "from-purple-500/10 to-pink-500/5",
    },
    RARE: {
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/30",
      bg: "from-blue-500/10 to-cyan-500/5",
    },
    COMMON: {
      text: "text-slate-500 dark:text-slate-400",
      border: "border-slate-500/30",
      bg: "from-slate-500/5 to-slate-500/2",
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
          "glass-surface relative flex h-auto min-h-[280px] w-44 flex-col justify-between rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-shadow hover:shadow-[0_15px_30px_var(--glow)]",
          colors.border,
          isPreviewing && "border-cyan-500/60 shadow-[0_0_15px_var(--glow)]"
        )}
        style={
          {
            transformStyle: "preserve-3d" as any,
            rotateX,
            rotateY,
            scale,
            y: translateY,
            perspective: "1000px",
            "--glow": item.glowColor,
          } as any
        }
      >
        {/* Quality indicator glow line */}
        <div
          className={cn(
            "absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b opacity-45",
            colors.bg
          )}
        />

        {/* Card Header */}
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={cn("px-1 py-0 text-[8px] font-bold uppercase", colors.text, colors.border)}
          >
            {item.badgeText}
          </Badge>
          {isOwned ? (
            <Badge
              variant="outline"
              className="border-emerald-500/35 bg-emerald-500/20 px-1 py-0 text-[8px] font-bold text-emerald-600 uppercase dark:text-emerald-400"
            >
              {maxPurchases > 1 ? "Maxed Out" : "Owned"}
            </Badge>
          ) : (
            purchaseCount > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/35 bg-amber-500/20 px-1 py-0 text-[8px] font-bold text-amber-600 uppercase dark:text-emerald-400"
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
              "mb-2 rounded-xl border bg-black/5 p-3.5 shadow-inner dark:bg-black/40",
              colors.border
            )}
          >
            <Icon className={cn("h-7 w-7", colors.text)} />
          </div>
          <h4 className="text-center text-xs font-black tracking-wide text-slate-900 dark:text-white/95">
            {item.name}
          </h4>
          <p className="text-muted-foreground mt-1 text-center text-[9px] leading-tight">
            {item.description}
          </p>
        </div>

        {/* Card Button / Footer */}
        <div className="border-border/50 flex w-full flex-col gap-1 border-t pt-1.5">
          {item.category === "cosmetics" && onPreview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPreview(item)}
              className={cn(
                "h-7 w-full border text-[10px] font-bold transition-all duration-200",
                isPreviewing
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.25)] dark:text-cyan-400"
                  : "border-border/40 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {isPreviewing ? "Previewing" : "Preview"}
            </Button>
          )}
          <Button
            onClick={() => onPurchase(item)}
            disabled={isPurchasing || isOwned}
            className={cn(
              "h-8 w-full border-none py-2 text-xs font-bold text-white transition-all duration-200",
              isOwned
                ? "bg-secondary text-muted-foreground border-border/50 cursor-not-allowed border"
                : isPurchasing
                  ? "bg-secondary/80 text-muted-foreground cursor-wait"
                  : cn(
                      "bg-gradient-to-r shadow-[0_0_12px_rgba(0,0,0,0.2)]",
                      item.quality === "LEGENDARY"
                        ? "from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500"
                        : item.quality === "EPIC"
                          ? "from-purple-650 hover:from-purple-550 to-pink-600 hover:to-pink-500"
                          : "from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                    )
            )}
            size="sm"
          >
            {isOwned ? (
              "Unlocked"
            ) : isPurchasing ? (
              "Acquiring..."
            ) : (
              <span className="flex items-center justify-center gap-1">
                <ShoppingCart className="h-3 w-3 text-white" />
                <span>Buy</span>
                <span className="ml-0.5 inline-flex items-center gap-0.5 align-middle font-mono text-[9px] opacity-90">
                  <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0 text-white" />
                  {item.price.toLocaleString()}
                </span>
              </span>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Grounding shadow overlay */}
      <div className="mt-2 h-1.5 w-32 rounded-full bg-black/20 blur-[4px] dark:bg-black/45" />
    </div>
  );
}
