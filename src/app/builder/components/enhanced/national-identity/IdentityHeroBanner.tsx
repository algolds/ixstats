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
import { springSmooth } from "~/lib/design/motion";
import { getHighResFlagUrl } from "./identityUtils";
import { useNotify } from "~/hooks/useNotify";
import { withBasePath } from "~/lib/base-path";
import { focusRing } from "~/components/ui/button";
import {
  IMAGE_SCRIM,
  IMAGE_SCRIM_ACTION,
  IMAGE_SCRIM_TOUCH_ACTION,
  IMAGE_SCRIM_TOUCH_BAND,
  IMAGE_SCRIM_TOUCH_CLUSTER,
} from "~/app/builder/lib/image-scrim";

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

  const displayCountryName = countryName.trim() || "Untitled nation";
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
        "group relative isolate overflow-hidden p-5",
        "bg-surface text-label border-separator rounded-card shadow-card border",
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

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: National Symbols & Insignia */}
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* Flag Preview with Overlay Actions */}
          <div className="group/flag relative shrink-0">
            <div className="rounded-row border-separator bg-fill-3 shadow-card relative h-24 w-36 overflow-hidden border">
              {displayFlag ? (
                <img
                  src={displayFlag}
                  alt={`${displayCountryName} flag`}
                  className="h-full w-full object-cover transition-[scale] duration-300 motion-safe:group-focus-within/flag:scale-105 motion-safe:group-hover/flag:scale-105"
                />
              ) : (
                <div className="text-label-secondary flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
                  <Flag aria-hidden="true" className="text-label-tertiary h-6 w-6" />
                  <span className="text-caption">No flag</span>
                </div>
              )}

              {/* Quick actions: a scrim revealed on hover / keyboard focus; on touch (no hover) they
                  stay visible as a corner cluster over the flag. */}
              <div
                role="group"
                aria-label="Flag image"
                className={cn(
                  "absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-200 group-focus-within/flag:opacity-100 group-hover/flag:opacity-100",
                  IMAGE_SCRIM,
                  IMAGE_SCRIM_TOUCH_CLUSTER
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    soundEffects.press();
                    onSelectFlag();
                  }}
                  className={cn(IMAGE_SCRIM_ACTION, IMAGE_SCRIM_TOUCH_ACTION)}
                  title="Search the IxWiki repository"
                  aria-label="Search the IxWiki repository"
                >
                  <ImageIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    soundEffects.press();
                    flagInputRef.current?.click();
                  }}
                  className={cn(IMAGE_SCRIM_ACTION, IMAGE_SCRIM_TOUCH_ACTION)}
                  title="Upload a custom flag"
                  aria-label="Upload a custom flag"
                  disabled={isUploadingFlag}
                >
                  <Upload aria-hidden />
                </Button>
              </div>
            </div>

            {/* Coat of Arms badge overlapping the flag corner. The whole 44pt emblem is the button;
                its scrim shows on hover / keyboard focus, and on touch an always-visible edit band
                along the bottom edge. */}
            <div className="absolute -right-2 -bottom-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundEffects.press();
                  onSelectCoatOfArms();
                }}
                className={cn(
                  "group/coa border-background bg-surface shadow-card facet-press facet-press-sm relative flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2",
                  focusRing
                )}
                title="Change coat of arms"
                aria-label="Change coat of arms"
              >
                {displayCoa ? (
                  <img src={displayCoa} alt="" className="h-full w-full object-contain p-0.5" />
                ) : (
                  <Shield aria-hidden="true" className="text-label-tertiary h-5 w-5" />
                )}

                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover/coa:opacity-100 group-focus-visible/coa:opacity-100",
                    IMAGE_SCRIM,
                    IMAGE_SCRIM_TOUCH_BAND
                  )}
                >
                  <ImageIcon className="size-3.5 pointer-coarse:size-3" />
                </span>
              </button>
            </div>
          </div>

          {/* Core Text Details */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Meta Pill Badges */}
            <div className="text-footnote flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Crown aria-hidden />
                <span>{governmentType || "Republic"}</span>
              </Badge>

              {demonym && (
                <Badge variant="default">
                  <Users aria-hidden />
                  <span>{demonym}</span>
                </Badge>
              )}

              {capitalCity && (
                <Badge variant="default">
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
              <div className="text-footnote text-label-secondary flex items-center gap-2 pt-0.5 italic">
                <Quote aria-hidden="true" className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">“{motto}”</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Symbol Quick Action Buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:flex-nowrap lg:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              soundEffects.press();
              onSelectFlag();
            }}
          >
            <Flag aria-hidden />
            <span>Select flag</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              soundEffects.press();
              onSelectCoatOfArms();
            }}
          >
            <Shield aria-hidden />
            <span>Select emblem</span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
