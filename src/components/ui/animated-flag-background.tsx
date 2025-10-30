"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "~/lib/utils";

interface AnimatedFlagBackgroundProps {
  flagUrl?: string;
  countryName?: string;
  className?: string;
  intensity?: "subtle" | "moderate" | "strong";
  windDirection?: "left" | "right";
  enablePhysics?: boolean;
  interactWithGlass?: boolean;
  fallbackColor?: string;
}

export const AnimatedFlagBackground: React.FC<AnimatedFlagBackgroundProps> = ({
  flagUrl,
  countryName,
  className,
  intensity = "moderate",
  windDirection = "right",
  enablePhysics = true,
  interactWithGlass = true,
  fallbackColor = "rgba(59, 130, 246, 0.1)",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const [isHovered, setIsHovered] = useState(false);
  const [flagLoaded, setFlagLoaded] = useState(false);
  const controls = useAnimation();

  // Physics parameters based on intensity
  const getPhysicsParams = () => {
    switch (intensity) {
      case "subtle":
        return {
          amplitude: 0.015,
          frequency: 0.8,
          speed: 0.02,
          segments: 20,
        };
      case "strong":
        return {
          amplitude: 0.035,
          frequency: 1.4,
          speed: 0.04,
          segments: 30,
        };
      default: // moderate
        return {
          amplitude: 0.025,
          frequency: 1.0,
          speed: 0.03,
          segments: 25,
        };
    }
  };

  const physics = getPhysicsParams();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !flagUrl || !enablePhysics) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setFlagLoaded(true);
      let time = 0;

      const animate = () => {
        if (!canvas || !ctx) return;

        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;

        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Calculate wave parameters
        const hoverMultiplier = isHovered ? 1.5 : 1;
        const waveAmplitude = physics.amplitude * hoverMultiplier;
        const waveFrequency = physics.frequency * hoverMultiplier;
        const waveSpeed = physics.speed * (windDirection === "left" ? -1 : 1);

        // Create flag mesh
        const segments = physics.segments;
        const segmentWidth = rect.width / segments;
        const segmentHeight = rect.height / segments;

        for (let x = 0; x < segments; x++) {
          for (let y = 0; y < segments; y++) {
            const sx = (x / segments) * img.width;
            const sy = (y / segments) * img.height;
            const sw = img.width / segments;
            const sh = img.height / segments;

            const dx = x * segmentWidth;
            const dy = y * segmentHeight;

            // Wave calculation
            const waveX =
              Math.sin((x / segments) * Math.PI * waveFrequency + time * waveSpeed) *
              waveAmplitude *
              rect.width;
            const waveY =
              Math.sin((y / segments) * Math.PI * waveFrequency * 0.5 + time * waveSpeed * 0.7) *
              waveAmplitude *
              rect.height *
              0.3;

            // Wind effect - more pronounced on the right edge
            const windEffect = (x / segments) * waveAmplitude * rect.width * 0.5;

            ctx.save();
            ctx.globalAlpha = 0.6 - (x / segments) * 0.2; // Fade towards wind direction

            try {
              ctx.drawImage(
                img,
                sx,
                sy,
                sw,
                sh,
                dx + waveX + windEffect,
                dy + waveY,
                segmentWidth,
                segmentHeight
              );
            } catch (e) {
              // Fallback if image drawing fails
              ctx.fillStyle = fallbackColor;
              ctx.fillRect(dx + waveX + windEffect, dy + waveY, segmentWidth, segmentHeight);
            }

            ctx.restore();
          }
        }

        time += 1;
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    };

    img.onerror = () => {
      setFlagLoaded(false);
    };

    img.src = flagUrl;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [flagUrl, isHovered, intensity, windDirection, enablePhysics, fallbackColor]);

  // Glass interaction effects
  useEffect(() => {
    if (!interactWithGlass) return;

    if (isHovered) {
      controls.start({
        scale: 1.02,
        filter: "brightness(1.1) saturate(1.2)",
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 25,
        },
      });
    } else {
      controls.start({
        scale: 1,
        filter: "brightness(1) saturate(1)",
        transition: {
          type: "spring",
          stiffness: 300,
          damping: 25,
        },
      });
    }
  }, [isHovered, interactWithGlass, controls]);

  // Fallback for when physics is disabled or flag fails to load
  const renderStaticFallback = () => (
    <motion.div
      className="absolute inset-0 bg-gradient-to-br opacity-30"
      style={{
        backgroundImage:
          flagUrl && flagLoaded
            ? `url(${flagUrl})`
            : `linear-gradient(135deg, ${fallbackColor}, transparent)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      animate={controls}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );

  if (!enablePhysics || !flagUrl) {
    return renderStaticFallback();
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {/* Physics-based animated flag */}
      <motion.canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        animate={controls}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          mixBlendMode: "multiply",
        }}
      />

      {/* Overlay for better text readability */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"
        style={{
          opacity: isHovered ? 0.3 : 0.1,
        }}
      />

      {/* Light refraction effect for glass integration */}
      {interactWithGlass && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{
            opacity: isHovered ? 0.15 : 0.05,
            background: isHovered
              ? "linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)"
              : "linear-gradient(45deg, rgba(255,255,255,0.03) 0%, transparent 50%, rgba(255,255,255,0.01) 100%)",
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Country name overlay with physics-aware positioning */}
      {countryName && (
        <motion.div
          className="pointer-events-none absolute bottom-4 left-4 z-10"
          animate={{
            x: isHovered ? 2 : 0,
            y: isHovered ? -1 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        >
          <div className="rounded bg-black/30 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {countryName}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Convenience component for glass card integration
export const GlassFlagBackground: React.FC<AnimatedFlagBackgroundProps> = (props) => (
  <AnimatedFlagBackground
    {...props}
    interactWithGlass={true}
    enablePhysics={true}
    intensity="moderate"
  />
);

export default AnimatedFlagBackground;
