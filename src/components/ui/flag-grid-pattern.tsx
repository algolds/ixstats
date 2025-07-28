"use client";

import { cn } from "~/lib/utils";
import React, { useState, useEffect } from "react";
import { SimpleFlag } from "~/components/SimpleFlag";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface FlagGridPatternProps extends React.HTMLProps<HTMLDivElement> {
  width?: number;
  height?: number;
  squares?: [number, number]; // [horizontal, vertical]
  className?: string;
  squaresClassName?: string;
  countries: CountryData[];
}

export function FlagGridPattern({
  width = 60,
  height = 60,
  squares = [5, 5],
  className,
  squaresClassName,
  countries,
  ...props
}: FlagGridPatternProps) {
  const [horizontal, vertical] = squares;
  const [hoveredSquare, setHoveredSquare] = useState<number | null>(null);
  const [flagMapping, setFlagMapping] = useState<Record<number, CountryData>>({});
  const [animatingSquare, setAnimatingSquare] = useState<number | null>(null);

  // Initialize random flag mapping with fixed 5x5 grid
  useEffect(() => {
    if (countries.length === 0) return;
    
    const mapping: Record<number, CountryData> = {};
    const totalSquares = 25; // Fixed 5x5 grid
    
    for (let i = 0; i < totalSquares; i++) {
      // Fill about 60% of squares with flags for better coverage
      if (Math.random() < 0.6) {
        mapping[i] = countries[Math.floor(Math.random() * countries.length)];
      }
    }
    
    setFlagMapping(mapping);
  }, [countries]);

  // Replace one flag at a time with subtle animation
  useEffect(() => {
    if (countries.length === 0) return;
    
    const interval = setInterval(() => {
      setFlagMapping(prev => {
        const newMapping = { ...prev };
        const allSquares = Array.from({ length: 25 }, (_, i) => i);
        
        // Pick one random square to update
        const randomIndex = Math.floor(Math.random() * allSquares.length);
        const targetSquare = allSquares[randomIndex];
        
        // Start animation
        setAnimatingSquare(targetSquare);
        
        // Replace with new country or remove existing
        if (Math.random() < 0.7) {
          // Replace with new country
          newMapping[targetSquare] = countries[Math.floor(Math.random() * countries.length)];
        } else if (newMapping[targetSquare]) {
          // Remove existing flag
          delete newMapping[targetSquare];
        } else {
          // Add new flag to empty square
          newMapping[targetSquare] = countries[Math.floor(Math.random() * countries.length)];
        }
        
        // Clear animation after transition
        setTimeout(() => setAnimatingSquare(null), 800);
        
        return newMapping;
      });
    }, 4000); // Slower, more subtle updates
    
    return () => clearInterval(interval);
  }, [countries]);

  const totalSquares = horizontal * vertical;

  return (
    <div
      className={cn(
        "absolute inset-0 h-full w-full pointer-events-none",
        "glass-hierarchy-parent backdrop-blur-xl",
        className,
      )}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${horizontal}, ${width}px)`,
        gridTemplateRows: `repeat(${vertical}, ${height}px)`,
        gap: '2px',
        justifyContent: 'center',
        alignContent: 'center',
        filter: 'blur(2px)',
        opacity: 0.4
      }}
      {...props}
    >
      {Array.from({ length: 25 }).map((_, index) => {
        const hasFlag = flagMapping[index];
        const isHovered = hoveredSquare === index;
        const isAnimating = animatingSquare === index;
        
        return (
          <div
            key={index}
            className={cn(
              "border border-white/10 transition-all duration-800 ease-in-out relative overflow-hidden rounded-sm",
              "glass-hierarchy-child glass-refraction",
              isHovered ? "border-blue-400/40 shadow-sm scale-105" : "",
              isAnimating ? "scale-110 border-yellow-400/60" : "",
              hasFlag ? "opacity-80" : "opacity-30",
              squaresClassName,
            )}
            onMouseEnter={() => setHoveredSquare(index)}
            onMouseLeave={() => setHoveredSquare(null)}
            style={{
              backgroundColor: hasFlag ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(8px) saturate(120%)',
              WebkitBackdropFilter: 'blur(8px) saturate(120%)',
              transform: isAnimating ? 'scale(1.1) rotateZ(2deg)' : 'scale(1)',
              transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {hasFlag && (
              <div className="absolute inset-0">
                <SimpleFlag
                  countryName={hasFlag.name}
                  className="w-full h-full object-cover"
                  showPlaceholder={true}
                />
                {/* Glass refraction overlay */}
                <div 
                  className="absolute inset-0 glass-refraction"
                  style={{
                    background: `linear-gradient(135deg, 
                      rgba(255, 255, 255, 0.2) 0%, 
                      rgba(255, 255, 255, 0.05) 50%,
                      rgba(0, 0, 0, 0.1) 100%)`,
                    mixBlendMode: 'overlay',
                    opacity: isHovered ? 0.3 : 0.6,
                    transition: 'opacity 0.3s ease'
                  }}
                />
                {/* Depth shadow for glass effect */}
                <div 
                  className="absolute inset-0"
                  style={{
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(255, 255, 255, 0.1)',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}