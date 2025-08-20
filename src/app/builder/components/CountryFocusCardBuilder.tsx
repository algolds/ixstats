"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { useCountryFlag } from "~/hooks/useCountryFlags"; // Import useCountryFlag
import { Globe } from "lucide-react"; // Import Globe icon for fallback

export interface CountryCardData {
  id: string;
  name: string;
  originalId?: string; // Optional original ID for infinite scroll duplicates
}

interface CountryFocusCardProps {
  country: CountryCardData;
  onHoverChange: (countryId: string | null) => void;
  onCountryClick?: (countryId: string) => void; // Add click handler
  cardSize?: 'default' | 'small';
  softSelectedCountryId?: string | null; // New prop
}

export const CountryFocusCardBuilder = React.memo<CountryFocusCardProps>(({
  country,
  onHoverChange,
  onCountryClick,
  cardSize = 'default', // Default to 'default' size
  softSelectedCountryId,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { flag, loading, error } = useCountryFlag(country.name); // Fetch flag data

  const cardHeightClass = cardSize === 'small' ? 'h-48' : 'h-80'; // h-80 for default, h-48 for small

  return (
    <motion.div
      layout
      className={cn(
        "relative cursor-pointer country-focus-card",
        isHovered && "transition-all duration-100 shadow-2xl"
      )}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange(country.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange(null);
      }}
      onClick={() => {
        onCountryClick?.(country.id);
      }}
      animate={isHovered ? { // Apply hover animation when hovered
        scale: 1.08, // Increased scale
        y: -10, // Lift effect
        rotateZ: 0.5, // Subtle Z-axis rotation
        rotateY: 0.5, // Subtle Y-axis rotation
      } : { // Revert to default state when not hovered
        scale: 1,
        y: 0,
        rotateZ: 0,
        rotateY: 0,
      }}
      transition={isHovered ? { // Apply hover transition when hovered
        type: "spring",
        stiffness: 150, // Adjusted stiffness
        damping: 20 // Adjusted damping
      } : { // Revert to default state with a simple transition
        duration: 0.1,
        ease: "easeInOut"
      }}
    >
      <div
        className={cn(
          "relative glass-floating glass-refraction glass-interactive overflow-hidden transition-all duration-500 ease-out",
          cardHeightClass,
          cardSize === 'small' && 'aspect-square',
          isHovered && "backdrop-blur-md brightness-105 saturate-110",
          softSelectedCountryId === country.id && "ring-2 ring-blue-400/60 ring-offset-2 ring-offset-black/20 shadow-2xl shadow-blue-500/20"
        )
      }>
        {/* Animated Flag Background */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-300"
          style={{
            backgroundImage: flag?.flagUrl ? `url('${flag.flagUrl}')` : 'none',
            opacity: loading || error || !flag?.flagUrl ? 0.2 : 1, // Dim if loading/error
          }}
        >
          {(loading || error || !flag?.flagUrl) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
              <Globe className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>

        {/* Content Overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/50 flex flex-col justify-end p-6 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Country Name */}
          <motion.div
            animate={{
              scale: isHovered ? 1.05 : 1,
              opacity: isHovered ? 0.9 : 1, // Keep text visible on hover
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }} // Added damping for smoother opacity transition
          >
            <span
              className="text-xl md:text-2xl font-medium text-white [text-shadow:0_0_10px_rgba(255,255,255,0.3)] antialiased"
            >
              {country.name}
            </span>
          </motion.div>
        </div>

        {/* Always Visible Country Name */}
        {!isHovered && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-xl md:text-2xl font-medium text-white [text-shadow:0_0_15px_rgba(255,255,255,0.4)] antialiased">
              {country.name}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

CountryFocusCardBuilder.displayName = "CountryFocusCard";