"use client";

import React, {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { REDUCED_MOTION_FADE, springSnappy, tweenExit } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { usePlayAsTarget } from "~/hooks/usePlayAsTarget";
import { ISLAND_MATERIAL, useHaloMaterial } from "./halo-material";
import { type SizePresets, type Preset, SIZE_PRESETS, DynamicIslandSizePresets } from "./presets";

// The island morphs with the snappy spring: it answers a press directly, at the same settle
// speed as the controls inside it.

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
): { width: string } => {
  const resolvedSize = currentSize ?? DynamicIslandSizePresets.default;

  // Height always follows the content; expanded views scroll inside their own max height.
  if (isCompactSize(size)) return { width: "fit-content" };
  if (screenSize === "mobile") {
    return { width: `min(${resolvedSize.width}px, calc(100vw - 24px))` };
  }
  return { width: `${resolvedSize.width}px` };
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
  const material = useHaloMaterial();
  const islandRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <motion.div
        ref={islandRef}
        id={id}
        layout
        // Motion's FLIP morph scales the island box up to ~15x vertically between pill and panel, which would stretch
        // #facet-lens's objectBoundingBox displacement map mid-spring. Replacing --lens-refraction with a no-op filter
        // function keeps the 12px frost valid during the morph and restores rim refraction once the box settles.
        onLayoutAnimationStart={() => {
          islandRef.current?.style.setProperty("--lens-refraction", "brightness(1)");
        }}
        onLayoutAnimationComplete={() => {
          islandRef.current?.style.removeProperty("--lens-refraction");
        }}
        data-expanded={!isCompact ? "true" : undefined}
        data-reduced-motion={reduceMotion ? "true" : undefined}
        data-material={material}
        // Halo is Facet's one Chrome surface made of Lens: liquid glass refracting the page, frosted so text
        // holds over anything. Sections inside sit on solid wells. (`chrome` is the admins' comparison.)
        className={cn(
          ISLAND_MATERIAL[material],
          "relative mx-auto items-center justify-center text-center",
          isImpersonating && "ring-destructive ring-2"
        )}
        transition={reduceMotion ? { duration: 0 } : springSnappy}
        style={{
          width: dimensions.width,
          maxWidth: isCompact ? undefined : "calc(100vw - 24px)",
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
