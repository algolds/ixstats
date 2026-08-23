"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WikiHeroProps, WikiHeroVariant } from "./types";
import { EditorialMastheadHero } from "./EditorialMastheadHero";
import { SculptedEmblemHero } from "./SculptedEmblemHero";
import {
  type RefractionMode,
  REFRACTION_STORAGE_KEY,
  getStoredRefractionMode,
} from "./FeaturedImageRefraction";

const STORAGE_KEY = "wikios:heroVariant";

export function WikiHeroMaster(props: WikiHeroProps) {
  const [internalVariant, setInternalVariant] = useState<WikiHeroVariant>("sculpted-emblem");
  const [internalRefraction, setInternalRefraction] = useState<RefractionMode>("ambient-underglow");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as string | null;
      if (saved === "editorial-masthead") {
        setInternalVariant("editorial-masthead");
      } else {
        setInternalVariant("sculpted-emblem");
      }
      setInternalRefraction(getStoredRefractionMode());
    } catch {
      // ignore storage failures
    }
  }, []);

  const activeVariant = props.variant ?? internalVariant;
  const activeRefraction = props.refractionMode ?? internalRefraction;

  const handleSelectVariant = useCallback((newVariant: WikiHeroVariant) => {
    if (props.onSelectVariant) {
      props.onSelectVariant(newVariant);
    } else {
      setInternalVariant(newVariant);
    }
    try {
      localStorage.setItem(STORAGE_KEY, newVariant);
    } catch {
      // ignore
    }
  }, [props.onSelectVariant]);

  const handleSelectRefraction = useCallback((newMode: RefractionMode) => {
    if (props.onSelectRefractionMode) {
      props.onSelectRefractionMode(newMode);
    } else {
      setInternalRefraction(newMode);
    }
    try {
      localStorage.setItem(REFRACTION_STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
  }, [props.onSelectRefractionMode]);

  const heroProps: WikiHeroProps = {
    ...props,
    variant: activeVariant,
    onSelectVariant: handleSelectVariant,
    refractionMode: activeRefraction,
    onSelectRefractionMode: handleSelectRefraction,
  };

  const renderActiveHero = () => {
    switch (activeVariant) {
      case "editorial-masthead":
        return <EditorialMastheadHero {...heroProps} />;
      case "sculpted-emblem":
      default:
        return <SculptedEmblemHero {...heroProps} />;
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Active Hero Render with Apple-Grade Spring Morph/Crossfade ── */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeVariant}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {renderActiveHero()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
