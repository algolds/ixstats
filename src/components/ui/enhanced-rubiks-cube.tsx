/**
 * Enhanced Rubik's Cube Component
 * 3D grid system with independent flag rotations and proper X/Y/Z depth
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleFlag } from '~/components/SimpleFlag';
import { cn } from '~/lib/utils';

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
}

interface FlagCube {
  id: string;
  country: CountryData;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

interface EnhancedRubiksCubeProps {
  countries: CountryData[];
  className?: string;
  gridSize?: number;
  animationSpeed?: number;
}

export const EnhancedRubiksCube: React.FC<EnhancedRubiksCubeProps> = ({
  countries,
  className,
  gridSize = 3,
  animationSpeed = 3500
}) => {
  const [cubes, setCubes] = useState<FlagCube[]>([]);
  const [globalRotation, setGlobalRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize cube grid
  useEffect(() => {
    if (countries.length === 0) return;

    const totalCubes = gridSize * gridSize * gridSize;
    const shuffledCountries = [...countries].sort(() => Math.random() - 0.5);
    
    const newCubes: FlagCube[] = [];
    
    for (let i = 0; i < totalCubes; i++) {
      const x = (i % gridSize) - Math.floor(gridSize / 2);
      const y = Math.floor(i / gridSize) % gridSize - Math.floor(gridSize / 2);
      const z = Math.floor(i / (gridSize * gridSize)) - Math.floor(gridSize / 2);
      
      newCubes.push({
        id: `cube-${i}`,
        country: shuffledCountries[i % shuffledCountries.length],
        position: { x: x * 120, y: y * 120, z: z * 120 },
        rotation: { 
          x: Math.random() * 360, 
          y: Math.random() * 360, 
          z: Math.random() * 360 
        }
      });
    }
    
    setCubes(newCubes);
  }, [countries, gridSize]);

  // Animation cycle
  useEffect(() => {
    const interval = setInterval(() => {
      if (countries.length === 0) return;

      setIsAnimating(true);

      // Global cube rotation
      setGlobalRotation(prev => ({
        x: prev.x + (Math.random() * 60 - 30),
        y: prev.y + (Math.random() * 90 - 45),
        z: prev.z + (Math.random() * 30 - 15)
      }));

      // Individual cube animations and country swaps
      setCubes(prevCubes => 
        prevCubes.map(cube => {
          const shouldSwap = Math.random() < 0.3; // 30% chance to swap country
          const shouldRotate = Math.random() < 0.7; // 70% chance to rotate
          
          return {
            ...cube,
            country: shouldSwap ? 
              countries[Math.floor(Math.random() * countries.length)] : 
              cube.country,
            rotation: shouldRotate ? {
              x: cube.rotation.x + (Math.random() * 180 - 90),
              y: cube.rotation.y + (Math.random() * 180 - 90),
              z: cube.rotation.z + (Math.random() * 90 - 45)
            } : cube.rotation
          };
        })
      );

      setTimeout(() => setIsAnimating(false), 1000);
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [countries, animationSpeed]);

  const containerVariants = {
    idle: {
      rotateX: globalRotation.x,
      rotateY: globalRotation.y,
      rotateZ: globalRotation.z,
    },
    animating: {
      rotateX: globalRotation.x,
      rotateY: globalRotation.y,
      rotateZ: globalRotation.z,
      scale: 1.05,
    }
  };

  const cubeVariants = {
    idle: (custom: FlagCube) => ({
      x: custom.position.x,
      y: custom.position.y,
      z: custom.position.z,
      rotateX: custom.rotation.x,
      rotateY: custom.rotation.y,
      rotateZ: custom.rotation.z,
      scale: 1,
    }),
    animating: (custom: FlagCube) => ({
      x: custom.position.x,
      y: custom.position.y,
      z: custom.position.z,
      rotateX: custom.rotation.x,
      rotateY: custom.rotation.y,
      rotateZ: custom.rotation.z,
      scale: Math.random() < 0.3 ? 1.2 : 1,
    }),
    hover: {
      scale: 1.3,
      rotateY: 180,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  if (cubes.length === 0) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <div className="text-muted-foreground text-sm">Initializing cube...</div>
      </div>
    );
  }

  return (
    <div 
      className={cn("w-full h-full relative overflow-hidden", className)}
      style={{ perspective: '1200px' }}
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        variants={containerVariants}
        animate={isAnimating ? "animating" : "idle"}
        transition={{
          duration: 1.2,
          ease: "easeInOut"
        }}
        style={{
          transformStyle: "preserve-3d"
        }}
      >
        <div 
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            width: `${gridSize * 120}px`,
            height: `${gridSize * 120}px`
          }}
        >
          <AnimatePresence mode="wait">
            {cubes.map((cube) => (
              <motion.div
                key={`${cube.id}-${cube.country.id}`}
                className="absolute"
                custom={cube}
                variants={cubeVariants as any}
                animate={isAnimating ? "animating" : "idle"}
                whileHover="hover"
                transition={{
                  duration: 1,
                  ease: "easeInOut",
                  delay: Math.random() * 0.3
                }}
                style={{
                  transformStyle: "preserve-3d",
                  width: '80px',
                  height: '80px',
                  left: '50%',
                  top: '50%',
                  marginLeft: '-40px',
                  marginTop: '-40px'
                }}
              >
                {/* Cube faces */}
                <div className="absolute inset-0 preserve-3d">
                  {/* Front face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'translateZ(40px)',
                      background: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-80"
                      showPlaceholder={true}
                    />
                  </div>
                  
                  {/* Back face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'translateZ(-40px) rotateY(180deg)',
                      background: 'rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-60"
                      showPlaceholder={true}
                    />
                  </div>
                  
                  {/* Right face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'rotateY(90deg) translateZ(40px)',
                      background: 'rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-70"
                      showPlaceholder={true}
                    />
                  </div>
                  
                  {/* Left face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'rotateY(-90deg) translateZ(40px)',
                      background: 'rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-70"
                      showPlaceholder={true}
                    />
                  </div>
                  
                  {/* Top face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'rotateX(90deg) translateZ(40px)',
                      background: 'rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-50"
                      showPlaceholder={true}
                    />
                  </div>
                  
                  {/* Bottom face */}
                  <div 
                    className="absolute inset-0 border border-white/20 rounded overflow-hidden backdrop-blur-sm"
                    style={{
                      transform: 'rotateX(-90deg) translateZ(40px)',
                      background: 'rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    <SimpleFlag
                      countryName={cube.country.name}
                      className="w-full h-full object-cover opacity-50"
                      showPlaceholder={true}
                    />
                  </div>
                </div>

                {/* Hover overlay with country info */}
                <motion.div
                  className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 rounded"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                >
                  <div className="text-white text-xs font-medium text-center px-1">
                    {cube.country.name}
                  </div>
                  <div className="text-white/80 text-xs text-center">
                    {cube.country.economicTier}
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Animation indicator */}
      {isAnimating && (
        <motion.div
          className="absolute top-3 right-3 flex items-center gap-2 text-white/60 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-2 h-2 bg-blue-400 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <span>Cube rotating</span>
        </motion.div>
      )}

      {/* Performance stats */}
      <motion.div
        className="absolute bottom-3 left-3 text-white/50 text-xs font-mono"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {cubes.length} cubes • {countries.length} nations
      </motion.div>
    </div>
  );
};

export default EnhancedRubiksCube;