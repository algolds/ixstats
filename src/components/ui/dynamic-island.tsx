"use client"

import React, {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react"
import { AnimatePresence, motion, useWillChange } from "motion/react"

const stiffness = 400
const damping = 30
const MAX_HEIGHT_MOBILE_ULTRA = 400
const MAX_HEIGHT_MOBILE_MASSIVE = 700

export type SizePresets =
  | "reset"
  | "empty"
  | "default"
  | "compact"
  | "compactLong"
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

const SIZE_PRESETS = {
  RESET: "reset",
  EMPTY: "empty",
  DEFAULT: "default",
  COMPACT: "compact",
  COMPACT_LONG: "compactLong",
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
} as const

type Preset = {
  width: number
  height?: number
  aspectRatio: number
  borderRadius: number
}

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
    width: 235,
    aspectRatio: 44 / 235,
    borderRadius: 46,
  },
  [SIZE_PRESETS.COMPACT_LONG]: {
    width: 300,
    aspectRatio: 44 / 235,
    borderRadius: 46,
  },
  [SIZE_PRESETS.COMPACT_MEDIUM]: {
    width: 351,
    aspectRatio: 64 / 371,
    borderRadius: 44,
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
}

type BlobStateType = {
  size: SizePresets
  previousSize: SizePresets | undefined
  animationQueue: Array<{ size: SizePresets; delay: number }>
  isAnimating: boolean
}

type BlobAction =
  | { type: "SET_SIZE"; newSize: SizePresets }
  | { type: "INITIALIZE"; firstState: SizePresets }
  | {
      type: "SCHEDULE_ANIMATION"
      animationSteps: Array<{ size: SizePresets; delay: number }>
    }
  | { type: "ANIMATION_END" }

type BlobContextType = {
  state: BlobStateType
  dispatch: React.Dispatch<BlobAction>
  setSize: (size: SizePresets) => void
  scheduleAnimation: (
    animationSteps: Array<{ size: SizePresets; delay: number }>
  ) => void
  presets: Record<SizePresets, Preset>
}

const BlobContext = createContext<BlobContextType | undefined>(undefined)

const blobReducer = (
  state: BlobStateType,
  action: BlobAction
): BlobStateType => {
  switch (action.type) {
    case "SET_SIZE":
      return {
        ...state,
        size: action.newSize,
        previousSize: state.size,
        isAnimating: false, // Only set isAnimating to true if there are more steps
      }
    case "SCHEDULE_ANIMATION":
      return {
        ...state,
        animationQueue: action.animationSteps,
        isAnimating: action.animationSteps.length > 0,
      }
    case "INITIALIZE":
      return {
        ...state,
        size: action.firstState,
        previousSize: SIZE_PRESETS.EMPTY,
        isAnimating: false,
      }
    case "ANIMATION_END":
      return {
        ...state,
        isAnimating: false,
      }
    default:
      return state
  }
}

interface DynamicIslandProviderProps {
  children: React.ReactNode
  initialSize?: SizePresets
  initialAnimation?: Array<{ size: SizePresets; delay: number }>
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
  }

  const [state, dispatch] = useReducer(blobReducer, initialState)

  useEffect(() => {
    const processQueue = async () => {
      for (const step of state.animationQueue) {
        await new Promise((resolve) => setTimeout(resolve, step.delay))
        dispatch({ type: "SET_SIZE", newSize: step.size })
      }
      dispatch({ type: "ANIMATION_END" })
    }

    if (state.animationQueue.length > 0) {
      processQueue()
    }
  }, [state.animationQueue])

  const setSize = useCallback(
    (newSize: SizePresets) => {
      if (state.previousSize !== newSize && newSize !== state.size) {
        dispatch({ type: "SET_SIZE", newSize })
      }
    },
    [state.previousSize, state.size, dispatch]
  )

  const scheduleAnimation = useCallback(
    (animationSteps: Array<{ size: SizePresets; delay: number }>) => {
      dispatch({ type: "SCHEDULE_ANIMATION", animationSteps })
    },
    [dispatch]
  )

  const contextValue = {
    state,
    dispatch,
    setSize,
    scheduleAnimation,
    presets: DynamicIslandSizePresets,
  }

  return (
    <BlobContext.Provider value={contextValue}>{children}</BlobContext.Provider>
  )
}

const useDynamicIslandSize = () => {
  const context = useContext(BlobContext)
  if (!context) {
    throw new Error(
      "useDynamicIslandSize must be used within a DynamicIslandProvider"
    )
  }
  return context
}

const useScheduledAnimations = (
  animations: Array<{ size: SizePresets; delay: number }>
) => {
  const { scheduleAnimation } = useDynamicIslandSize()
  const animationsRef = useRef(animations)

  useEffect(() => {
    scheduleAnimation(animationsRef.current)
  }, [scheduleAnimation])
}

const DynamicIslandContainer = ({ children }: { children: ReactNode }) => {
  return (
    <div className="z-[10000] flex h-full w-full items-end justify-center bg-transparent">
      {children}
    </div>
  )
}

const DynamicIsland = ({
  children,
  id,
  ...props
}: {
  children: ReactNode
  id: string
}) => {
  const willChange = useWillChange()
  const [screenSize, setScreenSize] = useState("desktop")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Throttled resize handler for better performance
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth
        const newSize = width <= 640 ? "mobile" : width <= 1024 ? "tablet" : "desktop"
        setScreenSize(prevSize => prevSize !== newSize ? newSize : prevSize)
      }, 100) // Throttle to 100ms
    }

    handleResize()
    window.addEventListener("resize", handleResize, { passive: true })
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  if (!mounted) {
    return (
      <DynamicIslandContainer>
        <div className="relative mx-auto items-center justify-center bg-card/95 backdrop-blur-xl border-border text-center rounded-full h-11 px-4">
          {children}
        </div>
      </DynamicIslandContainer>
    )
  }

  return (
    <DynamicIslandContainer>
      <DynamicIslandContent
        id={id}
        willChange={willChange}
        screenSize={screenSize}
        {...props}
      >
        {children}
      </DynamicIslandContent>
    </DynamicIslandContainer>
  )
}

const calculateDimensions = (
  size: SizePresets,
  screenSize: string,
  currentSize: Preset
): { width: string; height: number } => {
  const isMassiveOnMobile = size === "massive" && screenSize === "mobile"
  const isUltraOnMobile = size === "ultra" && screenSize === "mobile"
  const isWideOnMobile = (size === "extraWide" || size === "fullWidth") && screenSize === "mobile"
  const isWideOnTablet = (size === "extraWide" || size === "fullWidth") && screenSize === "tablet"

  if (isMassiveOnMobile) {
    return { width: "350px", height: MAX_HEIGHT_MOBILE_MASSIVE }
  }

  if (isUltraOnMobile) {
    return { width: "350px", height: MAX_HEIGHT_MOBILE_ULTRA }
  }
  
  if (isWideOnMobile) {
    // On mobile, use smaller width for wide layouts
    return { width: "95vw", height: 64 }
  }
  
  if (isWideOnTablet) {
    // On tablet, use most of the available width
    return { width: "90vw", height: 72 }
  }
  
  // For extra wide and full width on desktop, use responsive width
  if (size === "extraWide") {
    return { width: "min(1200px, 80vw)", height: 64 }
  }
  
  if (size === "fullWidth") {
    return { width: "min(1400px, 85vw)", height: 80 }
  }

  // For compact and other modes, use auto width based on content
  if (size === "compact" || size === "compactLong" || size === "compactMedium") {
    return { width: "auto", height: currentSize.aspectRatio * currentSize.width }
  }

  // For other preset sizes, use the preset width directly without MIN_WIDTH restriction
  return { width: `${currentSize.width}px`, height: currentSize.aspectRatio * currentSize.width }
}

const DynamicIslandContent = ({
  children,
  id,
  willChange,
  screenSize,
  ...props
}: {
  children: React.ReactNode
  id: string
  willChange: any
  screenSize: string
  [key: string]: any
}) => {
  const { state, presets } = useDynamicIslandSize()
  const currentSize = presets[state.size]

  const dimensions = calculateDimensions(state.size, screenSize, currentSize)

  return (
    <div className="relative">
      {/* Outer glow effect with animation and refraction */}
      <motion.div
        className="absolute inset-0 opacity-60"
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: currentSize.borderRadius,
          transition: {
            type: "spring",
            stiffness: stiffness * 0.8,
            damping: damping * 0.9,
            duration: 0.6,
          },
        }}
        style={{ willChange }}
      >
        {/* Multi-layer glow for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-indigo-500/20 to-purple-400/20 blur-lg" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-300/15 via-purple-300/15 to-blue-300/15 blur-md" />
      </motion.div>
      
      {/* Extended glow for wide modes */}
      {(state.size === "extraWide" || state.size === "fullWidth") && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent blur-xl opacity-40"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: 0.4, 
            scale: 1.1,
            transition: {
              type: "spring",
              stiffness: 200,
              damping: 25,
              duration: 0.8,
            }
          }}
          exit={{ opacity: 0, scale: 0.8 }}
        />
      )}
      
      {/* Main dynamic island */}
      <motion.div
        id={id}
        className="relative mx-auto items-center justify-center border border-white/20 dark:border-white/10 text-center transition duration-300 ease-in-out focus-within:bg-accent/80 hover:shadow-2xl hover:shadow-primary/20 overflow-hidden"
        initial={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: currentSize.borderRadius,
        }}
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: currentSize.borderRadius,
          transition: {
            type: "spring",
            stiffness,
            damping,
          },
        }}
        style={{ 
          willChange,
          minWidth: dimensions.width === "auto" ? "fit-content" : undefined,
          background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
        {...props}
      >
        {/* Inner glass effects with refraction */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Refraction edges */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
          
          {/* Inner shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
        
        {/* Content container */}
        <div className="relative z-[10001] h-full w-full">
          <AnimatePresence>{children}</AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

type DynamicContainerProps = {
  className?: string
  children?: React.ReactNode
}

const DynamicContainer = ({ className, children }: DynamicContainerProps) => {
  const willChange = useWillChange()
  const { state } = useDynamicIslandSize()
  const { size, previousSize } = state

  const isSizeChanged = size !== previousSize

  const initialState = {
    opacity: size === previousSize ? 1 : 0,
    scale: size === previousSize ? 1 : 0.9,
    y: size === previousSize ? 0 : 5,
  }

  const animateState = {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness,
      damping,
      duration: isSizeChanged ? 0.5 : 0.8,
    },
  }

  return (
    <motion.div
      initial={initialState}
      animate={animateState}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95, y: 20 }}
      style={{ willChange }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type DynamicChildrenProps = {
  className?: string
  children?: React.ReactNode
}

const DynamicDiv = ({ className, children }: DynamicChildrenProps) => {
  const { state } = useDynamicIslandSize()
  const { size, previousSize } = state
  const willChange = useWillChange()

  return (
    <motion.div
      initial={{
        opacity: size === previousSize ? 1 : 0,
        scale: size === previousSize ? 1 : 0.9,
      }}
      animate={{
        opacity: size === previousSize ? 0 : 1,
        scale: size === previousSize ? 0.9 : 1,
        transition: {
          type: "spring",
          stiffness,
          damping,
        },
      }}
      exit={{ opacity: 0, filter: "blur(10px)", scale: 0 }}
      style={{ willChange }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type MotionProps = {
  className: string
  children: React.ReactNode
}

const DynamicTitle = ({ className, children }: MotionProps) => {
  const { state } = useDynamicIslandSize()
  const { size, previousSize } = state
  const willChange = useWillChange()

  return (
    <motion.h3
      className={className}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: size === previousSize ? 0 : 1,
        scale: size === previousSize ? 0.9 : 1,
        transition: { type: "spring", stiffness, damping },
      }}
      style={{ willChange }}
    >
      {children}
    </motion.h3>
  )
}

const DynamicDescription = ({ className, children }: MotionProps) => {
  const { state } = useDynamicIslandSize()
  const { size, previousSize } = state
  const willChange = useWillChange()

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: size === previousSize ? 0 : 1,
        scale: size === previousSize ? 0.9 : 1,
        transition: { type: "spring", stiffness, damping },
      }}
      style={{ willChange }}
    >
      {children}
    </motion.p>
  )
}

export {
  DynamicContainer,
  DynamicTitle,
  DynamicDescription,
  DynamicIsland,
  SIZE_PRESETS,
  stiffness,
  DynamicDiv,
  damping,
  DynamicIslandSizePresets,
  BlobContext,
  useDynamicIslandSize,
  useScheduledAnimations,
  DynamicIslandProvider,
}

export default DynamicIsland
