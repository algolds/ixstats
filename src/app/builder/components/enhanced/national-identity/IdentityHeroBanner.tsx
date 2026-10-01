"use client";

import React, { useRef, useCallback } from "react";
import { motion } from "motion/react";
import {
  WhiteFlag as Flag,
  Shield,
  MediaImage as ImageIcon,
  Upload,
  MapPin,
  Crown,
  Quote,
  Group as Users,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FlagWatermark } from "~/components/ui/facet";
import { springSmooth } from "~/lib/design/motion";
import { getHighResFlagUrl } from "./identityUtils";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";

export interface IdentityHeroBannerProps {
  countryName: string;
  officialName?: string;
  motto?: string;
  demonym?: string;
  capitalCity?: string;
  governmentType?: string;
  flagUrl: string;
  coatOfArmsUrl: string;
  foundationCountry?: {
    name: string;
    flagUrl?: string;
    coatOfArmsUrl?: string;
  } | null;
  onSelectFlag: () => void;
  onSelectCoatOfArms: () => void;
  onFlagUrlChange: (url: string) => void;
  onCoatOfArmsUrlChange: (url: string) => void;
  className?: string;
}

export const IdentityHeroBanner = React.memo(function IdentityHeroBanner({
  countryName,
  officialName,
  motto,
  demonym,
  capitalCity,
  governmentType = "Republic",
  flagUrl,
  coatOfArmsUrl,
  foundationCountry,
  onSelectFlag,
  onSelectCoatOfArms,
  onFlagUrlChange,
  onCoatOfArmsUrlChange,
  className,
}: IdentityHeroBannerProps) {
  const notify = useNotify();
  const flagInputRef = useRef<HTMLInputElement>(null);
  const coaInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFlag, setIsUploadingFlag] = React.useState(false);
  const [isUploadingCoA, setIsUploadingCoA] = React.useState(false);

  const displayCountryName = countryName.trim() || "Untitled Nation";
  const displayOfficialName = officialName?.trim();
  const displayFlag = getHighResFlagUrl(flagUrl || foundationCountry?.flagUrl || "");
  const displayCoa = coatOfArmsUrl || foundationCountry?.coatOfArmsUrl || "";

  // Handle flag upload
  const handleFlagUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

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
      if (file.size > 5 * 1024 * 1024) {
        notify.error("File size must be less than 5MB");
        return;
      }

      setIsUploadingFlag(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(withBasePath("/api/upload/image"), {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Upload failed");
        const result = await response.json();
        if (result.success && result.url) {
          onFlagUrlChange(result.url);
          soundEffects.bloom();
          notify.success("National flag updated!");
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (err) {
        console.error("Failed to upload flag:", err);
        notify.error("Failed to upload image. Please try again.");
      } finally {
        setIsUploadingFlag(false);
        if (flagInputRef.current) flagInputRef.current.value = "";
      }
    },
    [notify, onFlagUrlChange]
  );

  // Handle coat of arms upload
  const handleCoatOfArmsUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

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
      if (file.size > 5 * 1024 * 1024) {
        notify.error("File size must be less than 5MB");
        return;
      }

      setIsUploadingCoA(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(withBasePath("/api/upload/image"), {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Upload failed");
        const result = await response.json();
        if (result.success && result.url) {
          onCoatOfArmsUrlChange(result.url);
          soundEffects.bloom();
          notify.success("National coat of arms updated!");
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (err) {
        console.error("Failed to upload coat of arms:", err);
        notify.error("Failed to upload image. Please try again.");
      } finally {
        setIsUploadingCoA(false);
        if (coaInputRef.current) coaInputRef.current.value = "";
      }
    },
    [notify, onCoatOfArmsUrlChange]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
      className={cn(
        "group border-separator bg-surface rounded-card shadow-card relative overflow-hidden border p-5",
        className
      )}
    >
      {/* Hidden file inputs */}
      <input
        ref={flagInputRef}
        type="file"
        accept="image/*"
        onChange={handleFlagUpload}
        className="hidden"
        disabled={isUploadingFlag}
      />
      <input
        ref={coaInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoatOfArmsUpload}
        className="hidden"
        disabled={isUploadingCoA}
      />

      {/* Corner flag watermark (Facet hero identity, reference §3) */}
      <FlagWatermark src={displayFlag} />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: National Symbols & Insignia */}
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* Flag Preview with Overlay Actions */}
          <div className="group/flag relative shrink-0">
            <div className="rounded-row border-separator bg-fill-3 shadow-card relative h-24 w-36 overflow-hidden border">
              {displayFlag ? (
                <img
                  src={displayFlag}
                  alt={`${displayCountryName} Flag`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover/flag:scale-105"
                />
              ) : (
                <div className="text-label-secondary flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                  <Flag className="text-label-tertiary h-6 w-6" />
                  <span className="text-caption">No Flag</span>
                </div>
              )}

              {/* Hover Quick Action Scrim */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover/flag:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.press();
                    onSelectFlag();
                  }}
                  className="rounded-control flex size-8 items-center justify-center bg-white/20 text-white transition-transform hover:scale-110 active:scale-95"
                  title="Search IxWiki Repository"
                  data-cuelume-press
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.press();
                    flagInputRef.current?.click();
                  }}
                  className="rounded-control flex size-8 items-center justify-center bg-white/20 text-white transition-transform hover:scale-110 active:scale-95"
                  title="Upload Custom Flag"
                  disabled={isUploadingFlag}
                  data-cuelume-press
                >
                  <Upload className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Coat of Arms Badge overlapping Flag corner */}
            <div className="group/coa absolute -right-2 -bottom-2">
              <div className="border-background bg-surface shadow-card relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2">
                {displayCoa ? (
                  <img
                    src={displayCoa}
                    alt="Coat of Arms"
                    className="h-full w-full object-contain p-0.5"
                  />
                ) : (
                  <Shield className="text-label-tertiary h-5 w-5" />
                )}

                {/* Coat of Arms Hover Action Scrim */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover/coa:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEffects.press();
                      onSelectCoatOfArms();
                    }}
                    className="text-white hover:scale-110 active:scale-95"
                    title="Change Coat of Arms"
                    data-cuelume-press
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Core Text Details */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Meta Pill Badges */}
            <div className="text-footnote flex flex-wrap items-center gap-1.5">
              <Badge variant="tinted">
                <Crown aria-hidden />
                <span>{governmentType || "Republic"}</span>
              </Badge>

              {demonym && (
                <Badge variant="neutral">
                  <Users aria-hidden />
                  <span>{demonym}</span>
                </Badge>
              )}

              {capitalCity && (
                <Badge variant="neutral">
                  <MapPin aria-hidden />
                  <span>{capitalCity}</span>
                </Badge>
              )}
            </div>

            {/* Display Nation Name */}
            <div>
              <h2 className="text-title-1 sm:text-large-title text-label truncate">
                {displayCountryName}
              </h2>
              {displayOfficialName && displayOfficialName !== displayCountryName && (
                <p className="text-label-secondary text-caption sm:text-body truncate italic">
                  {displayOfficialName}
                </p>
              )}
            </div>

            {/* National Motto Quote */}
            {motto && (
              <div className="text-footnote text-tint flex items-center gap-1.5 pt-0.5 italic">
                <Quote className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">“{motto}”</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Symbol Quick Action Buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:flex-nowrap lg:self-center">
          <Button
            type="button"
            variant="bordered"
            size="sm"
            onClick={() => {
              soundEffects.press();
              onSelectFlag();
            }}
          >
            <Flag aria-hidden className="text-tint" />
            <span>Select Flag</span>
          </Button>

          <Button
            type="button"
            variant="bordered"
            size="sm"
            onClick={() => {
              soundEffects.press();
              onSelectCoatOfArms();
            }}
          >
            <Shield aria-hidden className="text-teal" />
            <span>Select Emblem</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
