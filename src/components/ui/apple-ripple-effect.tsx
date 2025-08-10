"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';

interface AppleRippleEffectProps {
  className?: string;
  isActive: boolean;
  onComplete?: () => void;
  children?: React.ReactNode;
  direction?: 'left' | 'right' | 'center';
}

export const AppleRippleEffect: React.FC<AppleRippleEffectProps> = ({
  className,
  isActive,
  onComplete,
  children,
  direction = 'center'
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number }>>([]);

  useEffect(() => {
    if (isActive) {
      // Create ripple waves based on motion.dev examples
      const rippleIds = [Date.now(), Date.now() + 1, Date.now() + 2];
      setRipples(rippleIds.map(id => ({ id })));

      // Complete callback - much faster for Apple-like responsiveness
      if (onComplete) {
        setTimeout(onComplete, 400);
      }

      // Cleanup ripples - faster cleanup
      setTimeout(() => {
        setRipples([]);
      }, 600);
    }
  }, [isActive, onComplete]);

  const getOriginPoint = () => {
    switch (direction) {
      case 'left': return { x: 0, y: 50 };
      case 'right': return { x: 100, y: 50 };
      default: return { x: 50, y: 50 };
    }
  };

  const origin = getOriginPoint();

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {children}
      
      {/* Apple Intelligence Ripple Effect */}
      <AnimatePresence>
        {isActive && ripples.map((ripple, index) => (
          <motion.div
            key={ripple.id}
            className="absolute pointer-events-none"
            style={{
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ 
              scale: 0,
              opacity: 0.6
            }}
            animate={{ 
              scale: [0, 2.5, 4],
              opacity: [0.8, 0.4, 0]
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.1, 0.25, 1],
              delay: index * 0.05,
              times: [0, 0.6, 1]
            }}
          >
            {/* Ripple Ring */}
            <div 
              className="w-32 h-32 rounded-full border border-blue-400/50"
              style={{
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%)',
                boxShadow: '0 0 24px rgba(59, 130, 246, 0.2)',
                backdropFilter: 'blur(1px)',
                WebkitBackdropFilter: 'blur(1px)'
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Shimmer Effect */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(${direction === 'right' ? '90deg' : direction === 'left' ? '270deg' : '45deg'}, 
                  transparent 0%, 
                  rgba(59, 130, 246, 0.1) 30%, 
                  rgba(59, 130, 246, 0.2) 50%, 
                  rgba(59, 130, 246, 0.1) 70%, 
                  transparent 100%)`,
              }}
              animate={direction === 'right' ? { 
                x: ['-100%', '100%'] 
              } : direction === 'left' ? {
                x: ['100%', '-100%'] 
              } : {
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{ 
                duration: 0.4, 
                ease: [0.25, 0.1, 0.25, 1] 
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppleRippleEffect;