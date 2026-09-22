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
  Globe,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { Badge } from "~/components/ui/badge";
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
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 backdrop-blur-xl transition-all duration-300",
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

      {/* Cinematic Background Flag Watermark Scrim (from MyCountry National Standing) */}
      {displayFlag && (
        <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 overflow-hidden opacity-[0.12] transition-opacity duration-300 select-none dark:opacity-[0.16]">
          <img
            src={displayFlag}
            alt=""
            className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
          />
          <div className="via-card/75 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
        </div>
      )}

      {/* Ambient warm gradient halo */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-teal-500/10 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: National Symbols & Insignia */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
          {/* Flag Preview with Overlay Actions */}
          <div className="relative group/flag shrink-0">
            <div className="relative h-24 w-36 overflow-hidden rounded-xl border border-border/40 bg-muted/40 shadow-md">
              {displayFlag ? (
                <img
                  src={displayFlag}
                  alt={`${displayCountryName} Flag`}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover/flag:scale-105"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center text-muted-foreground">
                  <Flag className="h-6 w-6 text-muted-foreground/60" />
                  <span className="text-[10px] font-semibold">No Flag</span>
                </div>
              )}

              {/* Hover Quick Action Scrim */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover/flag:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    soundEffects.press();
                    onSelectFlag();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition-transform hover:scale-110 active:scale-95"
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
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white transition-transform hover:scale-110 active:scale-95"
                  title="Upload Custom Flag"
                  disabled={isUploadingFlag}
                  data-cuelume-press
                >
                  <Upload className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Coat of Arms Badge overlapping Flag corner */}
            <div className="group/coa absolute -bottom-2 -right-2">
              <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-card shadow-md">
                {displayCoa ? (
                  <img
                    src={displayCoa}
                    alt="Coat of Arms"
                    className="h-full w-full object-contain p-0.5"
                  />
                ) : (
                  <Shield className="h-5 w-5 text-muted-foreground/60" />
                )}

                {/* Coat of Arms Hover Action Scrim */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-200 group-hover/coa:opacity-100">
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
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge
                variant="secondary"
                className="gap-1 border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-500 dark:text-amber-400"
              >
                <Crown className="h-3 w-3" />
                <span>{governmentType || "Republic"}</span>
              </Badge>

              {demonym && (
                <Badge
                  variant="outline"
                  className="gap-1 border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span>{demonym}</span>
                </Badge>
              )}

              {capitalCity && (
                <Badge
                  variant="outline"
                  className="gap-1 border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span>{capitalCity}</span>
                </Badge>
              )}
            </div>

            {/* Display Nation Name */}
            <div>
              <h2 className="text-foreground truncate text-2xl sm:text-3xl font-extrabold tracking-tight">
                {displayCountryName}
              </h2>
              {displayOfficialName && displayOfficialName !== displayCountryName && (
                <p className="text-muted-foreground truncate text-xs sm:text-sm font-medium italic">
                  {displayOfficialName}
                </p>
              )}
            </div>

            {/* National Motto Quote */}
            {motto && (
              <div className="flex items-center gap-1.5 pt-0.5 text-xs text-amber-600/90 dark:text-amber-400/90 italic">
                <Quote className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">“{motto}”</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Symbol Quick Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              onSelectFlag();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:border-amber-500/40 hover:bg-accent active:scale-[0.98]"
            data-cuelume-press
          >
            <Flag className="h-3.5 w-3.5 text-amber-500" />
            <span>Select Flag</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              onSelectCoatOfArms();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:border-teal-500/40 hover:bg-accent active:scale-[0.98]"
            data-cuelume-press
          >
            <Shield className="h-3.5 w-3.5 text-teal-500" />
            <span>Select Emblem</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
});
