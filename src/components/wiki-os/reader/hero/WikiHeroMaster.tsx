"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { WikiHeroProps, WikiHeroVariant } from "./types";
import { SystemCommandDockHero } from "./SystemCommandDockHero";
import { TypographicMastheadHero } from "./TypographicMastheadHero";
import { DynamicHaloHubHero } from "./DynamicHaloHubHero";
import { AsymmetricSplitHorizonHero } from "./AsymmetricSplitHorizonHero";
import { SculptedEmblemHero } from "./SculptedEmblemHero";
import { WikiHeroDevSwitcher } from "./WikiHeroDevSwitcher";

const STORAGE_KEY = "wikios:heroVariant";

export function WikiHeroMaster(props: WikiHeroProps) {
  const [variant, setVariant] = useState<WikiHeroVariant>("command-dock");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as WikiHeroVariant | null;
      if (
        saved &&
        [
          "command-dock",
          "typographic",
          "halo-hub",
          "split-horizon",
          "sculpted-emblem",
        ].includes(saved)
      ) {
        setVariant(saved);
      }
    } catch {
      // ignore storage failures
    }
    setMounted(true);
  }, []);

  const handleSelectVariant = (newVariant: WikiHeroVariant) => {
    setVariant(newVariant);
    try {
      localStorage.setItem(STORAGE_KEY, newVariant);
    } catch {
      // ignore
    }
  };

  const renderActiveHero = () => {
    switch (variant) {
      case "command-dock":
        return <SystemCommandDockHero {...props} />;
      case "typographic":
        return <TypographicMastheadHero {...props} />;
      case "halo-hub":
        return <DynamicHaloHubHero {...props} />;
      case "split-horizon":
        return <AsymmetricSplitHorizonHero {...props} />;
      case "sculpted-emblem":
        return <SculptedEmblemHero {...props} />;
      default:
        return <SystemCommandDockHero {...props} />;
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Dev Toggle Bar ── */}
      <WikiHeroDevSwitcher
        currentVariant={variant}
        onSelectVariant={handleSelectVariant}
      />

      {/* ── Active Hero Render with Seamless Morph/Crossfade ── */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={variant}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {renderActiveHero()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
