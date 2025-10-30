"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

interface CharacterBlurRevealProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
}

export const CharacterBlurReveal: React.FC<CharacterBlurRevealProps> = ({
  text,
  className,
  delay = 0,
  duration = 0.6,
  stagger = 0.05,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [delay]);

  const characters = text.split("");

  return (
    <div className={cn("overflow-hidden", className)}>
      <AnimatePresence>
        {isVisible && (
          <motion.div className="flex">
            {characters.map((char, index) => (
              <motion.span
                key={index}
                initial={{
                  filter: "blur(10px)",
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  filter: "blur(0px)",
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration,
                  delay: index * stagger,
                  ease: "easeOut",
                }}
                className="inline-block"
                style={{
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
