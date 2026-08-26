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
import { AnimatePresence, motion } from "motion/react";

// Spring physics — Apple HIG fluid spring: critically damped settle (damping ratio ~1.0)
export const stiffness = 420;
export const damping = 38;
export const mass = 0.8; // lighter mass = faster acceleration into target shape
const MAX_HEIGHT_MOBILE_ULTRA = 400;
const MAX_HEIGHT_MOBILE_MASSIVE = 700;

// Performance optimization constants
const RESIZE_DEBOUNCE_MS = 100;

import {
  type SizePresets,
  type Preset,
  SIZE_PRESETS,
  DynamicIslandSizePresets,
} from "./presets";

export * from "./presets";

export type BlobStateType = {
  size: SizePresets;
  previousSize: SizePresets | undefined;
  animationQueue: Array<{ size: SizePresets; delay: number }>;
  isAnimating: boolean;
};

export type BlobAction =
  | { type: "SET_SIZE"; newSize: SizePresets }
  | { type: "INITIALIZE"; firstState: SizePresets }
  | {
      type: "SCHEDULE_ANIMATION";
      animationSteps: Array<{ size: SizePresets; delay: number }>;
    }
  | { type: "ANIMATION_END" };

export type BlobContextType = {
  state: BlobStateType;
  dispatch: React.Dispatch<BlobAction>;
  setSize: (size: SizePresets) => void;
  scheduleAnimation: (animationSteps: Array<{ size: SizePresets; delay: number }>) => void;
  presets: Record<SizePresets, Preset>;
};

export const BlobContext = createContext<BlobContextType | undefined>(undefined);

const blobReducer = (state: BlobStateType, action: BlobAction): BlobStateType => {
  switch (action.type) {
    case "SET_SIZE":
      return {
        ...state,
        size: action.newSize,
        previousSize: state.size,
        isAnimating: false,
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

export interface DynamicIslandProviderProps {
  children: React.ReactNode;
  initialSize?: SizePresets;
  initialAnimation?: Array<{ size: SizePresets; delay: number }>;
}

export const HaloProvider: React.FC<DynamicIslandProviderProps> = ({
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

export const useHaloSize = () => {
  const context = useContext(BlobContext);
  if (!context) {
    throw new Error("useHaloSize must be used within a HaloProvider");
  }
  return context;
};

export const useScheduledAnimations = (animations: Array<{ size: SizePresets; delay: number }>) => {
  const { scheduleAnimation } = useHaloSize();
  const animationsRef = useRef(animations);

  useEffect(() => {
    scheduleAnimation(animationsRef.current);
  }, [scheduleAnimation]);
};

export const HaloOuterWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="z-[10000] flex h-full w-full items-center justify-center bg-transparent">
      {children}
    </div>
  );
};

export const isCompactSize = (size: SizePresets | undefined): boolean => {
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

const calculateDimensions = (
  size: SizePresets,
  screenSize: string,
  currentSize: Preset | undefined
): { width: string; height: number | string } => {
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
    return { width: "95vw", height: 64 };
  }

  if (isWideOnTablet) {
    return { width: "90vw", height: 72 };
  }

  if (size === "extraWide") {
    return { width: "min(1200px, 80vw)", height: 64 };
  }

  if (size === "fullWidth") {
    return { width: "min(1400px, 85vw)", height: 80 };
  }

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

  return {
    width: `${resolvedSize.width}px`,
    height: resolvedSize.aspectRatio * resolvedSize.width,
  };
};

export interface DynamicIslandContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "id"> {
  children: React.ReactNode;
  id: string;
  screenSize: string;
}

export const DynamicIslandContent = ({
  children,
  id,
  screenSize,
  ...props
}: DynamicIslandContentProps) => {
  const { state, presets } = useHaloSize();
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
          requestAnimationFrame(() => {
            setMeasuredHeight((prev) => {
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
  // oxlint-disable-next-line
  }, [state.size, children]);

  const isAutoHeight = dimensions.height === "auto";
  const targetHeight = isAutoHeight
    ? "auto"
    : measuredHeight !== null
      ? measuredHeight
      : dimensions.height;

  return (
    <div className="relative">
      {isImpersonating && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          animate={{
            borderRadius: currentSize.borderRadius,
            opacity: isCompactSize(state.size) ? 0.8 : 0.3,
          }}
          transition={{
            type: "spring",
            stiffness,
            damping,
            mass,
          }}
        >
          <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-500/35 via-orange-500/35 to-red-500/35 blur-xl" />
          <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-r from-red-400/25 via-red-500/25 to-orange-400/25 blur-lg" />
        </motion.div>
      )}

      <motion.div
        id={id}
        data-expanded={!isCompact ? "true" : undefined}
        className={`dynamic-island-shell relative mx-auto items-center justify-center text-center transition-colors duration-200 ${
          isImpersonating ? "!border-red-500/80 !shadow-[0_0_15px_rgba(239,68,68,0.45)]" : ""
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
          transform: "translateZ(0)",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          isolation: "isolate",
          overflow: isAutoHeight ? "visible" : "hidden",
        }}
        {...props}
      >
        {/* Specular edge highlight (Apple physical acrylic top lip glare) */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
          <div className="absolute top-0 left-0 h-[1.5px] w-full bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/30" />
          <div className="absolute top-0 right-1/4 left-1/4 h-[1px] bg-white/40 blur-[0.5px] dark:bg-white/20" />
        </div>

        <AnimatePresence>
          {!isCompact && (
            <motion.div
              key="card-backdrop-scrim"
              className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-b from-white/[0.04] via-transparent to-black/[0.08] dark:from-white/[0.02] dark:to-black/[0.25]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        <div
          ref={contentRef}
          className={`relative z-[10001] h-auto w-full ${isAutoHeight ? "overflow-visible" : "overflow-hidden"}`}
        >
          <AnimatePresence>{children}</AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export const Halo = ({ children, id, ...props }: { children: ReactNode; id: string }) => {
  const [screenSize, setScreenSize] = useState("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);

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
          // oxlint-disable-next-line
          if (screenSize !== newSize) {
            setScreenSize(newSize);
          }
          isResizing = false;
        });
      }

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
  }, []);

  if (!mounted) {
    return (
      <HaloOuterWrapper>
        <div className="bg-card/95 border-border relative mx-auto h-11 items-center justify-center rounded-full px-4 text-center backdrop-blur-xl">
          {children}
        </div>
      </HaloOuterWrapper>
    );
  }

  return (
    <HaloOuterWrapper>
      <DynamicIslandContent id={id} screenSize={screenSize} {...props}>
        {children}
      </DynamicIslandContent>
    </HaloOuterWrapper>
  );
};

export type DynamicContainerProps = {
  className?: string;
  children?: React.ReactNode;
};

export const HaloContainer = ({ className, children }: DynamicContainerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
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
      exit={{ opacity: 0, scale: 0.98, y: 10, transition: { duration: 0.15, ease: "easeOut" } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export type DynamicChildrenProps = {
  className?: string;
  children?: React.ReactNode;
};

export const DynamicDiv = ({ className, children }: DynamicChildrenProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
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
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: "easeOut" } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export type MotionProps = {
  className: string;
  children: React.ReactNode;
};

export const DynamicTitle = ({ className, children }: MotionProps) => {
  return (
    <motion.h3
      className={className}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness, damping, mass },
      }}
    >
      {children}
    </motion.h3>
  );
};

export const DynamicDescription = ({ className, children }: MotionProps) => {
  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness, damping, mass },
      }}
    >
      {children}
    </motion.p>
  );
};

// Aliases for compatibility
export const DynamicIsland = Halo;
export const useDynamicIslandSize = useHaloSize;
export const DynamicIslandProvider = HaloProvider;
export const DynamicContainer = HaloContainer;
export default Halo;
