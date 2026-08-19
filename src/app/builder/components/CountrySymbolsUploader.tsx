import React, { useState, useEffect, useCallback, useRef } from "react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { motion, AnimatePresence } from "motion/react";
import {
  Flag,
  Shield,
  Image as ImageIcon,
  // eslint-disable-next-line unused-imports/no-unused-imports
  ChevronDown,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Sparkles,
  Upload,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Loader2,
} from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { cn } from "~/lib/utils";
import { extractColorsFromImage, type ExtractedColors } from "~/lib/media";
import { getFlagColors } from "~/lib/flags/flag-color-extractor";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { GlassCard, GlassCardContent } from "./glass/GlassCard";

interface CountrySymbolsUploaderProps {
  flagUrl: string;
  coatOfArmsUrl: string;
  foundationCountry?: {
    name: string;
    flagUrl?: string;
    coatOfArmsUrl?: string;
  } | null;
  onSelectFlag: () => void;
  onSelectCoatOfArms: () => void;
  onColorsExtracted?: (colors: ExtractedColors) => void;
  onFlagUrlChange?: (url: string) => void;
  onCoatOfArmsUrlChange?: (url: string) => void;
}

export function CountrySymbolsUploader({
  flagUrl,
  coatOfArmsUrl,
  foundationCountry,
  onSelectFlag,
  onSelectCoatOfArms,
  onColorsExtracted,
  onFlagUrlChange,
  onCoatOfArmsUrlChange,
}: CountrySymbolsUploaderProps) {
  const notify = useNotify();
  const [_extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploadingFlag, setIsUploadingFlag] = useState(false);
  const [isUploadingCoA, setIsUploadingCoA] = useState(false);

  // Use ref to store the latest callback to avoid dependency issues
  const onColorsExtractedRef = useRef(onColorsExtracted);
  onColorsExtractedRef.current = onColorsExtracted;

  // Track the last processed images to prevent unnecessary re-extractions
  const lastProcessedRef = useRef<string>("");

  // Extract colors when images change
  const extractColorsFromImages = useCallback(async () => {
    const imageToAnalyze =
      flagUrl || foundationCountry?.flagUrl || coatOfArmsUrl || foundationCountry?.coatOfArmsUrl;
    const imageKey = `${flagUrl || ""}|${coatOfArmsUrl || ""}|${foundationCountry?.name || ""}|${foundationCountry?.flagUrl || ""}`;

    // Skip if no image, already extracting, or already processed this combination
    if (!imageToAnalyze || isExtracting || lastProcessedRef.current === imageKey) return;

    setIsExtracting(true);
    try {
      console.log(`[CountrySymbolsUploader] Attempting to extract colors from: ${imageToAnalyze}`);
      const colors = await extractColorsFromImage(imageToAnalyze);
      console.log(`[CountrySymbolsUploader] Successfully extracted colors:`, colors);
      setExtractedColors(colors);
      onColorsExtractedRef.current?.(colors);
    } catch (error) {
      console.error("[CountrySymbolsUploader] Failed to extract colors from image:", error);
      console.log(`[CountrySymbolsUploader] Image URL that failed: ${imageToAnalyze}`);

      // Fallback to flag colors if extraction fails
      if (foundationCountry?.name) {
        console.log(
          `[CountrySymbolsUploader] Using fallback colors for: ${foundationCountry.name}`
        );
        const fallbackColors = getFlagColors(foundationCountry.name);
        setExtractedColors(fallbackColors);
        onColorsExtractedRef.current?.(fallbackColors);
      }
    } finally {
      setIsExtracting(false);
      lastProcessedRef.current = imageKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagUrl, coatOfArmsUrl, foundationCountry?.name]);

  useEffect(() => {
    extractColorsFromImages();
  }, [extractColorsFromImages]);

  // Set default images from foundation country
  useEffect(() => {
    if (foundationCountry && foundationCountry.flagUrl && onFlagUrlChange) {
      // Always use foundation flag if available and user hasn't set a custom one
      if (!flagUrl || flagUrl === "") {
        console.log(
          "[CountrySymbolsUploader] Auto-filling with foundation flag:",
          foundationCountry.flagUrl
        );
        onFlagUrlChange(foundationCountry.flagUrl);
      }
    }
    if (foundationCountry && foundationCountry.coatOfArmsUrl && onCoatOfArmsUrlChange) {
      // Always use foundation coat of arms if available and user hasn't set a custom one
      if (!coatOfArmsUrl || coatOfArmsUrl === "") {
        console.log(
          "[CountrySymbolsUploader] Auto-filling with foundation coat of arms:",
          foundationCountry.coatOfArmsUrl
        );
        onCoatOfArmsUrlChange(foundationCountry.coatOfArmsUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    foundationCountry?.flagUrl,
    foundationCountry?.coatOfArmsUrl,
    flagUrl,
    coatOfArmsUrl,
    onFlagUrlChange,
    onCoatOfArmsUrlChange,
  ]);

  // Handle file upload for flag
  const handleFlagUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      notify.error("Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      notify.error("File size must be less than 5MB");
      return;
    }

    setIsUploadingFlag(true);

    try {
      // Upload to server
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.success && result.url) {
        onFlagUrlChange?.(result.url);
        notify.success("Flag uploaded successfully!");
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload flag:", error);
      notify.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingFlag(false);
    }
  };

  // Handle file upload for coat of arms
  const handleCoatOfArmsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validTypes.includes(file.type)) {
      notify.error("Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      notify.error("File size must be less than 5MB");
      return;
    }

    setIsUploadingCoA(true);

    try {
      // Upload to server
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(withBasePath("/api/upload/image"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (result.success && result.url) {
        onCoatOfArmsUrlChange?.(result.url);
        notify.success("Coat of arms uploaded successfully!");
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload coat of arms:", error);
      notify.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingCoA(false);
    }
  };

  return (
    <div className="relative z-10 space-y-4 pt-4">
      {/* Flag and Coat of Arms Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Flag Section */}
        <GlassCard
          depth="base"
          theme="blue"
          className="border-blue-500/20"
          texture="chevron"
          textureOpacity={0.06}
          motionPreset="none"
        >
          <GlassCardContent className="space-y-4 p-5">
            <label className="text-foreground flex items-center text-sm font-bold">
              <Flag className="mr-2 h-4 w-4 text-blue-400" />
              Country Flag
            </label>
            <div className="dark:border-border/30 relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-500/10 bg-zinc-500/5 dark:bg-black/25">
              <div className="relative z-10 flex h-full w-full items-center justify-center p-3">
                {flagUrl && flagUrl !== "" ? (
                  <img
                    src={flagUrl}
                    alt="Country Flag"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : foundationCountry?.flagUrl ? (
                  <div
                    className="relative flex h-full w-full cursor-pointer items-center justify-center transition-opacity hover:opacity-85"
                    onClick={() => {
                      if (foundationCountry?.flagUrl && onFlagUrlChange) {
                        onFlagUrlChange(foundationCountry.flagUrl);
                      } else {
                        onSelectFlag();
                      }
                    }}
                  >
                    <img
                      src={foundationCountry.flagUrl}
                      alt={`${foundationCountry.name} Flag`}
                      className="max-h-full max-w-full object-contain opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/25">
                      <span className="border-border/20 rounded border bg-black/70 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                        Foundation Default (Click to Use)
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs font-semibold">
                    No Flag Selected
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onSelectFlag}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-blue-600/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-blue-500/80"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Search Repository
              </button>
              <label
                className={`block cursor-pointer ${isUploadingFlag ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFlagUpload}
                  className="hidden"
                  disabled={isUploadingFlag}
                />
                <div className="flex items-center justify-center gap-1.5 rounded-md bg-green-600/80 px-3 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-green-500/80">
                  <Upload className="h-3.5 w-3.5" />
                  {isUploadingFlag ? "Uploading..." : "Upload Custom"}
                </div>
              </label>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Coat of Arms Section */}
        <GlassCard
          depth="base"
          theme="indigo"
          className="border-indigo-500/20"
          texture="chevron"
          textureOpacity={0.06}
          motionPreset="none"
        >
          <GlassCardContent className="space-y-4 p-5">
            <label className="text-foreground flex items-center text-sm font-bold">
              <Shield className="mr-2 h-4 w-4 text-purple-400" />
              Coat of Arms
            </label>
            <div className="dark:border-border/30 relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-500/10 bg-zinc-500/5 dark:bg-black/25">
              <div className="relative z-10 flex h-full w-full items-center justify-center p-3">
                {coatOfArmsUrl ? (
                  <img
                    src={coatOfArmsUrl}
                    alt="Coat of Arms"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : foundationCountry?.coatOfArmsUrl ? (
                  <div
                    className="relative flex h-full w-full cursor-pointer items-center justify-center transition-opacity hover:opacity-85"
                    onClick={() => {
                      if (foundationCountry?.coatOfArmsUrl && onCoatOfArmsUrlChange) {
                        onCoatOfArmsUrlChange(foundationCountry.coatOfArmsUrl);
                      } else {
                        onSelectCoatOfArms();
                      }
                    }}
                  >
                    <img
                      src={foundationCountry.coatOfArmsUrl}
                      alt={`${foundationCountry.name} Coat of Arms`}
                      className="max-h-full max-w-full object-contain opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/25">
                      <span className="border-border/20 rounded border bg-black/70 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                        Foundation Default (Click to Use)
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs font-semibold">
                    No Coat of Arms Selected
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onSelectCoatOfArms}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md bg-purple-600/80 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-purple-500/80"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Search Repository
              </button>
              <label
                className={`block cursor-pointer ${isUploadingCoA ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoatOfArmsUpload}
                  className="hidden"
                  disabled={isUploadingCoA}
                />
                <div className="flex items-center justify-center gap-1.5 rounded-md bg-green-600/80 px-3 py-2 text-center text-xs font-semibold text-white transition-all hover:bg-green-500/80">
                  <Upload className="h-3.5 w-3.5" />
                  {isUploadingCoA ? "Uploading..." : "Upload Custom"}
                </div>
              </label>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
