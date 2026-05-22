"use client";

import React, { useEffect, useState } from "react";
import { motion, useTransform, useMotionValue, type MotionValue } from "motion/react";
import { Download, ExternalLink, ArrowLeft, Check, HelpCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { PreText } from "~/components/ui/pretext";
import { TextAnimate } from "~/components/ui/text-animate";
import { EnhancedCountryFlag } from "~/components/ui/enhanced-country-flag";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { RealCountryData } from "../lib/economy-data-service";
import { Highlighter } from "@/components/magicui/highlighter";
import { Globe } from "~/components/magicui/globe";
import { getOptimalTextStyling } from "~/lib/flag-color-analysis";



interface CountrySelectorHeaderProps {
  softSelectedCountry: RealCountryData | null;
  onBackToIntro?: () => void;
  scrollY?: MotionValue<number>;
}

export function CountrySelectorHeader({
  softSelectedCountry,
  onBackToIntro,
  scrollY,
}: CountrySelectorHeaderProps) {
  const router = useRouter();
  const { flag } = useCountryFlagRouteAware(
    softSelectedCountry?.foundationCountryName || softSelectedCountry?.name || ""
  );
  const [textStyling, setTextStyling] = useState<{
    color: string;
    textShadow?: string;
  }>({
    color: "white",
    textShadow: [
      "0 0 20px rgba(0, 0, 0, 0.9)",
      "0 0 10px rgba(0, 0, 0, 0.8)",
      "0 2px 4px rgba(0, 0, 0, 0.9)",
      "0 1px 2px rgba(0, 0, 0, 1)",
      "1px 1px 0 rgba(0, 0, 0, 0.8)",
      "-1px -1px 0 rgba(0, 0, 0, 0.8)",
      "1px -1px 0 rgba(0, 0, 0, 0.8)",
      "-1px 1px 0 rgba(0, 0, 0, 0.8)",
    ].join(", "),
  });

  // Analyze flag colors when country or flag changes
  useEffect(() => {
    const analyzeFlag = async () => {
      if (softSelectedCountry && flag?.flagUrl) {
        try {
          const styling = await getOptimalTextStyling(
            flag.flagUrl,
            softSelectedCountry.foundationCountryName || softSelectedCountry.name
          );
          setTextStyling(styling);
        } catch (error) {
          console.warn("Failed to analyze flag colors for", softSelectedCountry.name, error);
          // Keep default styling on error
        }
      } else {
        // Reset to default when no country/flag
        setTextStyling({
          color: "var(--color-text-primary)",
          textShadow: undefined,
        });
      }
    };

    analyzeFlag();
  }, [softSelectedCountry, flag?.flagUrl]);

  // If scrollY is provided, we can animate the logo
  const fallbackY = useMotionValue(0);
  const activeScrollY = scrollY || fallbackY;
  const logoBlur = useTransform(activeScrollY, [0, 100], ["blur(0px)", "blur(16px)"]);
  const logoOpacity = useTransform(activeScrollY, [0, 100], [1, 0]);
  const logoScale = useTransform(activeScrollY, [0, 100], [1, 0.8]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-8 overflow-hidden rounded-lg p-6"
      style={
        softSelectedCountry && flag?.flagUrl
          ? {
            backgroundImage: `url('${flag.flagUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
          : undefined
      }
    >
      {softSelectedCountry && flag?.flagUrl && (
        <div className="absolute inset-0 z-0 bg-black/40 backdrop-blur-lg backdrop-filter"></div>
      )}
      {softSelectedCountry && !flag?.flagUrl && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[var(--mycountry-primary)]/20 to-[var(--mycountry-secondary)]/20"></div>
      )}
      <div className="relative z-10">
        {/* Main Content */}
        <div className="text-center">
          {softSelectedCountry && (
            <div className="mb-6 flex items-center justify-center gap-4">
              <EnhancedCountryFlag
                countryName={softSelectedCountry.name}
                size="lg"
                hoverBlur={false}
                priority={true}
              />
            </div>
          )}

          <div className="space-y-3">
            {softSelectedCountry ? (
              <>
                <h2
                  className="text-4xl font-bold tracking-tight"
                  style={{
                    color: textStyling.color,
                    textShadow: textStyling.textShadow,
                    filter: "drop-shadow(0 0 8px rgba(0, 0, 0, 0.5))",
                  }}
                >
                  Foundation: {softSelectedCountry.name}
                </h2>
                <p
                  className="text-lg font-medium"
                  style={{
                    color: textStyling.color,
                    textShadow: textStyling.textShadow,
                    filter: "drop-shadow(0 0 6px rgba(0, 0, 0, 0.4))",
                  }}
                >
                  Selected as your economic foundation template
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-center w-full">
                <motion.div
                  className="flex justify-center"
                  style={{
                    filter: logoBlur,
                    opacity: logoOpacity,
                    scale: logoScale
                  }}
                >
                  <PreText className="flex justify-center">
                    <MyCountryLogo size="xl" animated />
                  </PreText>
                </motion.div>
                <div className="space-y-2 max-w-md mx-auto">
                  <TextAnimate
                    animation="blurIn"
                    by="word"
                    className="text-muted-foreground text-sm leading-relaxed"
                  >
                    Choose a starting country template below to begin building
                  </TextAnimate>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
