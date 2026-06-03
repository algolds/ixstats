"use client";

import React, { useState } from "react";
import { motion, useMotionValue, useMotionTemplate } from "motion/react";
import { cn } from "~/lib/utils";

import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  depth?: "base" | "elevated" | "modal" | "interactive";
  blur?: "none" | "light" | "medium" | "heavy";
  gradient?: "none" | "subtle" | "dynamic";
  hover?: boolean;
  theme?: "gold" | "blue" | "indigo" | "red" | "emerald" | "teal" | "neutral";
  motionPreset?: "slide" | "fade" | "scale" | "none";
  onClick?: () => void;
  ref?: React.Ref<HTMLDivElement>; // Added ref prop
  style?: React.CSSProperties; // Added style prop
  texture?: TextureType; // Added texture prop
  textureOpacity?: number; // Added textureOpacity prop
}

const depthStyles = {
  base: "border",
  elevated: "border shadow-lg",
  modal: "border shadow-2xl",
  interactive: "border shadow-md hover:shadow-xl hover:scale-[1.005] duration-300 transition-all",
};

const blurStyles = {
  none: "",
  light: "backdrop-blur-sm",
  medium: "backdrop-blur-md",
  heavy: "backdrop-blur-lg",
};

const gradientStyles = {
  none: "",
  subtle: "bg-gradient-to-br from-bg-surface/5 to-bg-surface/10",
  dynamic: "bg-gradient-to-br from-current/10 via-transparent to-current/5",
};

const themeStyles = {
  gold: "text-amber-400 border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.04)]",
  blue: "text-blue-400 border-blue-500/25 shadow-[0_0_15px_rgba(59,130,246,0.04)]",
  indigo: "text-indigo-400 border-indigo-500/25 shadow-[0_0_15px_rgba(99,102,241,0.04)]",
  red: "text-red-400 border-red-500/25 shadow-[0_0_15px_rgba(239,68,68,0.04)]",
  emerald: "text-emerald-400 border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.04)]",
  teal: "text-teal-400 border-teal-500/25 shadow-[0_0_15px_rgba(20,184,166,0.04)]",
  neutral: "text-text-secondary border-border-primary/20",
};

const themeBgStyles = {
  gold: "bg-gradient-to-br from-amber-500/[0.08] via-white/[0.02] to-amber-500/[0.03]",
  blue: "bg-gradient-to-br from-blue-500/[0.08] via-white/[0.02] to-blue-500/[0.03]",
  indigo: "bg-gradient-to-br from-indigo-500/[0.08] via-white/[0.02] to-indigo-500/[0.03]",
  red: "bg-gradient-to-br from-red-500/[0.08] via-white/[0.02] to-red-500/[0.03]",
  emerald: "bg-gradient-to-br from-emerald-500/[0.08] via-white/[0.02] to-emerald-500/[0.03]",
  teal: "bg-gradient-to-br from-teal-500/[0.08] via-white/[0.02] to-teal-500/[0.03]",
  neutral: "bg-white/[0.03]",
};

const themeSpotlightColors = {
  gold: "rgba(245, 158, 11, 0.12)",
  blue: "rgba(59, 130, 246, 0.12)",
  indigo: "rgba(99, 102, 241, 0.12)",
  red: "rgba(239, 68, 68, 0.12)",
  emerald: "rgba(16, 185, 129, 0.12)",
  teal: "rgba(20, 184, 166, 0.12)",
  neutral: "rgba(255, 255, 255, 0.05)",
};

const motionPresets = {
  slide: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeOut" },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  none: {},
};

export function GlassCard({
  children,
  className,
  depth = "base",
  blur = "medium",
  gradient = "subtle",
  hover = false,
  theme = "neutral",
  motionPreset = "fade",
  onClick,
  ref, // Destructure ref
  style, // Destructure style
  texture = "dots", // Default to dots texture overlay
  textureOpacity = 0.03,
}: GlassCardProps) {
  const isInteractive = Boolean(onClick) || hover;
  const finalDepth = isInteractive ? "interactive" : depth;

  // Spotlight state and mouse tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovering, setIsHovering] = useState(false);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const cardClasses = cn(
    "rounded-xl overflow-hidden relative",
    "backdrop-blur-md touch-manipulation",
    themeBgStyles[theme] || themeBgStyles.neutral,
    depthStyles[finalDepth],
    blurStyles[blur],
    gradientStyles[gradient],
    themeStyles[theme],
    hover && "hover:bg-white/[0.05] hover:border-white/20",
    isInteractive && "cursor-pointer active:scale-[0.98] md:active:scale-100",
    className
  );

  const CardComponent = motionPreset !== "none" ? motion.div : "div";
  const motionProps = motionPreset !== "none" ? motionPresets[motionPreset] : {};

  return (
    <CardComponent
      ref={ref} // Pass ref to CardComponent
      style={style} // Pass style to CardComponent
      className={cardClasses}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...motionProps}
    >
      {/* Interactive Cursor Spotlight Layer */}
      {isInteractive && (
        <motion.div
          className="pointer-events-none absolute -inset-px z-0 rounded-xl"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                350px circle at ${mouseX}px ${mouseY}px,
                ${themeSpotlightColors[theme] || themeSpotlightColors.neutral},
                transparent 80%
              )
            `,
          }}
          animate={{ opacity: isHovering ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {texture && texture !== "none" && (
        <TextureOverlay texture={texture} opacity={textureOpacity} />
      )}
      <div className="relative z-10 h-full w-full">{children}</div>
    </CardComponent>
  );
}

export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("border-border-primary/50 border-b p-6", className)}>{children}</div>;
}

export const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
>(({ children, className, style }, ref) => {
  return (
    <div ref={ref} className={cn("p-6", className)} style={style}>
      {children}
    </div>
  );
});

GlassCardContent.displayName = "GlassCardContent";

export function GlassCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-border-primary/50 bg-bg-surface/5 border-t p-6", className)}>
      {children}
    </div>
  );
}
