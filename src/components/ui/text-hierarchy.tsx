"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/lib/utils';
import { TypewriterEffect } from './typewriter-effect';
import { FlipWords } from './flip-words';

export type TextHierarchyLevel = 
  | 'hero'           // Main page titles - typewriter effect
  | 'section'        // Section headers - flip words for dynamic content
  | 'subsection'     // Subsection headers - simple fade in
  | 'emphasis'       // Important text - subtle highlight animation
  | 'body'           // Regular text - no animation
  | 'caption';       // Small text - fade in

export type AnimationType = 
  | 'typewriter'     // Character by character reveal
  | 'flip'           // Word rotation effect
  | 'fade'           // Simple fade in
  | 'slide'          // Slide up with fade
  | 'highlight'      // Background highlight sweep
  | 'none';          // No animation

interface TextHierarchyProps {
  level: TextHierarchyLevel;
  children?: React.ReactNode;
  text?: string;
  words?: string[];
  animation?: AnimationType;
  className?: string;
  delay?: number;
  once?: boolean;
}

const hierarchyConfig = {
  hero: {
    element: 'h1' as const,
    baseClasses: 'text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight',
    defaultAnimation: 'typewriter' as AnimationType,
    colors: 'bg-gradient-to-r from-[var(--color-warning)] via-[var(--color-warning)] to-[var(--color-warning-dark)] bg-clip-text text-transparent'
  },
  section: {
    element: 'h2' as const,
    baseClasses: 'text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight',
    defaultAnimation: 'flip' as AnimationType,
    colors: 'text-[var(--color-warning)]'
  },
  subsection: {
    element: 'h3' as const,
    baseClasses: 'text-xl md:text-2xl font-medium',
    defaultAnimation: 'slide' as AnimationType,
    colors: 'text-[var(--color-text-primary)]'
  },
  emphasis: {
    element: 'span' as const,
    baseClasses: 'font-medium',
    defaultAnimation: 'highlight' as AnimationType,
    colors: 'text-[var(--color-warning)]'
  },
  body: {
    element: 'p' as const,
    baseClasses: 'text-base',
    defaultAnimation: 'none' as AnimationType,
    colors: 'text-[var(--color-text-secondary)]'
  },
  caption: {
    element: 'span' as const,
    baseClasses: 'text-sm',
    defaultAnimation: 'fade' as AnimationType,
    colors: 'text-[var(--color-text-muted)]'
  }
};

const animationVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.6, ease: "easeOut" as const }
  },
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" as const }
  },
  highlight: {
    initial: { backgroundSize: "0% 100%" },
    animate: { backgroundSize: "100% 100%" },
    transition: { duration: 0.8, ease: "easeInOut" as const }
  }
};

export function TextHierarchy({
  level,
  children,
  text,
  words,
  animation,
  className,
  delay = 0,
  once = true
}: TextHierarchyProps) {
  const config = hierarchyConfig[level];
  const Element = config.element;
  const finalAnimation = animation || config.defaultAnimation;
  
  const baseClasses = cn(
    config.baseClasses,
    config.colors,
    className
  );

  // For typewriter effect (hero titles)
  if (finalAnimation === 'typewriter' && text) {
    return (
      <TypewriterEffect
        words={[{ text, className: baseClasses }]}
        className="flex"
        cursorClassName="bg-[var(--color-warning)]"
      />
    );
  }

  // For flip words effect (section headers with dynamic content)
  if (finalAnimation === 'flip' && words && words.length > 0) {
    return (
      <Element className={baseClasses}>
        <FlipWords words={words} className={baseClasses} />
      </Element>
    );
  }

  // For highlight effect (emphasis text)
  if (finalAnimation === 'highlight') {
    return (
      <motion.span
        className={cn(
          baseClasses,
          "bg-gradient-to-r from-[var(--color-warning)]/20 to-[var(--color-warning)]/20 bg-no-repeat",
          "bg-left-bottom"
        )}
        style={{ backgroundSize: "0% 100%" }}
        initial="initial"
        animate="animate"
        variants={animationVariants.highlight}
        transition={{ delay, ...animationVariants.highlight.transition }}
      >
        {children || text}
      </motion.span>
    );
  }

  // For other motion animations
  if (finalAnimation !== 'none' && animationVariants[finalAnimation as keyof typeof animationVariants]) {
    const variant = animationVariants[finalAnimation as keyof typeof animationVariants];
    
    return (
      <motion.div
        initial="initial"
        animate="animate"
        variants={variant}
        transition={{ delay, ...variant.transition }}
        viewport={{ once }}
      >
        <Element className={baseClasses}>
          {children || text}
        </Element>
      </motion.div>
    );
  }

  // No animation
  return (
    <Element className={baseClasses}>
      {children || text}
    </Element>
  );
}

// Convenience components for common use cases
export function HeroTitle({ 
  text, 
  className, 
  delay = 0 
}: { 
  text: string; 
  className?: string; 
  delay?: number; 
}) {
  return (
    <TextHierarchy
      level="hero"
      text={text}
      className={className}
      delay={delay}
    />
  );
}

export function SectionHeader({ 
  words, 
  text,
  className, 
  delay = 0 
}: { 
  words?: string[];
  text?: string;
  className?: string; 
  delay?: number; 
}) {
  if (words && words.length > 0) {
    return (
      <TextHierarchy
        level="section"
        words={words}
        className={className}
        delay={delay}
      />
    );
  }
  
  return (
    <TextHierarchy
      level="section"
      text={text}
      animation="slide"
      className={className}
      delay={delay}
    />
  );
}

export function EmphasisText({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <TextHierarchy
      level="emphasis"
      className={className}
    >
      {children}
    </TextHierarchy>
  );
}

export function CaptionText({ 
  text, 
  className,
  delay = 0 
}: { 
  text: string; 
  className?: string;
  delay?: number;
}) {
  return (
    <TextHierarchy
      level="caption"
      text={text}
      className={className}
      delay={delay}
    />
  );
}

export function BodyText({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <TextHierarchy
      level="body"
      className={className}
    >
      {children}
    </TextHierarchy>
  );
}