"use client";

import React, {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { REDUCED_MOTION_FADE, springSnappy, tweenExit } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { useHydrated } from "~/hooks/useHydrated";
import { usePlayAsTarget } from "~/hooks/usePlayAsTarget";

// The island morphs with the snappy spring: it answers a press directly, at the same settle
// speed as the controls inside it.
const MAX_HEIGHT_MOBILE_ULTRA = 400;
const MAX_HEIGHT_MOBILE_MASSIVE = 700;

import { type SizePresets, type Preset, SIZE_PRESETS, DynamicIslandSizePresets } from "./presets";

export * from "./presets";

type HaloSizeContextType = {
  size: SizePresets;
  setSize: Dispatch<SetStateAction<SizePresets>>;
};

const HaloSizeContext = createContext<HaloSizeContextType | undefined>(undefined);

interface HaloProviderProps {
  children: React.ReactNode;
  initialSize?: SizePresets;
}

export const HaloProvider: React.FC<HaloProviderProps> = ({
  children,
  initialSize = SIZE_PRESETS.DEFAULT,
}) => {
  // useState skips the re-render when the size is unchanged, so setSize needs no guard.
  const [size, setSize] = useState(initialSize);

  return <HaloSizeContext.Provider value={{ size, setSize }}>{children}</HaloSizeContext.Provider>;
};

export const useHaloSize = () => {
  const context = useContext(HaloSizeContext);
  if (!context) {
    throw new Error("useHaloSize must be used within a HaloProvider");
  }
  return context;
};
const HaloOuterWrapper = ({ children }: { children: ReactNode }) => {
  return <div className="z-raised flex h-full w-full items-center justify-center">{children}</div>;
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

interface DynamicIslandContentProps extends Omit<
  React.ComponentPropsWithoutRef<typeof motion.div>,
  "id"
> {
  children: React.ReactNode;
  id: string;
  screenSize: string;
}

const DynamicIslandContent = ({
  children,
  id,
  screenSize,
  ...props
}: DynamicIslandContentProps) => {
  const { size } = useHaloSize();
  const currentSize = DynamicIslandSizePresets[size] ?? DynamicIslandSizePresets.default;
  const isCompact = isCompactSize(size);

  const dimensions = calculateDimensions(size, screenSize, currentSize);

  const isImpersonating = usePlayAsTarget() !== "";
  const reduceMotion = useFacetReducedMotion();

  return (
    <div className="relative">
      <motion.div
        id={id}
        layout
        data-expanded={!isCompact ? "true" : undefined}
        data-reduced-motion={reduceMotion ? "true" : undefined}
        // Halo is the acrylic island: a pill, then a frosted sheet once `data-expanded` opens it
        // into a panel. Content inside stays on opaque roles.
        className={cn(
          "facet-chrome relative mx-auto items-center justify-center text-center",
          isImpersonating && "ring-destructive ring-2"
        )}
        transition={reduceMotion ? { duration: 0 } : springSnappy}
        style={{
          width: dimensions.width,
          height: "auto",
          borderRadius: currentSize.borderRadius,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          isolation: "isolate",
          overflow: "hidden",
        }}
        {...props}
      >
        <motion.div layout="position" className="z-raised relative h-auto w-full overflow-hidden">
          <AnimatePresence>{children}</AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

export const Halo = ({ children, id, ...props }: { children: ReactNode; id: string }) => {
  const [screenSize, setScreenSize] = useState("desktop");
  const mounted = useHydrated();

  useEffect(() => {
    // One measurement per frame; setScreenSize skips the re-render when the bucket is unchanged.
    let rafId: number | undefined;
    const handleResize = () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const width = window.innerWidth;
        setScreenSize(width <= 640 ? "mobile" : width <= 1024 ? "tablet" : "desktop");
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!mounted) {
    return (
      <HaloOuterWrapper>
        <div className="facet-chrome relative isolate mx-auto h-11 items-center justify-center rounded-full px-4 text-center">
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

type DynamicContainerProps = {
  className?: string;
  children?: React.ReactNode;
};

export const HaloContainer = ({ className, children }: DynamicContainerProps) => {
  const reduceMotion = useFacetReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
      animate={
        reduceMotion
          ? { opacity: 1, transition: REDUCED_MOTION_FADE }
          : {
              opacity: 1,
              scale: 1,
              y: 0,
              transition: springSnappy,
            }
      }
      exit={
        reduceMotion
          ? { opacity: 0, transition: REDUCED_MOTION_FADE }
          : { opacity: 0, scale: 0.98, y: 10, transition: tweenExit }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
};
