import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag,
  Shield,
  Image as ImageIcon,
  ChevronDown,
  Palette,
  Sparkles,
  Upload,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  extractColorsFromImage,
  generateImageThemeCSS,
  type ExtractedColors,
} from "~/lib/image-color-extractor";
import { getFlagColors } from "~/lib/flag-color-extractor";
import { toast } from "sonner";
import { withBasePath } from "~/lib/base-path";

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
  const [isOpen, setIsOpen] = useState(false);
  const [extractedColors, setExtractedColors] = useState<ExtractedColors | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
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
      setShowColorPalette(true);

      // Auto-hide palette after 3 seconds
      setTimeout(() => setShowColorPalette(false), 3000);
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
        setShowColorPalette(true);
        setTimeout(() => setShowColorPalette(false), 3000);
      }
    } finally {
      setIsExtracting(false);
      lastProcessedRef.current = imageKey;
    }
  }, [flagUrl, coatOfArmsUrl, foundationCountry?.name]);

  useEffect(() => {
    extractColorsFromImages();
  }, [extractColorsFromImages]);

  // Auto-expand when foundation country has preview images
  useEffect(() => {
    if (foundationCountry && (foundationCountry.flagUrl || foundationCountry.coatOfArmsUrl)) {
      setIsOpen(true);
    }
  }, [foundationCountry?.flagUrl, foundationCountry?.coatOfArmsUrl]);

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
  }, [foundationCountry?.flagUrl, flagUrl, onFlagUrlChange]);

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
      toast.error("Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
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
        toast.success("Flag uploaded successfully!");
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload flag:", error);
      toast.error("Failed to upload image. Please try again.");
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
      toast.error("Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
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
        toast.success("Coat of arms uploaded successfully!");
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Failed to upload coat of arms:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingCoA(false);
    }
  };

  return (
    <div className="border-border relative z-10 border-t pt-4">
      {/* Foundation Country Info */}
      {foundationCountry && (
        <div className="bg-card/50 border-border mb-4 rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Flag className="h-4 w-4 text-blue-400" />
            <span className="text-foreground text-sm font-medium">
              Foundation: {foundationCountry.name}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Default symbols and colors will be based on this country
          </p>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card/50 hover:bg-card/70 text-muted-foreground hover:text-foreground flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          National Symbols
          {isExtracting && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
              <Sparkles className="h-4 w-4 text-yellow-400" />
            </motion.div>
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>

      {/* Color Palette Display */}
      <AnimatePresence>
        {showColorPalette && extractedColors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card/50 border-border mt-2 rounded-lg border p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Palette className="h-4 w-4 text-purple-400" />
              <span className="text-foreground text-sm font-medium">Extracted Colors</span>
            </div>
            <div className="flex gap-2">
              <div
                className="border-border h-8 w-8 rounded border"
                style={{ backgroundColor: extractedColors.primary }}
                title={`Primary: ${extractedColors.primary}`}
              />
              <div
                className="border-border h-8 w-8 rounded border"
                style={{ backgroundColor: extractedColors.secondary }}
                title={`Secondary: ${extractedColors.secondary}`}
              />
              <div
                className="border-border h-8 w-8 rounded border"
                style={{ backgroundColor: extractedColors.accent }}
                title={`Accent: ${extractedColors.accent}`}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Colors automatically applied to UI theme
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: "1rem" }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("rounded-lg bg-slate-800/50 p-4", isOpen ? "bg-card/50" : "")}>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Flag Section */}
                <div className="space-y-4">
                  <label className="form-label text-foreground flex items-center">
                    <Flag className="mr-2 h-4 w-4 text-blue-400" />
                    Country Flag
                  </label>
                  <div className="border-border flex h-40 w-full items-center justify-center overflow-hidden rounded-md border bg-black/20">
                    {flagUrl && flagUrl !== "" ? (
                      <img
                        src={flagUrl}
                        alt="Country Flag"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : foundationCountry?.flagUrl ? (
                      <div
                        className="relative h-full w-full cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() => {
                          // Use the foundation flag when clicked
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="text-foreground rounded bg-black/50 px-2 py-1 text-xs">
                            Foundation Default (Click to Use)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No Flag Selected</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={onSelectFlag}
                      className="w-full rounded-md bg-blue-600/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500/80"
                    >
                      <ImageIcon className="mr-2 inline-block h-4 w-4" /> Search Image Repository
                    </button>
                    <label
                      className={`block w-full ${isUploadingFlag ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFlagUpload}
                        className="hidden"
                        disabled={isUploadingFlag}
                      />
                      <div className="w-full cursor-pointer rounded-md bg-green-600/80 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-500/80">
                        <Upload className="mr-2 inline-block h-4 w-4" />
                        {isUploadingFlag ? "Uploading..." : "Upload Custom Flag"}
                      </div>
                    </label>
                  </div>
                </div>

                {/* Coat of Arms Section */}
                <div className="space-y-4">
                  <label className="form-label text-foreground flex items-center">
                    <Shield className="mr-2 h-4 w-4 text-purple-400" />
                    Coat of Arms
                  </label>
                  <div className="border-border flex h-40 w-full items-center justify-center overflow-hidden rounded-md border bg-black/20">
                    {coatOfArmsUrl ? (
                      <img
                        src={coatOfArmsUrl}
                        alt="Coat of Arms"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : foundationCountry?.coatOfArmsUrl ? (
                      <div
                        className="relative h-full w-full cursor-pointer transition-opacity hover:opacity-80"
                        onClick={() => {
                          // Use the foundation coat of arms when clicked
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="text-foreground rounded bg-black/50 px-2 py-1 text-xs">
                            Foundation Default (Click to Use)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        No Coat of Arms Selected
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={onSelectCoatOfArms}
                      className="w-full rounded-md bg-purple-600/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500/80"
                    >
                      <ImageIcon className="mr-2 inline-block h-4 w-4" /> Search Image Repository
                    </button>
                    <label
                      className={`block w-full ${isUploadingCoA ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoatOfArmsUpload}
                        className="hidden"
                        disabled={isUploadingCoA}
                      />
                      <div className="w-full cursor-pointer rounded-md bg-green-600/80 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-500/80">
                        <Upload className="mr-2 inline-block h-4 w-4" />
                        {isUploadingCoA ? "Uploading..." : "Upload Custom Coat of Arms"}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
