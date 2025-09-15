/**
 * Fabric Ripple Flag Component
 * Hover-triggered cloth physics simulation with realistic ripple effects
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleFlag } from '~/components/SimpleFlag';

interface WavingFlagProps {
  countryName: string;
  className?: string;
  showPlaceholder?: boolean;
  intensity?: 'calm' | 'moderate' | 'strong';
  polePosition?: 'left' | 'right';
}

export const WavingFlag: React.FC<WavingFlagProps> = ({
  countryName,
  className = "",
  showPlaceholder = true,
  intensity = 'moderate',
  polePosition = 'left'
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Apple-level subtle intensity settings
  const settings = {
    calm: { rippleStrength: 2, duration: 2.0 },
    moderate: { rippleStrength: 3, duration: 1.8 },
    strong: { rippleStrength: 4, duration: 1.5 }
  };

  const { rippleStrength, duration } = settings[intensity];

  // Apple-inspired fabric ripple variants - extremely subtle
  const fabricVariants = {
    rest: {
      rotateY: 0,
      rotateX: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      x: 0,
      y: 0,
      transition: {
        duration: 1.2,
        ease: [0.25, 0.1, 0.25, 1] // Apple's preferred cubic bezier
      }
    },
    ripple: {
      // Ultra-subtle multi-stage ripple - Apple style
      rotateY: [0, rippleStrength * 0.8, -rippleStrength * 0.3, rippleStrength * 0.2, 0],
      rotateX: [0, -rippleStrength * 0.4, rippleStrength * 0.6, -rippleStrength * 0.2, 0],
      scaleX: [1, 1 + rippleStrength * 0.003, 1 - rippleStrength * 0.002, 1 + rippleStrength * 0.001, 1],
      scaleY: [1, 1 - rippleStrength * 0.002, 1 + rippleStrength * 0.004, 1 - rippleStrength * 0.001, 1],
      skewX: [0, rippleStrength * 0.6, -rippleStrength * 0.4, rippleStrength * 0.2, 0],
      x: [0, rippleStrength * 0.8, -rippleStrength * 0.3, rippleStrength * 0.15, 0],
      y: [0, -rippleStrength * 0.4, rippleStrength * 0.6, -rippleStrength * 0.2, 0],
      transition: {
        duration: duration,
        ease: [0.25, 0.1, 0.25, 1], // Apple's signature easing
        times: [0, 0.25, 0.55, 0.8, 1] // More refined timing
      }
    }
  } as const;

  return (
    <div 
      className={`relative overflow-hidden cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Pole indicator */}
      <div 
        className={`absolute top-0 bottom-0 w-0.5 bg-gray-700/40 z-10 ${
          polePosition === 'left' ? 'left-0' : 'right-0'
        }`}
      />

      {/* Main flag with fabric physics */}
      <motion.div
        className="relative w-full h-full"
        style={{
          transformOrigin: polePosition === 'left' ? '0% 50%' : '100% 50%',
          perspective: '1000px',
        }}
        variants={fabricVariants}
        animate={isHovered ? 'ripple' : 'rest'}
      >
        {/* Base flag layer */}
        <div className="relative w-full h-full">
          <SimpleFlag 
            countryName={countryName}
            className="w-full h-full object-cover"
            showPlaceholder={showPlaceholder}
          />
          
          {/* Ultra-subtle fabric depth shadows - Apple style */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.15, 0.08, 0.12, 0],
                  background: [
                    'linear-gradient(130deg, transparent 0%, rgba(0,0,0,0.03) 35%, transparent 65%)',
                    'linear-gradient(160deg, transparent 10%, rgba(0,0,0,0.04) 45%, transparent 80%)',
                    'linear-gradient(70deg, transparent 5%, rgba(0,0,0,0.025) 40%, transparent 75%)',
                    'linear-gradient(110deg, transparent 15%, rgba(0,0,0,0.035) 50%, transparent 85%)',
                    'transparent'
                  ]
                }}
                exit={{ 
                  opacity: 0,
                  transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }
                }}
                transition={{ 
                  duration: duration,
                  ease: [0.25, 0.1, 0.25, 1],
                  times: [0, 0.3, 0.6, 0.85, 1]
                }}
              />
            )}
          </AnimatePresence>

          {/* Refined fabric highlights - barely perceptible */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.25, 0.12, 0.18, 0],
                  background: [
                    'radial-gradient(ellipse 50% 70% at 25% 35%, rgba(255,255,255,0.08) 0%, transparent 60%)',
                    'radial-gradient(ellipse 60% 75% at 65% 65%, rgba(255,255,255,0.06) 0%, transparent 65%)',
                    'radial-gradient(ellipse 45% 60% at 75% 45%, rgba(255,255,255,0.1) 0%, transparent 55%)',
                    'radial-gradient(ellipse 55% 65% at 35% 75%, rgba(255,255,255,0.07) 0%, transparent 60%)',
                    'transparent'
                  ]
                }}
                exit={{ 
                  opacity: 0,
                  transition: { duration: 1.0, ease: [0.25, 0.1, 0.25, 1] }
                }}
                transition={{ 
                  duration: duration * 1.2,
                  ease: [0.25, 0.1, 0.25, 1],
                  times: [0, 0.2, 0.5, 0.75, 1]
                }}
              />
            )}
          </AnimatePresence>

          {/* Barely-there fabric texture - Apple subtlety */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-8 mix-blend-soft-light"
            style={{
              background: `
                repeating-linear-gradient(
                  0deg,
                  rgba(255,255,255,0.04) 0px,
                  transparent 1px,
                  transparent 3px,
                  rgba(0,0,0,0.02) 4px
                ),
                repeating-linear-gradient(
                  90deg,
                  rgba(255,255,255,0.03) 0px,
                  transparent 2px,
                  transparent 4px,
                  rgba(0,0,0,0.015) 5px
                )
              `
            }}
          />
        </div>
      </motion.div>

      {/* Ultra-subtle pole attachment shadow - Apple refinement */}
      <motion.div 
        className={`absolute top-0 bottom-0 w-3 bg-gradient-to-r pointer-events-none ${
          polePosition === 'left' 
            ? 'left-0 from-black/12 to-transparent' 
            : 'right-0 from-transparent to-black/12'
        }`}
        animate={{
          opacity: isHovered ? [1, 1.3, 1.1, 1.2, 1] : 1
        }}
        transition={{
          duration: isHovered ? duration : 1.2,
          ease: [0.25, 0.1, 0.25, 1]
        }}
      />
    </div>
  );
};

export default WavingFlag;