"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WikiHeroProps, WikiHeroVariant } from "./types";
import { SculptedEmblemHero } from "./SculptedEmblemHero";

const STORAGE_KEY = "wikios:heroVariant";

export function WikiHeroMaster(props: WikiHeroProps) {
  const [internalVariant, setInternalVariant] = useState<WikiHeroVariant>("sculpted-emblem");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as string | null;
      if (saved === "editorial-masthead") {
        // oxlint-disable-next-line
        setInternalVariant("editorial-masthead");
      } else {
        setInternalVariant("sculpted-emblem");
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  const activeVariant = props.variant ?? internalVariant;

  const handleSelectVariant = useCallback(
    (newVariant: WikiHeroVariant) => {
      if (props.onSelectVariant) {
        // oxlint-disable-next-line
        props.onSelectVariant(newVariant);
      } else {
        setInternalVariant(newVariant);
      }
      try {
        localStorage.setItem(STORAGE_KEY, newVariant);
      } catch {
        // ignore
      }
    },
    [props.onSelectVariant]
  );

  const heroProps: WikiHeroProps = {
    ...props,
    variant: activeVariant,
    onSelectVariant: handleSelectVariant,
  };

  const renderActiveHero = () => {
    return <SculptedEmblemHero {...heroProps} />;
  };

  return (
    <div className="flex w-full flex-col items-center">
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
