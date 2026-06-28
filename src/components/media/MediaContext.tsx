"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { IxMediaEngine } from "~/lib/media/IxMediaEngine";
import type { Media } from "~/lib/media/types";

export interface MediaContextState {
  activeTrack: Media | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  speed: number;
  queue: Media[];
  currentIndex: number;

  playTrack: (track: Media) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  seekTrack: (seconds: number) => void;
  changeVolume: (volume: number) => void;
  changeSpeed: (speed: number) => void;
  addToQueue: (track: Media) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
}

const MediaContext = createContext<MediaContextState>({} as any);

export function MediaContextProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<IxMediaEngine | null>(null);
  const [activeTrack, setActiveTrack] = useState<Media | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1.0);
  const [queue, setQueue] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [hasLoaded, setHasLoaded] = useState(false);

  const playTrack = useCallback((track: Media) => {
    if (!engineRef.current) return;
    setActiveTrack(track);

    const idx = queue.findIndex((t) => t.id === track.id);
    if (idx !== -1) {
      setCurrentIndex(idx);
    }

    engineRef.current.load(track.audioUrl, speed);
    engineRef.current.play().catch(console.warn);
  }, [speed, queue]);

  const pauseTrack = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const resumeTrack = useCallback(() => {
    engineRef.current?.play().catch(console.warn);
  }, []);

  const seekTrack = useCallback((seconds: number) => {
    engineRef.current?.seek(seconds);
  }, []);

  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
    localStorage.setItem("ixmedia:settings", JSON.stringify({ v, s: speed }));
  }, [speed]);

  const changeSpeed = useCallback((s: number) => {
    setSpeed(s);
    engineRef.current?.setSpeed(s);
    localStorage.setItem("ixmedia:settings", JSON.stringify({ v: volume, s }));
  }, [volume]);

  const addToQueue = useCallback((track: Media) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
  }, []);

  const skipNext = useCallback(() => {
    if (queue.length === 0 || currentIndex >= queue.length - 1) return;
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    playTrack(queue[nextIdx]);
  }, [queue, currentIndex, playTrack]);

  const skipPrevious = useCallback(() => {
    if (currentIndex <= 0 || queue.length === 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    playTrack(queue[prevIdx]);
  }, [queue, currentIndex, playTrack]);

  // Keep a ref to the latest skipNext function to avoid stale closures in the ended listener
  const skipNextRef = useRef(skipNext);
  useEffect(() => {
    skipNextRef.current = skipNext;
  }, [skipNext]);

  // Mount effect to initialize engine, listeners, and load settings/session
  useEffect(() => {
    engineRef.current = new IxMediaEngine();
    const engine = engineRef.current;

    const handleStateChange = (state: string) => setIsPlaying(state === "playing");
    const handleTimeUpdate = (time: number) => setCurrentTime(time);
    const handleDurationChange = (dur: number) => setDuration(dur);
    const handleEnded = () => skipNextRef.current();

    engine.addEventListener("statechange", handleStateChange);
    engine.addEventListener("timeupdate", handleTimeUpdate);
    engine.addEventListener("durationchange", handleDurationChange);
    engine.addEventListener("ended", handleEnded);

    // Load settings
    let loadedSpeed = 1.0;
    const savedSettings = localStorage.getItem("ixmedia:settings");
    if (savedSettings) {
      try {
        const { v, s } = JSON.parse(savedSettings);
        setVolume(v ?? 0.8);
        setSpeed(s ?? 1.0);
        loadedSpeed = s ?? 1.0;
        engine.setVolume(v ?? 0.8);
        engine.setSpeed(s ?? 1.0);
      } catch (e) {
        console.warn("Failed to parse ixmedia settings", e);
      }
    }

    // Load session
    const savedSession = localStorage.getItem("ixmedia:session");
    if (savedSession) {
      try {
        const { q, idx, active } = JSON.parse(savedSession);
        if (q) setQueue(q);
        if (idx !== undefined) setCurrentIndex(idx);
        if (active) {
          setActiveTrack(active);
          engine.load(active.audioUrl, loadedSpeed);
        }
      } catch (e) {
        console.warn("Failed to parse ixmedia session", e);
      }
    }

    setHasLoaded(true);

    return () => {
      engine.pause();
      engine.removeEventListener("statechange", handleStateChange);
      engine.removeEventListener("timeupdate", handleTimeUpdate);
      engine.removeEventListener("durationchange", handleDurationChange);
      engine.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Sync session to localStorage whenever queue, currentIndex, or activeTrack changes (after load)
  useEffect(() => {
    if (!hasLoaded) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "ixmedia:session",
        JSON.stringify({
          q: queue,
          idx: currentIndex,
          active: activeTrack,
        })
      );
    }
  }, [queue, currentIndex, activeTrack, hasLoaded]);

  return (
    <MediaContext.Provider
      value={{
        activeTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        speed,
        queue,
        currentIndex,
        playTrack,
        pauseTrack,
        resumeTrack,
        seekTrack,
        changeVolume,
        changeSpeed,
        addToQueue,
        removeFromQueue,
        clearQueue,
        skipNext,
        skipPrevious,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
}

export function useIxMedia() {
  return useContext(MediaContext);
}
