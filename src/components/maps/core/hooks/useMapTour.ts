import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectionMode } from "~/lib/map-config";

export interface TourStep {
  name: string;
  featureId: string;
  countryId: string;
  fallbackCapital: string;
  fallbackBlurb: string;
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export const TOUR_STEPS: TourStep[] = [
  {
    name: "Caphiria",
    featureId: "Caphiria",
    countryId: "Caphiria",
    fallbackCapital: "Caphiria City",
    fallbackBlurb:
      "Sarpedon's preeminent empire, characterized by its classical military heritage and administrative centralization.",
    camera: { center: [26.3626, -19.6347], zoom: 4.2, pitch: 45, bearing: 15 },
  },
  {
    name: "Fiannria",
    featureId: "Fiannria",
    countryId: "Fiannria",
    fallbackCapital: "Fiannria Harbor",
    fallbackBlurb:
      "A historic maritime gateway in Levantia, pivotal in regional trade corridors across the Kilikas Sea.",
    camera: { center: [63.5578, 41.064], zoom: 4.8, pitch: 35, bearing: -20 },
  },
  {
    name: "Faneria",
    featureId: "Faneria",
    countryId: "Faneria",
    fallbackCapital: "Faneria Harbor",
    fallbackBlurb:
      "Located on the Gallia Magna coast of Levantia, an industrial powerhouse built on engineering and maritime commerce.",
    camera: { center: [50.6548, 45.2802], zoom: 5.0, pitch: 40, bearing: 30 },
  },
  {
    name: "Kiravia",
    featureId: "Kiravia",
    countryId: "Kiravia",
    fallbackCapital: "Kiravia Prime",
    fallbackBlurb:
      "The expansive northern state of Kiroborea, boasting massive natural resource industries and high technological research hubs.",
    camera: { center: [-22.2237, 53.5878], zoom: 4.5, pitch: 50, bearing: 45 },
  },
  {
    name: "Tierrador",
    featureId: "Tierrador",
    countryId: "Tierrador",
    fallbackCapital: "Tierrador Port",
    fallbackBlurb:
      "The gateway of South Crona, critical for agricultural exports and raw mineral shipping routes.",
    camera: { center: [-86.3198, 3.0441], zoom: 4.4, pitch: 30, bearing: -15 },
  },
  {
    name: "Daxia",
    featureId: "Daxia",
    countryId: "Daxia",
    fallbackCapital: "Daxia Harbor",
    fallbackBlurb:
      "Audonia's southern trading hub, dominating commerce in the Levantine Ocean and Southeast Asian routes.",
    camera: { center: [164.8931, -8.881], zoom: 4.6, pitch: 45, bearing: 25 },
  },
];

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
    // Save current projection mode to restore later
    savedProjectionMode.current = projectionMode;
    // Set to dynamic projection (globe view at low zoom)
    setProjectionMode("dynamic");
    // Clear any selected country
    setSelectedCountry(null);
    setTourState("intro");
    setCurrentStepIndex(0);
    setProgress(0);
    setIsPaused(false);

    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [56.1842, 0],
        zoom: 1.8,
        pitch: 0,
        bearing: 0,
        speed: 1.0,
        essential: true,
      });
    }
  }, [projectionMode, setProjectionMode, setSelectedCountry, mapRef]);

  const exitTour = useCallback(() => {
    setTourState("idle");
    setProgress(0);
    setIsPaused(false);

    // Restore saved projection
    if (savedProjectionMode.current) {
      setProjectionMode(savedProjectionMode.current);
    }

    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        pitch: 0,
        bearing: 0,
        speed: 1.2,
        essential: true,
      });
    }
  }, [setProjectionMode, mapRef]);

  const flyToStepIndex = useCallback(
    (idx: number) => {
      setTourState("flying");
      setCurrentStepIndex(idx);
      setProgress(0);

      const step = TOUR_STEPS[idx];
      const map = mapRef.current?.getMap();
      if (map && step) {
        let center = step.camera.center;

        if (mapLayers) {
          const politicalLayer = mapLayers.find((l) => l.type === "political");
          const features = politicalLayer?.data?.features || [];
          const feature = features.find(
            (f: any) =>
              f.properties?._id?.toLowerCase() === step.featureId.toLowerCase() ||
              f.properties?._displayName?.toLowerCase() === step.name.toLowerCase()
          );

          if (feature?.properties) {
            const lng = feature.properties._centroidLng;
            const lat = feature.properties._centroidLat;
            if (typeof lng === "number" && typeof lat === "number" && lng !== 0 && lat !== 0) {
              center = [lng, lat];
              console.log(`[useMapTour] Found dynamic centroid for ${step.name}:`, center);
            }
          }
        }

        map.flyTo({
          center: center,
          zoom: step.camera.zoom,
          pitch: step.camera.pitch,
          bearing: step.camera.bearing,
          speed: 0.8, // cinematic speed
          essential: true,
        });
      }
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
      const map = mapRef.current?.getMap();
      if (map) {
        map.flyTo({
          center: [56.1842, 0],
          zoom: 1.8,
          pitch: 0,
          bearing: 0,
          speed: 0.7,
          essential: true,
        });
      }
    }
  }, [currentStepIndex, flyToStepIndex, mapRef]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      flyToStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex, flyToStepIndex]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

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
        setTourState("completed");
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
