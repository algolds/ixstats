"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Zap } from "lucide-react";
import { BlurFade } from "~/components/magicui/blur-fade";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../components/glass/GlassCard";
import { CountryPreview } from "./CountryPreview";
import { CountrySelectionCard } from "./CountrySelectionCard";
import type { RealCountryData } from "../lib/economy-data-service";

interface LivePreviewProps {
  softSelectedCountry: RealCountryData | null;
  hoveredCountry: RealCountryData | null;
  isVisible: boolean;
  onCountrySelect: (country: RealCountryData, customName: string) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
}

export function LivePreview({
  softSelectedCountry,
  hoveredCountry,
  isVisible,
  onCountrySelect,
  onCancel,
  style,
}: LivePreviewProps) {
  const [newCountryName, setNewCountryName] = useState("");

  const handleCountrySelect = () => {
    if (softSelectedCountry && newCountryName.trim()) {
      onCountrySelect(softSelectedCountry, newCountryName.trim());
    } else {
      alert("Please enter a name for your nation.");
    }
  };

  const handleCancel = () => {
    onCancel();
    setNewCountryName("");
  };

  return (
    <div className="space-y-6" style={style}>
      <BlurFade delay={0.25} inView={isVisible} inViewMargin="-50px">
        <motion.div layout>
          <GlassCard depth="modal" blur="heavy" theme="gold" className="z-60 p-4">
            <GlassCardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-amber-300" />
                <h3 className="font-semibold text-[var(--color-text-primary)]">Live Preview</h3>
              </div>
            </GlassCardHeader>
            <GlassCardContent>
              <AnimatePresence mode="wait">
                {softSelectedCountry ? (
                  <CountrySelectionCard
                    key={softSelectedCountry.name + "-soft-selected"}
                    country={softSelectedCountry}
                    newCountryName={newCountryName}
                    onCountryNameChange={setNewCountryName}
                    onConfirm={handleCountrySelect}
                    onCancel={handleCancel}
                  />
                ) : hoveredCountry ? (
                  <CountryPreview key={hoveredCountry.name} country={hoveredCountry} size="small" />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-8 text-center"
                  >
                    <Zap className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-muted)]/50" />
                    <p className="text-[var(--color-text-muted)]">
                      Hover over a country to see detailed preview
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      </BlurFade>
    </div>
  );
}
