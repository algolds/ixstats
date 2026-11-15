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
import { usePlayAsTarget } from "~/hooks/usePlayAsTarget";
import { type SizePresets, type Preset, SIZE_PRESETS, DynamicIslandSizePresets } from "./presets";

// The island morphs with the snappy spring: it answers a press directly, at the same settle
// speed as the controls inside it.
const MAX_HEIGHT_MOBILE_ULTRA = 400;

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
    size === "compactLong" || size === "compactTall" || size === "wikiInline" || size === "default"
  );
};

const calculateDimensions = (
  size: SizePresets,
  screenSize: string,
  currentSize: Preset | undefined
): { width: string; height: number | string } => {
  const resolvedSize = currentSize ?? DynamicIslandSizePresets.default;

  if (size === "ultra" && screenSize === "mobile") {
    return { width: "350px", height: MAX_HEIGHT_MOBILE_ULTRA };
  }

  if (isCompactSize(size)) {
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
