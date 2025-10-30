"use client";

import React from "react";
import { motion } from "framer-motion";
import { TextAnimate } from "~/components/magicui/text-animate";
import { RiCommandLine } from "react-icons/ri";

interface CountriesHeaderProps {
  onOpenCommandPalette: () => void;
}

export const CountriesHeader: React.FC<CountriesHeaderProps> = ({ onOpenCommandPalette }) => {
  return (
    <div className="mb-12 text-center">
      <TextAnimate
        animation="scaleUp"
        by="text"
        delay={0.2}
        duration={0.8}
        className="text-foreground mb-6 text-2xl font-medium md:text-3xl"
      >
        explore the countries of the world
      </TextAnimate>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.6 }}
        className="glass-surface glass-interactive bg-background/50 text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 transition-colors"
        onClick={onOpenCommandPalette}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <RiCommandLine className="h-4 w-4" />
        <span className="text-sm">Press Tab to search & filter</span>
      </motion.div>
    </div>
  );
};
