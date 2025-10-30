/**
 * Random Flag Grid Component
 * Simple 2D grid that randomly swaps flags with smooth animations
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

interface FlagGridItem {
  id: string;
  country: CountryData;
  gridIndex: number;
}

interface RandomFlagGridProps {
  countries: CountryData[];
  className?: string;
  gridSize?: number;
  animationSpeed?: number;
}

export const RandomFlagGrid: React.FC<RandomFlagGridProps> = ({
  countries,
  className,
  gridSize = 4,
  animationSpeed = 1000,
}) => {
  const [flagGrid, setFlagGrid] = useState<FlagGridItem[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverDuration, setHoverDuration] = useState(0);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<number>>(new Set());
  const [currentlyChanging, setCurrentlyChanging] = useState<number | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const changeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize flag grid
  useEffect(() => {
    if (!countries || countries.length === 0) return;

    const totalSlots = gridSize * gridSize;
    const shuffledCountries = [...countries].sort(() => Math.random() - 0.5);

    const newGrid: FlagGridItem[] = [];

    for (let i = 0; i < totalSlots; i++) {
      newGrid.push({
        id: `flag-${i}`,
        country: shuffledCountries[i % shuffledCountries.length],
        gridIndex: i,
      });
    }

    setFlagGrid(newGrid);
  }, [countries, gridSize]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearInterval(hoverTimerRef.current);
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    };
  }, []);

  // Function to change a single flag in a random row
  const changeSingleFlag = () => {
    if (countries.length === 0 || flagGrid.length === 0) return;

    setFlagGrid((prevGrid) => {
      const newGrid = [...prevGrid];

      // Pick a random row
      const randomRow = Math.floor(Math.random() * gridSize);

      // Get all positions in that row
      const rowPositions = [];
      for (let col = 0; col < gridSize; col++) {
        rowPositions.push(randomRow * gridSize + col);
      }

      // Pick a random position in that row
      const randomPosition = rowPositions[Math.floor(Math.random() * rowPositions.length)];

      // Get a random new country
      const randomCountry = countries[Math.floor(Math.random() * countries.length)];

      // Change the flag at that position
      newGrid[randomPosition] = {
        ...newGrid[randomPosition],
        country: randomCountry,
      };

      // Mark as currently changing and recently changed
      setCurrentlyChanging(randomPosition);
      setRecentlyChanged((prev) => new Set([...prev, randomPosition]));

      // Clear the currently changing state after animation
      setTimeout(() => {
        setCurrentlyChanging(null);
      }, 600);

      // Clear the recently changed state after a longer period
      setTimeout(() => {
        setRecentlyChanged((prev) => {
          const newSet = new Set(prev);
          newSet.delete(randomPosition);
          return newSet;
        });
      }, 2000);

      return newGrid;
    });
  };

  // Handle hover events with progressive changes
  const handleMouseEnter = () => {
    setIsHovered(true);
    setHoverDuration(0);

    // Immediately change one flag on hover entry
    changeSingleFlag();

    // Start the hover timer for subsequent changes
    hoverTimerRef.current = setInterval(() => {
      setHoverDuration((prev) => {
        const newDuration = prev + 1;

        // Change a flag every second after the initial change
        if (newDuration % 1 === 0) {
          changeSingleFlag();
        }

        return newDuration;
      });
    }, 1000);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setHoverDuration(0);

    // Clear timers
    if (hoverTimerRef.current) {
      clearInterval(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (changeTimerRef.current) {
      clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }

    // Clear recently changed flags after a delay
    setTimeout(() => {
      setRecentlyChanged(new Set());
      setCurrentlyChanging(null);
    }, 1000);
  };

  // Early return for empty countries or flagGrid
  if (!countries || countries.length === 0 || flagGrid.length === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <div className="text-muted-foreground text-sm">Loading flags...</div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative h-full w-full cursor-pointer overflow-hidden", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Deep background blur layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backdropFilter: "blur(16px) saturate(140%) brightness(1.1)",
          WebkitBackdropFilter: "blur(16px) saturate(140%) brightness(1.1)",
          background: `
            radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
            linear-gradient(135deg, rgba(15, 23, 42, 0.30) 0%, rgba(30, 41, 59, 0.20) 100%)
          `,
        }}
      />

      {/* Glass refraction pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: `
            linear-gradient(45deg, 
              rgba(255, 255, 255, 0.08) 0%, 
              transparent 25%, 
              rgba(255, 255, 255, 0.04) 50%, 
              transparent 75%, 
              rgba(255, 255, 255, 0.08) 100%
            )`,
          backgroundSize: "15px 15px",
          mixBlendMode: "overlay",
        }}
      />

      {/* Depth enhancement layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg, 
              rgba(0, 0, 0, 0.20) 0%, 
              transparent 25%,
              rgba(255, 255, 255, 0.05) 50%,
              transparent 75%,
              rgba(0, 0, 0, 0.15) 100%
            )`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Flag Grid */}
      <div
        className="absolute inset-0 grid gap-1 p-2"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        }}
      >
        <AnimatePresence mode="wait">
          {flagGrid.map((item) => {
            const isCurrentlyChanging = currentlyChanging === item.gridIndex;
            const isRecentlyChanged = recentlyChanged.has(item.gridIndex);

            return (
              <motion.div
                key={`${item.gridIndex}-${item.country.id}`}
                className={cn(
                  "glass-hierarchy-child relative overflow-hidden rounded border",
                  isCurrentlyChanging ? "border-blue-400/60" : "border-white/30",
                  isRecentlyChanged ? "ring-2 ring-blue-400/40" : ""
                )}
                style={{
                  backdropFilter: isCurrentlyChanging
                    ? "blur(15px) saturate(160%) brightness(1.2)"
                    : "blur(10px) saturate(130%) brightness(1.05)",
                  WebkitBackdropFilter: isCurrentlyChanging
                    ? "blur(15px) saturate(160%) brightness(1.2)"
                    : "blur(10px) saturate(130%) brightness(1.05)",
                  background: isCurrentlyChanging
                    ? `linear-gradient(135deg, 
                        rgba(59, 130, 246, 0.25) 0%, 
                        rgba(255, 255, 255, 0.15) 50%,
                        rgba(0, 0, 0, 0.10) 100%
                      )`
                    : `linear-gradient(135deg, 
                        rgba(255, 255, 255, 0.15) 0%, 
                        rgba(255, 255, 255, 0.05) 50%,
                        rgba(0, 0, 0, 0.10) 100%
                      )`,
                  boxShadow: isCurrentlyChanging
                    ? `inset 0 1px 0 rgba(59, 130, 246, 0.4),
                       0 8px 32px rgba(59, 130, 246, 0.25),
                       0 4px 16px rgba(0, 0, 0, 0.2)`
                    : `inset 0 1px 0 rgba(255, 255, 255, 0.2),
                       0 4px 12px rgba(0, 0, 0, 0.15),
                       0 2px 6px rgba(0, 0, 0, 0.1)`,
                }}
                initial={{ opacity: 0.7, scale: 0.95 }}
                animate={{
                  opacity: isCurrentlyChanging ? 1 : isRecentlyChanged ? 0.95 : 0.85,
                  scale: isCurrentlyChanging ? 1.15 : isRecentlyChanged ? 1.05 : 1,
                  rotateY: isCurrentlyChanging ? [0, 90, 180, 270, 360] : 0,
                  rotateZ: isCurrentlyChanging ? [0, 2, -2, 1, 0] : 0,
                }}
                transition={{
                  duration: isCurrentlyChanging ? 0.8 : 0.3,
                  ease: [0.4, 0.0, 0.2, 1],
                  delay: isCurrentlyChanging ? 0 : Math.random() * 0.05,
                }}
                whileHover={{
                  scale: 1.1,
                  opacity: 1,
                  boxShadow: `
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    0 8px 24px rgba(0, 0, 0, 0.2),
                    0 4px 12px rgba(0, 0, 0, 0.15)
                  `,
                  transition: { duration: 0.2 },
                }}
              >
                <SimpleFlag
                  countryName={item.country.name}
                  className="h-full w-full object-cover"
                  showPlaceholder={true}
                />

                {/* Enhanced glass refraction overlay */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `
                    linear-gradient(135deg, 
                      rgba(255, 255, 255, 0.25) 0%, 
                      rgba(255, 255, 255, 0.10) 25%,
                      transparent 50%, 
                      rgba(255, 255, 255, 0.08) 75%,
                      rgba(255, 255, 255, 0.15) 100%
                    )`,
                    mixBlendMode: "overlay",
                  }}
                />

                {/* Depth enhancement overlay */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `
                    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15) 0%, transparent 60%),
                    linear-gradient(135deg, transparent 0%, rgba(0, 0, 0, 0.15) 100%)
                  `,
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                  }}
                />

                {/* Text visibility enhancement */}
                <div className="from-background/5 to-background/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent" />

                {/* Hover overlay with country info */}
                <motion.div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/70 opacity-0 transition-opacity duration-300 hover:opacity-100"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="px-1 text-center text-xs font-medium text-white">
                    {item.country.name}
                  </div>
                  <div className="text-center text-xs text-white/80">
                    {item.country.economicTier}
                  </div>
                  {isCurrentlyChanging && (
                    <div className="mt-1 text-xs font-bold text-blue-300">NEW</div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Progressive Change Indicator */}
      {isHovered && (
        <motion.div
          className="absolute top-2 right-2 flex items-center gap-2 rounded-lg bg-black/30 px-3 py-2 text-xs text-white/70 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.9, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          style={{
            backdropFilter: "blur(12px) saturate(140%)",
            WebkitBackdropFilter: "blur(12px) saturate(140%)",
          }}
        >
          <motion.div
            className="h-2 w-2 rounded-full bg-blue-400"
            animate={{
              scale: currentlyChanging !== null ? [1, 1.5, 1] : 1,
              opacity: currentlyChanging !== null ? [0.5, 1, 0.5] : 1,
            }}
            transition={{
              duration: 0.6,
              repeat: currentlyChanging !== null ? Infinity : 0,
              ease: "easeInOut",
            }}
          />
          <div className="flex flex-col">
            <span className="text-white/80">
              {currentlyChanging !== null
                ? "Changing flag..."
                : `${hoverDuration}s - Next in ${1 - (hoverDuration % 1)}s`}
            </span>
            {hoverDuration > 0 && (
              <div className="mt-1 flex gap-1">
                {Array.from({ length: Math.min(hoverDuration, 8) }, (_, i) => (
                  <div
                    key={i}
                    className="h-1 w-1 rounded-full bg-blue-400 opacity-60"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Instructions when not hovered */}
      {!isHovered && (
        <motion.div
          className="absolute top-2 right-2 rounded bg-black/20 px-2 py-1 text-xs text-white/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            backdropFilter: "blur(8px) saturate(120%)",
            WebkitBackdropFilter: "blur(8px) saturate(120%)",
          }}
        >
          Hover to change flags
        </motion.div>
      )}

      {/* Stats indicator */}
      <motion.div
        className="absolute bottom-2 left-2 font-mono text-xs text-white/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {flagGrid.length} flags • {countries.length} nations
      </motion.div>
    </div>
  );
};

export default RandomFlagGrid;
