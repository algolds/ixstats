import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectionMode } from "~/lib/maps/map-config";

export interface TourStep {
  name: string;
  fallbackBlurb: string;
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

const step = (
  name: string,
  fallbackBlurb: string,
  center: [number, number],
  zoom: number,
  pitch: number,
  bearing: number
): TourStep => ({ name, fallbackBlurb, camera: { center, zoom, pitch, bearing } });

const TOUR_STEPS: TourStep[] = [
  step(
    "Caphiria",
    "Sarpedon's preeminent empire, characterized by its classical military heritage and administrative centralization.",
    [26.3626, -19.6347],
    4.2,
    45,
    15
  ),
  step(
    "Fiannria",
    "A historic maritime gateway in Levantia, pivotal in regional trade corridors across the Kilikas Sea.",
    [63.5578, 41.064],
    4.8,
    35,
    -20
  ),
  step(
    "Faneria",
    "Located on the Gallia Magna coast of Levantia, an industrial powerhouse built on engineering and maritime commerce.",
    [50.6548, 45.2802],
    5.0,
    40,
    30
  ),
  step(
    "Kiravia",
    "The expansive northern state of Kiroborea, boasting massive natural resource industries and high technological research hubs.",
    [-22.2237, 53.5878],
    4.5,
    50,
    45
  ),
  step(
    "Tierrador",
    "The gateway of South Crona, critical for agricultural exports and raw mineral shipping routes.",
    [-86.3198, 3.0441],
    4.4,
    30,
    -15
  ),
  step(
    "Daxia",
    "Audonia's southern trading hub, dominating commerce in the Levantine Ocean and Southeast Asian routes.",
    [164.8931, -8.881],
    4.6,
    45,
    25
  ),
];

const WORLD_VIEW = { center: [56.1842, 0] as [number, number], zoom: 1.8, pitch: 0, bearing: 0 };

export type TourState = "idle" | "intro" | "flying" | "paused_at_step" | "outro" | "completed";

interface UseMapTourProps {
  mapRef: React.RefObject<any>;
  projectionMode: ProjectionMode;
  setProjectionMode: (mode: ProjectionMode) => void;
  setSelectedCountry: (country: any) => void;
  mapLayers?: any[];
}

export function useMapTour({
  mapRef,
  projectionMode,
  setProjectionMode,
  setSelectedCountry,
  mapLayers,
}: UseMapTourProps) {
  const [tourState, setTourState] = useState<TourState>("idle");
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const savedProjectionMode = useRef<ProjectionMode | null>(null);

  const startTour = useCallback(() => {
    // Remember the projection to restore on exit; the tour runs in dynamic (globe at low zoom)
    savedProjectionMode.current = projectionMode;
    setProjectionMode("dynamic");
    setSelectedCountry(null);
    setTourState("intro");
    setCurrentStepIndex(0);
    setProgress(0);
    setIsPaused(false);

    mapRef.current?.getMap()?.flyTo({ ...WORLD_VIEW, speed: 1.0, essential: true });
  }, [projectionMode, setProjectionMode, setSelectedCountry, mapRef]);

  const exitTour = useCallback(() => {
    setTourState("idle");
    setProgress(0);
    setIsPaused(false);

    // Restore saved projection
    if (savedProjectionMode.current) {
      setProjectionMode(savedProjectionMode.current);
    }

    mapRef.current?.getMap()?.flyTo({ pitch: 0, bearing: 0, speed: 1.2, essential: true });
  }, [setProjectionMode, mapRef]);

  const flyToStepIndex = useCallback(
    (idx: number) => {
      setTourState("flying");
      setCurrentStepIndex(idx);
      setProgress(0);

      const stop = TOUR_STEPS[idx];
      const map = mapRef.current?.getMap();
      if (!map || !stop) return;

      // Prefer the country's live centroid over the hard-coded camera centre.
      const name = stop.name.toLowerCase();
      const props = mapLayers
        ?.find((l) => l.type === "political")
        ?.data?.features?.find(
          (f: any) =>
            f.properties?._id?.toLowerCase() === name ||
            f.properties?._displayName?.toLowerCase() === name
        )?.properties;
      const lng = props?._centroidLng;
      const lat = props?._centroidLat;
      const hasCentroid =
        typeof lng === "number" && typeof lat === "number" && lng !== 0 && lat !== 0;

      map.flyTo({
        center: hasCentroid ? [lng, lat] : stop.camera.center,
        zoom: stop.camera.zoom,
        pitch: stop.camera.pitch,
        bearing: stop.camera.bearing,
        speed: 0.8, // cinematic speed
        essential: true,
      });
    },
    [mapRef, mapLayers]
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      flyToStepIndex(currentStepIndex + 1);
    } else {
      // Outro sequence
      setTourState("outro");
      setProgress(0);
      mapRef.current?.getMap()?.flyTo({ ...WORLD_VIEW, speed: 0.7, essential: true });
    }
  }, [currentStepIndex, flyToStepIndex, mapRef]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      flyToStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex, flyToStepIndex]);

  const togglePause = useCallback(() => setIsPaused((p) => !p), []);

  // Listen to MapLibre transition end events
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || tourState === "idle") return;

    const handleMoveEnd = () => {
      if (tourState === "intro") {
        // Intro zoom out is complete, fly to first country
        flyToStepIndex(0);
      } else if (tourState === "flying") {
        // Step zoom/pan is complete, show info blurb and count down
        setTourState("paused_at_step");
        setProgress(0);
      } else if (tourState === "outro") {
        // Outro zoom out is complete, finish
        setTourState("idle");
        if (savedProjectionMode.current) {
          setProjectionMode(savedProjectionMode.current);
        }
      }
    };

    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [mapRef, tourState, flyToStepIndex, setProjectionMode]);

  // Timed transition progress bar logic
  useEffect(() => {
    if (tourState !== "paused_at_step" || isPaused) return;

    const intervalMs = 100;
    const durationMs = 6000; // 6 seconds pause per country
    const stepProgress = (intervalMs / durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          nextStep();
          return 100;
        }
        return prev + stepProgress;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [tourState, isPaused, nextStep]);

  const currentStepData = TOUR_STEPS[currentStepIndex] || null;

  return {
    tourState,
    currentStepIndex,
    isPaused,
    progress,
    startTour,
    exitTour,
    nextStep,
    prevStep,
    togglePause,
    currentStepData,
    totalSteps: TOUR_STEPS.length,
  };
}
