"use client";

import React, {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useWillChange } from "motion/react";

// Spring physics — Apple-style morph: crisp snap with weighted settle
const stiffness = 450;
const damping = 32;
const mass = 0.8; // lighter mass = faster acceleration into target shape
const MAX_HEIGHT_MOBILE_ULTRA = 400;
const MAX_HEIGHT_MOBILE_MASSIVE = 700;

// Performance optimization constants
const RESIZE_DEBOUNCE_MS = 100;
const ANIMATION_DURATION_MS = 250; // ≤250ms feels instantaneous

export type SizePresets =
  | "reset"
  | "empty"
  | "default"
  | "compact"
  | "compactLong"
  | "compactTall"
  | "large"
  | "long"
  | "minimalLeading"
  | "minimalTrailing"
  | "compactMedium"
  | "medium"
  | "tall"
  | "ultra"
  | "massive"
  | "extraWide"
  | "fullWidth"
  | "wikiInline"
  | "wikiCompact";

const SIZE_PRESETS = {
  RESET: "reset",
  EMPTY: "empty",
  DEFAULT: "default",
  COMPACT: "compact",
  COMPACT_LONG: "compactLong",
  COMPACT_TALL: "compactTall",
  LARGE: "large",
  LONG: "long",
  MINIMAL_LEADING: "minimalLeading",
  MINIMAL_TRAILING: "minimalTrailing",
  COMPACT_MEDIUM: "compactMedium",
  MEDIUM: "medium",
  TALL: "tall",
  ULTRA: "ultra",
  MASSIVE: "massive",
  EXTRA_WIDE: "extraWide",
  FULL_WIDTH: "fullWidth",
  WIKI_INLINE: "wikiInline",
  WIKI_COMPACT: "wikiCompact",
} as const;

type Preset = {
  width: number;
  height?: number;
  aspectRatio: number;
  borderRadius: number;
};

const DynamicIslandSizePresets: Record<SizePresets, Preset> = {
  [SIZE_PRESETS.RESET]: {
    width: 150,
    aspectRatio: 1,
    borderRadius: 20,
  },
  [SIZE_PRESETS.EMPTY]: {
    width: 0,
    aspectRatio: 0,
    borderRadius: 0,
  },
  [SIZE_PRESETS.DEFAULT]: {
    width: 150,
    aspectRatio: 44 / 150,
    borderRadius: 46,
  },
  [SIZE_PRESETS.MINIMAL_LEADING]: {
    width: 52.33,
    aspectRatio: 44 / 52.33,
    borderRadius: 22,
  },
  [SIZE_PRESETS.MINIMAL_TRAILING]: {
    width: 52.33,
    aspectRatio: 44 / 52.33,
    borderRadius: 22,
  },
  [SIZE_PRESETS.COMPACT]: {
    width: 240,
    height: 40,
    aspectRatio: 40 / 240,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.COMPACT_LONG]: {
    width: 300,
    height: 44,
    aspectRatio: 44 / 300,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.COMPACT_TALL]: {
    width: 340,
    height: 44,
    aspectRatio: 44 / 340,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.COMPACT_MEDIUM]: {
    width: 351,
    aspectRatio: 44 / 351,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.LONG]: {
    width: 371,
    aspectRatio: 84 / 371,
    borderRadius: 42,
  },
  [SIZE_PRESETS.MEDIUM]: {
    width: 371,
    aspectRatio: 210 / 371,
    borderRadius: 22,
  },
  [SIZE_PRESETS.LARGE]: {
    width: 371,
    aspectRatio: 84 / 371,
    borderRadius: 42,
  },
  [SIZE_PRESETS.TALL]: {
    width: 371,
    aspectRatio: 210 / 371,
    borderRadius: 42,
  },
  [SIZE_PRESETS.ULTRA]: {
    width: 630,
    aspectRatio: 630 / 800,
    borderRadius: 42,
  },
  [SIZE_PRESETS.MASSIVE]: {
    width: 891,
    height: 1900,
    aspectRatio: 891 / 891,
    borderRadius: 42,
  },
  [SIZE_PRESETS.EXTRA_WIDE]: {
    width: 1200,
    aspectRatio: 64 / 1200,
    borderRadius: 32,
  },
  [SIZE_PRESETS.FULL_WIDTH]: {
    width: 1400,
    aspectRatio: 80 / 1400,
    borderRadius: 28,
  },
  [SIZE_PRESETS.WIKI_INLINE]: {
    width: 260,
    height: 44,
    aspectRatio: 44 / 260,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.WIKI_COMPACT]: {
    width: 180,
    height: 40,
    aspectRatio: 40 / 180,
    borderRadius: 9999,
  },
};

type BlobStateType = {
  size: SizePresets;
  previousSize: SizePresets | undefined;
  animationQueue: Array<{ size: SizePresets; delay: number }>;
  isAnimating: boolean;
};

type BlobAction =
  | { type: "SET_SIZE"; newSize: SizePresets }
  | { type: "INITIALIZE"; firstState: SizePresets }
  | {
      type: "SCHEDULE_ANIMATION";
      animationSteps: Array<{ size: SizePresets; delay: number }>;
    }
  | { type: "ANIMATION_END" };

type BlobContextType = {
  state: BlobStateType;
  dispatch: React.Dispatch<BlobAction>;
  setSize: (size: SizePresets) => void;
  scheduleAnimation: (animationSteps: Array<{ size: SizePresets; delay: number }>) => void;
  presets: Record<SizePresets, Preset>;
};

const BlobContext = createContext<BlobContextType | undefined>(undefined);

const blobReducer = (state: BlobStateType, action: BlobAction): BlobStateType => {
  switch (action.type) {
    case "SET_SIZE":
      return {
        ...state,
        size: action.newSize,
        previousSize: state.size,
        isAnimating: false, // Only set isAnimating to true if there are more steps
      };
    case "SCHEDULE_ANIMATION":
      return {
        ...state,
        animationQueue: action.animationSteps,
        isAnimating: action.animationSteps.length > 0,
      };
    case "INITIALIZE":
      return {
        ...state,
        size: action.firstState,
        previousSize: SIZE_PRESETS.EMPTY,
        isAnimating: false,
      };
    case "ANIMATION_END":
      return {
        ...state,
        isAnimating: false,
      };
    default:
      return state;
  }
};

interface DynamicIslandProviderProps {
  children: React.ReactNode;
  initialSize?: SizePresets;
  initialAnimation?: Array<{ size: SizePresets; delay: number }>;
}

const DynamicIslandProvider: React.FC<DynamicIslandProviderProps> = ({
  children,
  initialSize = SIZE_PRESETS.DEFAULT,
  initialAnimation = [],
}) => {
  const initialState: BlobStateType = {
    size: initialSize,
    previousSize: SIZE_PRESETS.EMPTY,
    animationQueue: initialAnimation,
    isAnimating: initialAnimation.length > 0,
  };

  const [state, dispatch] = useReducer(blobReducer, initialState);

  useEffect(() => {
    const processQueue = async () => {
      for (const step of state.animationQueue) {
        await new Promise((resolve) => setTimeout(resolve, step.delay));
        dispatch({ type: "SET_SIZE", newSize: step.size });
      }
      dispatch({ type: "ANIMATION_END" });
    };

    if (state.animationQueue.length > 0) {
      processQueue();
    }
  }, [state.animationQueue]);

  const setSize = useCallback(
    (newSize: SizePresets) => {
      if (newSize !== state.size) {
        dispatch({ type: "SET_SIZE", newSize });
      }
    },
    [state.size, dispatch]
  );

  const scheduleAnimation = useCallback(
    (animationSteps: Array<{ size: SizePresets; delay: number }>) => {
      dispatch({ type: "SCHEDULE_ANIMATION", animationSteps });
    },
    [dispatch]
  );

  const contextValue = {
    state,
    dispatch,
    setSize,
    scheduleAnimation,
    presets: DynamicIslandSizePresets,
  };

  return <BlobContext.Provider value={contextValue}>{children}</BlobContext.Provider>;
};

const useDynamicIslandSize = () => {
  const context = useContext(BlobContext);
  if (!context) {
    throw new Error("useDynamicIslandSize must be used within a DynamicIslandProvider");
  }
  return context;
};

const useScheduledAnimations = (animations: Array<{ size: SizePresets; delay: number }>) => {
  const { scheduleAnimation } = useDynamicIslandSize();
  const animationsRef = useRef(animations);

  useEffect(() => {
    scheduleAnimation(animationsRef.current);
  }, [scheduleAnimation]);
};

const DynamicIslandContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="z-[10000] flex h-full w-full items-center justify-center bg-transparent">
      {children}
    </div>
  );
};

const DynamicIsland = ({ children, id, ...props }: { children: ReactNode; id: string }) => {
  const willChange = useWillChange();
  const [screenSize, setScreenSize] = useState("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Ultra-fast resize handler with RAF optimization
    let resizeTimeout: NodeJS.Timeout;
    let rafId: number | undefined;
    let isResizing = false;

    const handleResize = () => {
      clearTimeout(resizeTimeout);

      if (!isResizing) {
        isResizing = true;
        rafId = requestAnimationFrame(() => {
          const width = window.innerWidth;
          const newSize = width <= 640 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
          if (screenSize !== newSize) {
            setScreenSize(newSize);
          }
          isResizing = false;
        });
      }

      // Fallback timeout for edge cases
      resizeTimeout = setTimeout(() => {
        if (isResizing) {
          const width = window.innerWidth;
          const newSize = width <= 640 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
          if (screenSize !== newSize) {
            setScreenSize(newSize);
          }
          isResizing = false;
        }
      }, RESIZE_DEBOUNCE_MS);
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      clearTimeout(resizeTimeout);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return (
      <DynamicIslandContainer>
        <div className="bg-card/95 border-border relative mx-auto h-11 items-center justify-center rounded-full px-4 text-center backdrop-blur-xl will-change-transform">
          {children}
        </div>
      </DynamicIslandContainer>
    );
  }

  return (
    <DynamicIslandContainer>
      <DynamicIslandContent id={id} willChange={willChange} screenSize={screenSize} {...props}>
        {children}
      </DynamicIslandContent>
    </DynamicIslandContainer>
  );
};

const calculateDimensions = (
  size: SizePresets,
  screenSize: string,
  currentSize: Preset | undefined
): { width: string; height: number | string } => {
  // Defensive fallback if preset is undefined
  const resolvedSize = currentSize ?? DynamicIslandSizePresets.default;

  const isMassiveOnMobile = size === "massive" && screenSize === "mobile";
  const isUltraOnMobile = size === "ultra" && screenSize === "mobile";
  const isWideOnMobile = (size === "extraWide" || size === "fullWidth") && screenSize === "mobile";
  const isWideOnTablet = (size === "extraWide" || size === "fullWidth") && screenSize === "tablet";

  if (isMassiveOnMobile) {
    return { width: "350px", height: MAX_HEIGHT_MOBILE_MASSIVE };
  }

  if (isUltraOnMobile) {
    return { width: "350px", height: MAX_HEIGHT_MOBILE_ULTRA };
  }

  if (isWideOnMobile) {
    // On mobile, use smaller width for wide layouts
    return { width: "95vw", height: 64 };
  }

  if (isWideOnTablet) {
    // On tablet, use most of the available width
    return { width: "90vw", height: 72 };
  }

  // For extra wide and full width on desktop, use responsive width
  if (size === "extraWide") {
    return { width: "min(1200px, 80vw)", height: 64 };
  }

  if (size === "fullWidth") {
    return { width: "min(1400px, 85vw)", height: 80 };
  }

  // For compact modes: both width AND height fit the content — pill wraps content
  if (
    size === "compact" ||
    size === "compactLong" ||
    size === "compactMedium" ||
    size === "compactTall" ||
    size === "wikiInline" ||
    size === "wikiCompact" ||
    size === "default" ||
    size === "reset"
  ) {
    return { width: "fit-content", height: "auto" };
  }

  // For other preset sizes, use the preset width directly without MIN_WIDTH restriction
  return {
    width: `${resolvedSize.width}px`,
    height: resolvedSize.aspectRatio * resolvedSize.width,
  };
};

const isCompactSize = (size: SizePresets | undefined): boolean => {
  if (!size) return true;
  return (
    size === "compact" ||
    size === "compactLong" ||
    size === "compactMedium" ||
    size === "compactTall" ||
    size === "minimalLeading" ||
    size === "minimalTrailing" ||
    size === "wikiCompact" ||
    size === "wikiInline" ||
    size === "default" ||
    size === "reset" ||
    size === "empty"
  );
};

const DynamicIslandContent = ({
  children,
  id,
  willChange,
  screenSize,
  ...props
}: {
  children: React.ReactNode;
  id: string;
  willChange: any;
  screenSize: string;
  [key: string]: any;
}) => {
  const { state, presets } = useDynamicIslandSize();
  const currentSize = presets[state.size] ?? DynamicIslandSizePresets.default;
  const isCompact = isCompactSize(state.size);

  const dimensions = calculateDimensions(state.size, screenSize, currentSize);

  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const checkPlayAs = () => {
      setIsImpersonating(!!localStorage.getItem("ixstats.play_as_user"));
    };
    checkPlayAs();
    window.addEventListener("storage", checkPlayAs);
    window.addEventListener("ixstats-play-as-change", checkPlayAs);
    return () => {
      window.removeEventListener("storage", checkPlayAs);
      window.removeEventListener("ixstats-play-as-change", checkPlayAs);
    };
  }, []);

  // Dynamic height tracking using ResizeObserver — runs for all sizes so content always drives dimensions
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      if (entry) {
        const height = element.scrollHeight || entry.contentRect.height;
        if (height > 0) {
          // Debounce React render to next frame using requestAnimationFrame to prevent rendering conflicts
          requestAnimationFrame(() => {
            setMeasuredHeight((prev) => {
              // Only update state if height changes by more than 1.5px to avoid layout-measurement stutters
              if (prev !== null && Math.abs(prev - height) < 1.5) {
                return prev;
              }
              return height;
            });
          });
        }
      }
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [state.size, children]);

  // For auto-sizing compact modes, let height be truly auto
  const isAutoHeight = dimensions.height === "auto";
  const targetHeight = isAutoHeight
    ? "auto"
    : measuredHeight !== null
      ? measuredHeight
      : dimensions.height;

  return (
    <div className="relative">
      {/* Outer glow — multi-layer halos for depth, matching maps DI */}
      <motion.div
        layout
        layoutId="dynamic-island-glow"
        className="force-gpu pointer-events-none absolute inset-0"
        animate={{
          borderRadius: currentSize.borderRadius,
          opacity: isCompactSize(state.size) ? 0.6 : 0.15,
        }}
        transition={{
          type: "spring",
          stiffness,
          damping,
          mass,
        }}
        style={{
          willChange: "transform, opacity",
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
        }}
      >
        {isImpersonating ? (
          <>
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-500/35 via-orange-500/35 to-red-500/35 blur-xl" />
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-400/25 via-red-500/25 to-orange-400/25 blur-lg" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 blur-xl" />
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-cyan-400/20 via-indigo-500/20 to-purple-400/20 blur-lg" />
          </>
        )}
      </motion.div>

      {/* Main dynamic island — matching maps DI background and borders */}
      <motion.div
        id={id}
        layout
        layoutId="dynamic-island-main"
        className={`focus-within:bg-accent/80 force-gpu relative mx-auto items-center justify-center border text-center shadow-2xl shadow-black/40 transition-colors duration-200 ${
          isImpersonating
            ? "border-red-500/80 dark:border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.45)]"
            : "border-white/20 dark:border-white/10"
        }`}
        initial={{
          width: dimensions.width,
          height: targetHeight,
          borderRadius: currentSize.borderRadius,
        }}
        animate={{
          width: dimensions.width,
          height: targetHeight,
          borderRadius: currentSize.borderRadius,
        }}
        transition={{
          type: "spring",
          stiffness,
          damping,
          mass,
        }}
        style={{
          willChange: "transform, width, height, border-radius",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(145%)",
          WebkitBackdropFilter: "blur(20px) saturate(145%)",
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
          isolation: "isolate",
          overflow: isAutoHeight ? "visible" : "hidden",
        }}
        {...props}
      >
        {/* Refraction edges */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/35 to-transparent" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-transparent via-white/35 to-transparent" />
          <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
          {/* Inner shimmer */}
          {isCompact && (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent"
              style={{ animationDuration: "3s", animationTimingFunction: "ease-in-out" }}
            />
          )}
        </div>

        {/* Local Backdrop Scrim Overlay for Expanded state */}
        <AnimatePresence>
          {!isCompact && (
            <motion.div
              key="card-backdrop-scrim"
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-white/80 backdrop-blur-[6px] dark:bg-black/65"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        {/* Content container */}
        <div
          ref={contentRef}
          className={`relative z-[10001] h-auto w-full ${isAutoHeight ? "overflow-visible" : "overflow-hidden"}`}
        >
          <AnimatePresence>{children}</AnimatePresence>
        </div>
      </motion.div>

      {/* Global Refraction SVG Filter */}
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="fractal-noise-glass">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.05 0.05"
              numOctaves="2"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="1.5" result="blurredNoise" />
            <feDisplacementMap
              xChannelSelector="R"
              yChannelSelector="G"
              scale="15"
              in="SourceGraphic"
              in2="blurredNoise"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
};

type DynamicContainerProps = {
  className?: string;
  children?: React.ReactNode;
};

const DynamicContainer = ({ className, children }: DynamicContainerProps) => {
  const willChange = useWillChange();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          type: "spring" as const,
          stiffness,
          damping,
          mass,
        },
      }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95, y: 20 }}
      style={{ willChange }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

type DynamicChildrenProps = {
  className?: string;
  children?: React.ReactNode;
};

const DynamicDiv = ({ className, children }: DynamicChildrenProps) => {
  const willChange = useWillChange();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: {
          type: "spring",
          stiffness,
          damping,
          mass,
        },
      }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
      style={{ willChange }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

type MotionProps = {
  className: string;
  children: React.ReactNode;
};

const DynamicTitle = ({ className, children }: MotionProps) => {
  const willChange = useWillChange();

  return (
    <motion.h3
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness, damping, mass },
      }}
      style={{ willChange }}
    >
      {children}
    </motion.h3>
  );
};

const DynamicDescription = ({ className, children }: MotionProps) => {
  const willChange = useWillChange();

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness, damping, mass },
      }}
      style={{ willChange }}
    >
      {children}
    </motion.p>
  );
};

// ──────────────────────────────────────────────────────────────────────────
/* HALO BRAND ALIAS EXPORTS */
// ──────────────────────────────────────────────────────────────────────────

/** @deprecated Use Halo instead */
export const Halo = DynamicIsland;

/** @deprecated Use useHaloSize instead */
export const useHaloSize = useDynamicIslandSize;

/** @deprecated Use HaloProvider instead */
export const HaloProvider = DynamicIslandProvider;

/** @deprecated Use HaloContainer instead */
export const HaloContainer = DynamicContainer;

export {
  DynamicContainer,
  DynamicTitle,
  DynamicDescription,
  DynamicIsland,
  SIZE_PRESETS,
  stiffness,
  damping,
  mass,
  DynamicDiv,
  DynamicIslandSizePresets,
  BlobContext,
  useDynamicIslandSize,
  useScheduledAnimations,
  DynamicIslandProvider,
};

export default DynamicIsland;
