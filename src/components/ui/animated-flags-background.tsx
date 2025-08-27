"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SimpleFlag } from "~/components/SimpleFlag";
import { unifiedFlagService } from "~/lib/unified-flag-service";

interface AnimatedFlagsBackgroundProps {
  countries: Array<{ id: string; name: string }>;
  maxFlags?: number;
  className?: string;
}

interface FlagItem {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  direction: number;
}

interface FlagSet {
  countries: Array<{ id: string; name: string }>;
  setIndex: number;
}

interface SessionFlagData {
  allSets: FlagSet[];
  currentSetIndex: number;
  timestamp: number;
}

// Session storage key
const SESSION_KEY = 'ixstats-animated-flags';
const TOTAL_FLAGS = 24;
const SETS_COUNT = 4;

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// Generate flag sets for session
function generateFlagSets(countries: Array<{ id: string; name: string }>): FlagSet[] {
  if (countries.length < TOTAL_FLAGS) {
    // If we don't have enough countries, repeat the list
    const repeatedCountries = [];
    while (repeatedCountries.length < TOTAL_FLAGS) {
      repeatedCountries.push(...countries.slice(0, Math.min(countries.length, TOTAL_FLAGS - repeatedCountries.length)));
    }
    countries = repeatedCountries;
  }
  
  // Shuffle and take 24 countries
  const shuffledCountries = shuffleArray(countries).slice(0, TOTAL_FLAGS);
  
  // Split into 4 sets of 6
  const sets: FlagSet[] = [];
  for (let i = 0; i < SETS_COUNT; i++) {
    const setCountries = shuffledCountries.slice(i * 6, (i + 1) * 6);
    sets.push({
      countries: setCountries,
      setIndex: i
    });
  }
  
  return sets;
}

// Get or create session flag data
function getSessionFlagData(countries: Array<{ id: string; name: string }>): SessionFlagData {
  if (typeof window === 'undefined') {
    // Server-side: return default data
    return {
      allSets: generateFlagSets(countries),
      currentSetIndex: 0,
      timestamp: Date.now()
    };
  }
  
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const data: SessionFlagData = JSON.parse(stored);
      // Validate that we have the right structure
      if (data.allSets && data.allSets.length === SETS_COUNT && 
          data.allSets.every(set => set.countries.length <= 6)) {
        
        // Increment set index on each page visit/component mount
        const nextSetIndex = (data.currentSetIndex + 1) % SETS_COUNT;
        const updatedData = {
          ...data,
          currentSetIndex: nextSetIndex,
          timestamp: Date.now()
        };
        
        // Save the updated index
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedData));
        } catch (error) {
          console.warn('Failed to save updated flag data:', error);
        }
        
        return updatedData;
      }
    }
  } catch (error) {
    console.warn('Failed to load flag data from session storage:', error);
  }
  
  // Generate new data
  const newData: SessionFlagData = {
    allSets: generateFlagSets(countries),
    currentSetIndex: 0,
    timestamp: Date.now()
  };
  
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newData));
  } catch (error) {
    console.warn('Failed to save flag data to session storage:', error);
  }
  
  return newData;
}

// Save session flag data
function saveSessionFlagData(data: SessionFlagData): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save flag data to session storage:', error);
  }
}

// Preload flags using simple flag service
async function preloadFlagSet(countries: Array<{ id: string; name: string }>): Promise<void> {
  const countryNames = countries.map(c => c.name);
  
  try {
    // Preload flags individually
    await Promise.allSettled(
      countryNames.map(name => unifiedFlagService.getFlagUrl(name))
    );
  } catch (err) {
    console.warn(`Failed to preload flags:`, err);
  }
}

export function AnimatedFlagsBackground({ 
  countries, 
  maxFlags = 6, // Now this represents flags per set
  className = ""
}: AnimatedFlagsBackgroundProps) {
  // Initialize session data and get current set index
  const [sessionData] = useState<SessionFlagData>(() => {
    return getSessionFlagData(countries);
  });
  const [isPreloaded, setIsPreloaded] = useState(false);
  
  // Preload all flag sets on mount
  useEffect(() => {
    const preloadAllSets = async () => {
      const allCountries = sessionData.allSets.flatMap(set => set.countries);
      await preloadFlagSet(allCountries);
      setIsPreloaded(true);
    };
    
    preloadAllSets();
  }, [sessionData]);
  
  // Remove real-time cycling - flags only change when page is revisited
  // The currentSetIndex will only change when the component re-mounts
  
  // Get current set of countries to display
  const currentCountries = useMemo(() => {
    if (!sessionData.allSets[sessionData.currentSetIndex]) {
      return [];
    }
    return sessionData.allSets[sessionData.currentSetIndex]?.countries.slice(0, maxFlags) || [];
  }, [sessionData, maxFlags]);
  
  // Memoize the flag positions and animations to prevent recalculation
  const flagItems = useMemo<FlagItem[]>(() => {
    if (!currentCountries.length) return [];

    const selectedCountries = currentCountries;
    
    return selectedCountries.map((country, index) => {
      // Create pseudo-random but deterministic positions based on country name and set
      const hash = (country.name + sessionData.currentSetIndex).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const seed1 = (hash * 9301 + 49297) % 233280;
      const seed2 = (hash * 1231 + 1337) % 233280;
      const seed3 = (hash * 4567 + 7890) % 233280;
      
      return {
        id: country.id,
        name: country.name,
        x: (seed1 / 233280) * 100,
        y: (seed2 / 233280) * 100,
        size: 36 + ((seed3 / 233280) * 24), // 36-60px (larger flags)
        opacity: 0.12 + ((seed1 / 233280) * 0.15), // 0.12-0.27 opacity (more visible)
        duration: 20 + ((seed2 / 233280) * 30), // 20-50s duration (slower, gentler)
        delay: (seed3 / 233280) * 15, // 0-15s delay (more staggered)
        direction: seed1 % 2 === 0 ? 1 : -1, // Alternate directions
      };
    });
  }, [currentCountries, sessionData.currentSetIndex]);
  
  // Memoize the individual flag component to prevent unnecessary re-renders
  const FlagComponent = useCallback(({ flag, index, setKey }: { flag: FlagItem; index: number; setKey: string }) => {
    // Create unique motion values for each flag
    const floatVariants = {
      animate: {
        y: [0, flag.direction > 0 ? -12 : 8, -2, flag.direction > 0 ? -8 : 12, 0],
        x: [0, 3, -2, 1, 0],
        rotate: [(index % 5) * 6 - 12, (index % 5) * 6 - 8, (index % 5) * 6 - 16, (index % 5) * 6 - 12],
        transition: {
          duration: flag.duration,
          ease: [0.4, 0.0, 0.2, 1],
          repeat: Infinity,
          delay: flag.delay,
        }
      }
    };

    const pulseVariants = {
      animate: {
        opacity: [flag.opacity * 0.8, flag.opacity * 1.2, flag.opacity * 0.9, flag.opacity],
        scale: [1, 1.02, 0.98, 1],
        transition: {
          duration: flag.duration * 0.7,
          ease: [0.4, 0.0, 0.2, 1], 
          repeat: Infinity,
          delay: flag.delay + 1,
        }
      }
    };
    
    return (
      <motion.div
        key={`${setKey}-${flag.id}-${index}`}
        className="absolute pointer-events-none"
        style={{
          left: `${flag.x}%`,
          top: `${flag.y}%`,
          width: `${flag.size}px`,
          height: `${flag.size * 0.67}px`, // Maintain flag ratio
        }}
        variants={floatVariants}
        animate="animate"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: flag.opacity }}
        viewport={{ once: false }}
      >
        <motion.div 
          className="w-full h-full backdrop-blur-[1px] bg-white/5 rounded-sm border border-white/10 overflow-hidden hover:bg-white/10 transition-all duration-1000"
          variants={pulseVariants}
          animate="animate"
        >
          <SimpleFlag 
            countryName={flag.name}
            className="w-full h-full object-cover filter blur-[0.5px]"
            showPlaceholder={true}
          />
        </motion.div>
      </motion.div>
    );
  }, []);

  if (!flagItems.length) {
    return null;
  }

  // Create a unique key for this set to help with transitions
  const setKey = `set-${sessionData.currentSetIndex}`;

  return (
      <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
        {flagItems.map((flag, index) => (
          <FlagComponent key={`flag-${flag.id}-${sessionData.currentSetIndex}`} flag={flag} index={index} setKey={setKey} />
        ))}
        
        {/* Gradient overlay to fade edges */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-black/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/5" />
      </div>
  );
}

export default AnimatedFlagsBackground;