"use client";

import React from 'react';

/**
 * Mobile Optimization Styles and Enhancements
 * 
 * This component provides mobile-specific optimizations including:
 * - Touch-friendly interactions
 * - Performance enhancements
 * - Responsive design utilities
 */

// Mobile-specific CSS injected as a component
export function MobileOptimizationStyles() {
  React.useEffect(() => {
    // Inject mobile-specific styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      /* Mobile Optimization Styles */
      .mobile-optimized {
        /* Touch improvements */
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .touch-manipulation {
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0,0,0,0);
      }

      /* Mobile-friendly button sizes */
      @media (max-width: 768px) {
        .mobile-optimized button {
          min-height: 44px;
          min-width: 44px;
          padding: 12px 16px;
        }

        .mobile-optimized .glass-hierarchy-child {
          border-radius: 12px;
        }

        .mobile-optimized .glass-hierarchy-parent {
          border-radius: 16px;
        }

        /* Improved scroll performance */
        .mobile-optimized .overflow-y-auto {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }

        /* Better touch targets */
        .mobile-optimized [role="button"],
        .mobile-optimized button,
        .mobile-optimized .cursor-pointer {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Reduce motion for battery life */
        .mobile-optimized * {
          animation-duration: 0.2s !important;
          animation-delay: 0s !important;
          transition-duration: 0.2s !important;
        }

        /* Optimize grid layouts for mobile */
        .mobile-optimized .grid {
          gap: 1rem;
        }

        /* Better text readability */
        .mobile-optimized {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Improve focus visibility */
        .mobile-optimized *:focus {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
        }

        /* Safe area adjustments for notch devices */
        .mobile-optimized {
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }

        .mobile-header {
          padding-top: env(safe-area-inset-top);
        }
      }

      /* Tablet-specific optimizations */
      @media (min-width: 768px) and (max-width: 1024px) {
        .mobile-optimized .grid-cols-1 {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      /* High DPI displays */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .mobile-optimized {
          /* Sharper borders and shadows */
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
        }
      }

      /* Reduce motion for users who prefer it */
      @media (prefers-reduced-motion: reduce) {
        .mobile-optimized *,
        .mobile-optimized *::before,
        .mobile-optimized *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }

      /* Dark mode optimizations for mobile */
      @media (prefers-color-scheme: dark) {
        .mobile-optimized {
          /* Better contrast ratios */
          --glass-opacity: 0.1;
        }
      }

      /* Battery optimization */
      @media (max-width: 768px) {
        .mobile-optimized .glass-hierarchy-parent {
          /* Reduce blur effects on mobile */
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
        }
      }
    `;
    
    document.head.appendChild(styleSheet);
    
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  return null; // This component only injects styles
}

// Touch gesture detection hook
export function useTouchGestures() {
  const [touchState, setTouchState] = React.useState({
    isTouch: false,
    swipeDirection: null as 'left' | 'right' | 'up' | 'down' | null,
    tapCount: 0
  });

  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tapTimeout: NodeJS.Timeout;

    const handleTouchStart = (e: TouchEvent) => {
      const firstTouch = e.touches[0];
      if (firstTouch) {
        startX = firstTouch.clientX;
        startY = firstTouch.clientY;
        setTouchState(prev => ({ ...prev, isTouch: true }));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const lastTouch = e.changedTouches[0];
      if (!lastTouch) return;
      const endX = lastTouch.clientX;
      const endY = lastTouch.clientY;
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const minSwipeDistance = 50;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        setTouchState(prev => ({
          ...prev,
          swipeDirection: deltaX > 0 ? 'right' : 'left'
        }));
      } else if (Math.abs(deltaY) > minSwipeDistance) {
        setTouchState(prev => ({
          ...prev,
          swipeDirection: deltaY > 0 ? 'down' : 'up'
        }));
      } else {
        // Single tap
        setTouchState(prev => ({ ...prev, tapCount: prev.tapCount + 1 }));
        clearTimeout(tapTimeout);
        tapTimeout = setTimeout(() => {
          setTouchState(prev => ({ ...prev, tapCount: 0 }));
        }, 300);
      }

      // Reset swipe direction after a delay
      setTimeout(() => {
        setTouchState(prev => ({ ...prev, swipeDirection: null }));
      }, 100);
    };

    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      clearTimeout(tapTimeout);
    };
  }, []);

  return touchState;
}

// Performance optimization hook for mobile
export function useMobilePerformance() {
  const [performanceState, setPerformanceState] = React.useState({
    reducedMotion: false,
    lowBattery: false,
    slowConnection: false
  });

  React.useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check for battery status (if supported)
    const checkBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          const isLowBattery = battery.level < 0.2 && !battery.charging;
          setPerformanceState(prev => ({ ...prev, lowBattery: isLowBattery }));
        } catch (error) {
          // Battery API not supported or failed
        }
      }
    };

    // Check for slow connection
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const slowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');

    setPerformanceState({
      reducedMotion: prefersReducedMotion,
      lowBattery: false,
      slowConnection: slowConnection || false
    });

    checkBattery();
  }, []);

  return performanceState;
}

// Mobile-specific component wrapper
interface MobileOptimizedProps {
  children: React.ReactNode;
  enableTouchGestures?: boolean;
  className?: string;
}

export function MobileOptimized({ 
  children, 
  enableTouchGestures = true, 
  className = '' 
}: MobileOptimizedProps) {
  const touchState = enableTouchGestures ? useTouchGestures() : null;
  const performance = useMobilePerformance();

  return (
    <>
      <MobileOptimizationStyles />
      <div 
        className={`mobile-optimized ${className} ${performance.reducedMotion ? 'reduce-motion' : ''}`}
        data-touch-enabled={touchState?.isTouch}
        data-swipe-direction={touchState?.swipeDirection}
      >
        {children}
      </div>
    </>
  );
}