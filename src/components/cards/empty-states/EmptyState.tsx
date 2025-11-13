// src/components/cards/empty-states/EmptyState.tsx
// Comprehensive empty state components for IxCards

"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Package,
  Inbox,
  ShoppingBag,
  MessageSquare,
  Hammer,
  TrendingUp,
  Search,
} from "lucide-react";
import { CometCard } from "~/components/ui/comet-card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Empty state variant
 */
export type EmptyStateVariant =
  | "inventory"
  | "packs"
  | "marketplace"
  | "trades"
  | "crafting"
  | "collections"
  | "search";

/**
 * Icon mapping for variants
 */
const VARIANT_ICONS = {
  inventory: Inbox,
  packs: Package,
  marketplace: ShoppingBag,
  trades: MessageSquare,
  crafting: Hammer,
  collections: TrendingUp,
  search: Search,
};

/**
 * Default messages for variants
 */
const VARIANT_MESSAGES = {
  inventory: {
    title: "No Cards Yet",
    description:
      "Your inventory is empty. Open card packs or trade with other players to build your collection.",
    actionLabel: "Open Packs",
    actionHref: "/vault/packs",
  },
  packs: {
    title: "No Packs Available",
    description:
      "You don't have any card packs to open. Earn packs through gameplay or purchase them from the store.",
    actionLabel: "Browse Store",
    actionHref: "/vault/store",
  },
  marketplace: {
    title: "No Listings Found",
    description:
      "There are no active auctions matching your filters. Try adjusting your search criteria or check back later.",
    actionLabel: "Clear Filters",
  },
  trades: {
    title: "No Trade Offers",
    description:
      "You don't have any pending trade offers. Start a new trade with another player to get started.",
    actionLabel: "Browse Players",
    actionHref: "/vault/players",
  },
  crafting: {
    title: "No Materials Available",
    description:
      "You don't have the required materials for crafting. Collect more cards to unlock crafting recipes.",
    actionLabel: "View Recipes",
    actionHref: "/vault/crafting/recipes",
  },
  collections: {
    title: "No Collections Yet",
    description:
      "Start organizing your cards into collections. Group cards by theme, rarity, or any way you like.",
    actionLabel: "Create Collection",
  },
  search: {
    title: "No Results Found",
    description:
      "We couldn't find any cards matching your search. Try different keywords or filters.",
    actionLabel: "Clear Search",
  },
};

/**
 * EmptyState props
 */
export interface EmptyStateProps {
  /** Variant type */
  variant: EmptyStateVariant;
  /** Custom title (overrides default) */
  title?: string;
  /** Custom description (overrides default) */
  description?: string;
  /** Custom action label (overrides default) */
  actionLabel?: string;
  /** Action handler */
  onAction?: () => void;
  /** Action href (for navigation) */
  actionHref?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show illustration */
  showIllustration?: boolean;
}

/**
 * EmptyState - Flexible empty state component
 *
 * Features:
 * - Multiple variants for different contexts
 * - Customizable messages and actions
 * - Animated illustrations
 * - Glass physics styling
 * - Optional CTA button
 *
 * @example
 * ```tsx
 * <EmptyState
 *   variant="inventory"
 *   onAction={() => router.push('/vault/packs')}
 * />
 * ```
 */
export const EmptyState = React.memo<EmptyStateProps>(
  ({
    variant,
    title,
    description,
    actionLabel,
    onAction,
    actionHref,
    className,
    showIllustration = true,
  }) => {
    const defaults = VARIANT_MESSAGES[variant];
    const Icon = VARIANT_ICONS[variant];

    const finalTitle = title || defaults.title;
    const finalDescription = description || defaults.description;
    const finalActionLabel = actionLabel || defaults.actionLabel;
    const finalActionHref = actionHref || (defaults as any).actionHref || "/vault/packs";

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn("flex items-center justify-center p-8", className)}
      >
        <CometCard
          /* depth="child" */
          className="max-w-md p-8 text-center"
        >
          {/* Icon illustration */}
          {showIllustration && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.1,
              }}
              className="mb-6 inline-flex items-center justify-center rounded-full bg-white/5 p-6"
            >
              <Icon className="h-16 w-16 text-white/40" />
            </motion.div>
          )}

          {/* Title */}
          <h3 className="mb-3 text-2xl font-bold text-white">{finalTitle}</h3>

          {/* Description */}
          <p className="mb-6 text-sm leading-relaxed text-white/60">
            {finalDescription}
          </p>

          {/* Action button */}
          {(onAction || finalActionHref) && (
            <Button
              onClick={onAction}
              variant="default"
              size="lg"
              className="gap-2"
              asChild={!!finalActionHref && !onAction}
            >
              {finalActionHref && !onAction ? (
                <a href={finalActionHref}>{finalActionLabel}</a>
              ) : (
                <span>{finalActionLabel}</span>
              )}
            </Button>
          )}
        </CometCard>
      </motion.div>
    );
  }
);

EmptyState.displayName = "EmptyState";

/**
 * EmptyInventory - Shorthand for inventory empty state
 */
export const EmptyInventory: React.FC<
  Omit<EmptyStateProps, "variant">
> = (props) => <EmptyState variant="inventory" {...props} />;

/**
 * EmptyPacks - Shorthand for packs empty state
 */
export const EmptyPacks: React.FC<Omit<EmptyStateProps, "variant">> = (
  props
) => <EmptyState variant="packs" {...props} />;

/**
 * EmptyMarketplace - Shorthand for marketplace empty state
 */
export const EmptyMarketplace: React.FC<
  Omit<EmptyStateProps, "variant">
> = (props) => <EmptyState variant="marketplace" {...props} />;

/**
 * EmptyTrades - Shorthand for trades empty state
 */
export const EmptyTrades: React.FC<Omit<EmptyStateProps, "variant">> = (
  props
) => <EmptyState variant="trades" {...props} />;

/**
 * EmptyCrafting - Shorthand for crafting empty state
 */
export const EmptyCrafting: React.FC<Omit<EmptyStateProps, "variant">> = (
  props
) => <EmptyState variant="crafting" {...props} />;

/**
 * EmptyCollections - Shorthand for collections empty state
 */
export const EmptyCollections: React.FC<
  Omit<EmptyStateProps, "variant">
> = (props) => <EmptyState variant="collections" {...props} />;

/**
 * EmptySearch - Shorthand for search empty state
 */
export const EmptySearch: React.FC<Omit<EmptyStateProps, "variant">> = (
  props
) => <EmptyState variant="search" {...props} />;
