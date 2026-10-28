"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { WikiHeroProps, WikiHeroVariant } from "./types";
import { SculptedEmblemHero } from "./SculptedEmblemHero";
import { useHeroVariant } from "./useHeroVariant";

export function WikiHeroMaster(props: WikiHeroProps) {
  const [storedVariant, saveVariant] = useHeroVariant();
  const reduceMotion = useReducedMotion();

  const activeVariant = props.variant ?? storedVariant;

  const handleSelectVariant = (newVariant: WikiHeroVariant) => {
    props.onSelectVariant?.(newVariant);
    saveVariant(newVariant);
  };

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
