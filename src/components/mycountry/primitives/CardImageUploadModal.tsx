"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { Loader2, Check, Image as ImageIcon, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { getCardImagePreset, type CardImageType } from "~/lib/card-image-presets";
import { cn } from "~/lib/utils";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface CardImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  cardType: CardImageType;
  currentImageUrl?: string | null;
  onSuccess?: () => void;
}

// Default preset images by card type - curated high-quality images
const defaultPresetImages: Record<CardImageType, string[]> = {
  national_identity: [
    "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80", // Capitol building
    "https://images.unsplash.com/photo-1529180979161-06b8b6d6f2be?w=800&q=80", // Parliament
    "https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&q=80", // Government building
    "https://images.unsplash.com/photo-1551776235-dde6d482980c?w=800&q=80", // Historic architecture
    "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80", // Grand building
    "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&q=80", // State building
  ],
  head_of_state: [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80", // Professional portrait setting
    "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=800&q=80", // Executive office
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80", // Professional setting
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=800&q=80", // Business portrait
  ],
  head_of_government: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", // Cabinet room
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80", // Meeting room
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80", // Office setting
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80", // Government office
  ],
  economic_indicators: [
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80", // Financial district
    "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=800&q=80", // Stock exchange
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&q=80", // Modern city skyline
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80", // Business analytics
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80", // Trading floor
  ],
  demographics: [
    "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80", // City crowd
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80", // Diverse people
    "https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=800&q=80", // Urban population
    "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=800&q=80", // Community
  ],
  labor: [
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80", // Modern workplace
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80", // Team working
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80", // Industry workers
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80", // Office workers
  ],
  government: [
    "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=800&q=80", // Government building
    "https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=800&q=80", // Legislative hall
    "https://images.unsplash.com/photo-1564939558297-fc396f18e5c7?w=800&q=80", // Courthouse
    "https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80", // Civic building
  ],
  fiscal: [
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80", // Financial documents
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", // Analytics
    "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80", // Money/finance
    "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80", // Treasury
  ],
  trade: [
    "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=800&q=80", // Shipping port
    "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80", // Cargo containers
    "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80", // International trade
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80", // Business meeting
  ],
  productivity: [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80", // Modern factory
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80", // Technology
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80", // Research lab
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80", // Innovation
  ],
  analytics: [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", // Data dashboard
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80", // Analytics screen
    "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80", // Statistics
    "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=800&q=80", // Charts
  ],
  defense: [
    "https://images.unsplash.com/photo-1579912437766-7896df6d3cd3?w=800&q=80", // Military
    "https://images.unsplash.com/photo-1580752300992-559f8e4f8b93?w=800&q=80", // Defense
    "https://images.unsplash.com/photo-1569074187119-c87815b476da?w=800&q=80", // Security
  ],
  diplomacy: [
    "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&q=80", // Diplomatic meeting
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80", // International conference
    "https://images.unsplash.com/photo-1560523159-4a9692d222f9?w=800&q=80", // Embassy
    "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&q=80", // Meeting
  ],
};

/**
 * CardImageUploadModal - Modal for uploading or selecting card background images
 *
 * Features:
 * - Preset default images for quick selection
 * - Full MediaSearchModal integration for repository/wiki/upload
 * - Reset to default option
 */
export function CardImageUploadModal({
  isOpen,
  onClose,
  countryId,
  cardType,
  currentImageUrl,
  onSuccess,
}: CardImageUploadModalProps) {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<"presets" | "search">("presets");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const preset = getCardImagePreset(cardType);
  const presetImages = defaultPresetImages[cardType] || defaultPresetImages.national_identity;
  const utils = api.useUtils();

  // Mutation to save the image
  const upsertMutation = api.cardImages.upsert.useMutation({
    onSuccess: () => {
      notify.success("Image saved successfully");
      utils.cardImages.getByCountryAndType.invalidate({ countryId, cardType });
      utils.cardImages.getAllByCountry.invalidate({ countryId });
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      notify.error(`Failed to save image: ${error.message}`);
      setIsSaving(false);
    },
  });

  // Mutation to delete the image
  const deleteMutation = api.cardImages.delete.useMutation({
    onSuccess: () => {
      notify.success("Image reset to default");
      utils.cardImages.getByCountryAndType.invalidate({ countryId, cardType });
      utils.cardImages.getAllByCountry.invalidate({ countryId });
      onSuccess?.();
      handleClose();
    },
    onError: (error) => {
      notify.error(`Failed to reset image: ${error.message}`);
    },
  });

  // Handle image selection from MediaSearchModal
  const handleMediaImageSelect = async (imageUrl: string) => {
    setIsMediaModalOpen(false);
    setSelectedImage(imageUrl);
  };

  // Save the selected image
  const handleSave = async () => {
    if (!selectedImage) {
      notify.error("Please select an image");
      return;
    }

    setIsSaving(true);

    try {
      // Download external images to local storage
      let finalUrl = selectedImage;

      if (selectedImage.startsWith("https://images.unsplash.com")) {
        const response = await fetch("/api/download/external-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: selectedImage,
            filename: `card-${cardType}-${Date.now()}.jpg`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          finalUrl = data.localUrl;
        }
      }

      await upsertMutation.mutateAsync({
        countryId,
        cardType,
        imageUrl: finalUrl,
        isCustom: true,
        presetKey: selectedImage.includes("unsplash") ? "unsplash-preset" : undefined,
      });
    } catch (error) {
      console.error("Error saving image:", error);
      notify.error("Failed to save image");
      setIsSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!currentImageUrl) return;

    try {
      await deleteMutation.mutateAsync({ countryId, cardType });
    } catch (_error) {
      // Error already handled by mutation
    }
  };

  // Close and reset state
  const handleClose = () => {
    setSelectedImage(null);
    setActiveTab("presets");
    setIsSaving(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              {preset.label} Background
            </DialogTitle>
            <DialogDescription>{preset.description}</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "presets" | "search")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="presets" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                Preset Images
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2">
                <ImageIcon className="h-4 w-4" />
                Image Repository
              </TabsTrigger>
            </TabsList>

            {/* Preset Images Tab */}
            <TabsContent value="presets" className="mt-4 space-y-4">
              <p className="text-muted-foreground text-sm">
                Select a curated image for your {preset.label.toLowerCase()} card
              </p>

              {/* Preset Images Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {presetImages.map((imageUrl, idx) => (
                  <motion.div
                    key={idx}
                    className={cn(
                      "relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                      selectedImage === imageUrl
                        ? "border-primary ring-primary/50 ring-2"
                        : "hover:border-primary/50 border-transparent"
                    )}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedImage(imageUrl)}
                  >
                    <img
                      src={imageUrl}
                      alt={`${preset.label} preset ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {selectedImage === imageUrl && (
                      <div className="bg-primary/20 absolute inset-0 flex items-center justify-center">
                        <Check className="text-primary h-8 w-8 drop-shadow-lg" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Image Repository Tab */}
            <TabsContent value="search" className="mt-4 space-y-4">
              <p className="text-muted-foreground text-sm">
                Search from Unsplash, Wiki Commons, IxWiki, or upload your own
              </p>

              {/* Selected Image Preview */}
              {selectedImage && !presetImages.includes(selectedImage) && (
                <div className="border-primary relative aspect-video overflow-hidden rounded-lg border-2">
                  <img
                    src={selectedImage}
                    alt="Selected image"
                    className="h-full w-full object-cover"
                  />
                  <div className="bg-primary/20 absolute inset-0 flex items-center justify-center">
                    <Check className="text-primary h-8 w-8 drop-shadow-lg" />
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="h-24 w-full border-dashed"
                onClick={() => setIsMediaModalOpen(true)}
              >
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="text-muted-foreground h-8 w-8" />
                  <span>Open Image Repository</span>
                  <span className="text-muted-foreground text-xs">
                    Unsplash, Wiki Commons, IxWiki, or Upload
                  </span>
                </div>
              </Button>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 flex items-center justify-between gap-2">
            <div>
              {currentImageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Reset to Default
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedImage || isSaving || upsertMutation.isPending}
              >
                {isSaving || upsertMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Image
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Search Modal */}
      <MediaSearchModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onImageSelect={handleMediaImageSelect}
      />
    </>
  );
}

export default CardImageUploadModal;
