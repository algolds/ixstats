/**
 * Rubik's Cube Flags Component
 * Grid that rotates rows/columns like a Rubik's cube
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SimpleFlag } from "~/components/SimpleFlag";
import { cn } from "~/lib/utils";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface RubiksCubeFlagsProps {
  countries: CountryData[];
  className?: string;
  gridSize?: number;
  animationSpeed?: number;
  hoverOnly?: boolean;
  externalHover?: boolean;
}

export const RubiksCubeFlags: React.FC<RubiksCubeFlagsProps> = ({
  countries,
  className,
  gridSize = 4,
  animationSpeed = 2000,
  hoverOnly = false,
  externalHover = false,
}) => {
  const [flagGrid, setFlagGrid] = useState<CountryData[][]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<{
    type: "row" | "column";
    index: number;
    direction: "clockwise" | "counterclockwise";
  } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize flag grid
  useEffect(() => {
    if (!countries || countries.length === 0) return;

    const shuffledCountries = [...countries].sort(() => Math.random() - 0.5);
    const newGrid: CountryData[][] = [];

    for (let row = 0; row < gridSize; row++) {
      newGrid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        const index = row * gridSize + col;
        newGrid[row][col] = shuffledCountries[index % shuffledCountries.length];
      }
    }

    setFlagGrid(newGrid);
  }, [countries, gridSize]);

  // Rotate a row clockwise or counterclockwise
  const rotateRow = (rowIndex: number, clockwise: boolean = true) => {
    setFlagGrid((prevGrid) => {
      const newGrid = [...prevGrid];
      const row = [...newGrid[rowIndex]];

      if (clockwise) {
        // Move last element to front
        const lastElement = row.pop();
        if (lastElement) row.unshift(lastElement);
      } else {
        // Move first element to back
        const firstElement = row.shift();
        if (firstElement) row.push(firstElement);
      }

      newGrid[rowIndex] = row;
      return newGrid;
    });
  };

  // Rotate a column clockwise or counterclockwise
  const rotateColumn = (colIndex: number, clockwise: boolean = true) => {
    setFlagGrid((prevGrid) => {
      const newGrid = [...prevGrid.map((row) => [...row])];
      const column = newGrid.map((row) => row[colIndex]);

      if (clockwise) {
        // Move last element to front
        const lastElement = column.pop();
        if (lastElement) column.unshift(lastElement);
      } else {
        // Move first element to back
        const firstElement = column.shift();
        if (firstElement) column.push(firstElement);
      }

      // Update the grid with new column values
      column.forEach((country, rowIndex) => {
        newGrid[rowIndex][colIndex] = country;
      });

      return newGrid;
    });
  };

  // Perform a random rotation
  const performRandomRotation = () => {
    if (isAnimating) return;

    setIsAnimating(true);

    const isRow = Math.random() < 0.5;
    const index = Math.floor(Math.random() * gridSize);
    const clockwise = Math.random() < 0.5;

    setCurrentAnimation({
      type: isRow ? "row" : "column",
      index,
      direction: clockwise ? "clockwise" : "counterclockwise",
    });

    // Perform the rotation after a brief delay for the animation to start
    setTimeout(() => {
      if (isRow) {
        rotateRow(index, clockwise);
      } else {
        rotateColumn(index, clockwise);
      }
    }, 200);

    // Clear animation state
    setTimeout(() => {
      setIsAnimating(false);
      setCurrentAnimation(null);
    }, 800);
  };

  // Auto-rotation timer - only active when not hover-only or when hovered (internal or external)
  useEffect(() => {
    const effectiveHover = externalHover !== undefined ? externalHover : isHovered;

    if (hoverOnly && !effectiveHover) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      performRandomRotation();
    }, animationSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [animationSpeed, isAnimating, hoverOnly, isHovered, externalHover]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Early return if no countries data - after all hooks
  if (!countries || countries.length === 0) {
    return (
      <div className={cn("text-muted-foreground flex h-32 items-center justify-center", className)}>
        <div className="text-sm">Loading countries...</div>
      </div>
    );
  }

  if (flagGrid.length === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <div className="text-muted-foreground text-sm">Loading cube...</div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      {...(!hoverOnly || externalHover === undefined
        ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          }
        : {})}
    >
      {/* Rubik's Cube Grid */}
      <div
        className="absolute inset-0 p-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
          gap: "2px",
        }}
      >
        {flagGrid.map((row, rowIndex) =>
          row.map((country, colIndex) => {
            const isInAnimatingRow =
              currentAnimation?.type === "row" && currentAnimation.index === rowIndex;
            const isInAnimatingColumn =
              currentAnimation?.type === "column" && currentAnimation.index === colIndex;
            const isAnimatingElement = isInAnimatingRow || isInAnimatingColumn;

            return (
              <motion.div
                key={`${rowIndex}-${colIndex}-${country.id}`}
                className={cn(
                  "glass-hierarchy-child relative overflow-hidden rounded border",
                  isAnimatingElement
                    ? "border-blue-400/60 ring-1 ring-blue-400/30"
                    : "border-white/20"
                )}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
                animate={{
                  scale: isAnimatingElement ? [1, 1.05, 1] : 1,
                  rotateZ: isAnimatingElement
                    ? currentAnimation?.direction === "clockwise"
                      ? [0, 15, 0]
                      : [0, -15, 0]
                    : 0,
                  x: isInAnimatingRow
                    ? currentAnimation?.direction === "clockwise"
                      ? [0, 10, 0]
                      : [0, -10, 0]
                    : 0,
                  y: isInAnimatingColumn
                    ? currentAnimation?.direction === "clockwise"
                      ? [0, 10, 0]
                      : [0, -10, 0]
                    : 0,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
                whileHover={{
                  scale: 1.05,
                  transition: { duration: 0.2 },
                }}
              >
                <SimpleFlag
                  countryName={country.name}
                  className="h-full w-full object-cover"
                  showPlaceholder={true}
                />

                {/* Glass overlay */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `
                      linear-gradient(135deg, 
                        rgba(255, 255, 255, 0.15) 0%, 
                        rgba(255, 255, 255, 0.05) 50%,
                        rgba(0, 0, 0, 0.05) 100%
                      )`,
                    mixBlendMode: "overlay",
                  }}
                />

                {/* Country info - shown on hover or during animation */}
                <motion.div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 transition-opacity duration-300"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: isAnimatingElement && isAnimating ? 0.9 : 0,
                  }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="px-1 text-center text-xs font-medium text-white">
                    {country.name}
                  </div>
                  <div className="text-center text-xs text-white/80">{country.economicTier}</div>
                  {isAnimatingElement && isAnimating && (
                    <div className="mt-1 text-xs font-bold text-blue-300">IN FOCUS</div>
                  )}
                </motion.div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Animation indicator */}
      {currentAnimation && (
        <motion.div
          className="absolute top-2 right-2 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-white/70 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          <motion.div
            className="h-2 w-2 rounded-full bg-blue-400"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <span>
            Rotating {currentAnimation.type} {currentAnimation.index + 1}{" "}
            {currentAnimation.direction}
          </span>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        className="absolute bottom-2 left-2 font-mono text-xs text-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {gridSize}×{gridSize} cube • {countries.length} nations
      </motion.div>
    </div>
  );
};

export default RubiksCubeFlags;
