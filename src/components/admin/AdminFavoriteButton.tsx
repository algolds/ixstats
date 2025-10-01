"use client";

import React, { useState } from "react";
import { Star, StarOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface AdminFavoriteButtonProps {
  panelType: string;
  panelId: string;
  displayName: string;
  description?: string;
  iconName?: string;
  url: string;
  category?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "ghost" | "outline";
}

export function AdminFavoriteButton({
  panelType,
  panelId,
  displayName,
  description,
  iconName,
  url,
  category = "general",
  className,
  size = "sm",
  variant = "ghost"
}: AdminFavoriteButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get user's favorites
  const { data: favoritesData, error: favoritesError } = api.users.getAdminFavorites.useQuery(
    undefined,
    {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );
  const favorites = favoritesData?.favorites || [];

  // Handle favorites loading error silently
  if (favoritesError) {
    console.warn('Failed to load admin favorites for button:', favoritesError);
  }

  // Check if this panel is favorited
  const isFavorited = favorites.some(fav => fav.panelId === panelId);

  // Mutations
  const addFavoriteMutation = api.users.addAdminFavorite.useMutation();
  const removeFavoriteMutation = api.users.removeAdminFavorite.useMutation();

  // Utilities to refetch data
  const utils = api.useUtils();

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (isFavorited) {
        await removeFavoriteMutation.mutateAsync({ panelId });
      } else {
        await addFavoriteMutation.mutateAsync({
          panelType,
          panelId,
          displayName,
          description,
          iconName,
          url,
          category,
        });
      }

      // Refetch favorites
      await utils.users.getAdminFavorites.invalidate();
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  const isLoading = addFavoriteMutation.isPending || removeFavoriteMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      disabled={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "transition-all duration-200",
        isFavorited && "text-yellow-500 hover:text-yellow-600",
        !isFavorited && "text-muted-foreground hover:text-foreground",
        className
      )}
      title={isFavorited ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorited ? (
        <Star className={cn(
          "transition-all duration-200",
          size === "sm" && "h-4 w-4",
          size === "md" && "h-5 w-5",
          size === "lg" && "h-6 w-6",
          "fill-current"
        )} />
      ) : (
        <StarOff className={cn(
          "transition-all duration-200",
          size === "sm" && "h-4 w-4",
          size === "md" && "h-5 w-5",
          size === "lg" && "h-6 w-6",
          isHovered && "scale-110"
        )} />
      )}
    </Button>
  );
}