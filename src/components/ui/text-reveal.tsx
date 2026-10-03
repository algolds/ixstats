"use client";

import { motion, useAnimation, useInView } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils/cn";

interface TextRevealProps {
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
}

export const TextReveal = ({ children, className, delay = 0, duration = 0.6 }: TextRevealProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  const words = children.split(" ");

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      className={cn("overflow-hidden", className)}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{
            duration,
            delay: delay + index * 0.1,
            ease: "easeOut",
          }}
        >
          {word}
          {index !== words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </motion.div>
  );
};

interface FadeInProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeIn = ({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className,
}: FadeInProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { y: 30, opacity: 0 };
      case "down":
        return { y: -30, opacity: 0 };
      case "left":
        return { x: 30, opacity: 0 };
      case "right":
        return { x: -30, opacity: 0 };
      default:
        return { y: 30, opacity: 0 };
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitialPosition()}
      animate={isInView ? { x: 0, y: 0, opacity: 1 } : getInitialPosition()}
      transition={{
        duration,
        delay,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
