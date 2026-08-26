"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { IxMediaEngine } from "~/lib/media/IxMediaEngine";
import type { Media } from "~/lib/media/types";

export interface PlaybackDelegate {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setSpeed?: (speed: number) => void;
}

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
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  skipNext: () => void;
  skipPrevious: () => void;
  registerPlaybackDelegate: (delegate: PlaybackDelegate | null) => void;
  updatePlaybackState: (
    state: Partial<{ currentTime: number; duration: number; isPlaying: boolean }>
  ) => void;
}

const MediaContext = createContext<MediaContextState>({} as any);

export function MediaContextProvider({ children }: { children: React.ReactNode }) {
  const engineRef = useRef<IxMediaEngine | null>(null);
  const activeDelegateRef = useRef<PlaybackDelegate | null>(null);
  const [activeTrack, setActiveTrack] = useState<Media | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1.0);
  const [queue, setQueue] = useState<Media[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [hasLoaded, setHasLoaded] = useState(false);

  const playTrack = useCallback(
    (track: Media) => {
      // oxlint-disable-next-line eslint/no-unused-vars
      const isSameTrack = activeTrack && activeTrack.id === track.id;
      const isDelegatedTrack = track.isDynamicTts || track.id.startsWith("wiki:");

      if (isDelegatedTrack) {
        if (activeDelegateRef.current) {
          engineRef.current?.pause();
          setActiveTrack(track);
          const idx = queue.findIndex((t) => t.id === track.id);
          setCurrentIndex(idx);
          activeDelegateRef.current.play();
          return;
        } else {
          console.warn("Attempted to play delegated track, but no delegate is registered.");
          return;
        }
      } else {
        if (activeDelegateRef.current) {
          activeDelegateRef.current.pause();
        }
      }

      setActiveTrack(track);

      const idx = queue.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }

      if (!engineRef.current) return;
      engineRef.current.load(track.audioUrl, speed);
      engineRef.current.play().catch(console.warn);
    },
    [activeTrack, speed, queue]
  );

  const pauseTrack = useCallback(() => {
    const isDelegatedActive =
      activeTrack && (activeTrack.isDynamicTts || activeTrack.id.startsWith("wiki:"));
    if (activeDelegateRef.current && isDelegatedActive) {
      activeDelegateRef.current.pause();
      return;
    }
    engineRef.current?.pause();
  }, [activeTrack]);

  const resumeTrack = useCallback(() => {
    const isDelegatedActive =
      activeTrack && (activeTrack.isDynamicTts || activeTrack.id.startsWith("wiki:"));
    if (activeDelegateRef.current && isDelegatedActive) {
      activeDelegateRef.current.play();
      return;
    }
    engineRef.current?.play().catch(console.warn);
  }, [activeTrack]);

  const seekTrack = useCallback(
    (seconds: number) => {
      const isDelegatedActive =
        activeTrack && (activeTrack.isDynamicTts || activeTrack.id.startsWith("wiki:"));
      if (activeDelegateRef.current && isDelegatedActive) {
        activeDelegateRef.current.seek(seconds);
        return;
      }
      engineRef.current?.seek(seconds);
    },
    [activeTrack]
  );

  const changeVolume = useCallback(
    (v: number) => {
      setVolume(v);
      engineRef.current?.setVolume(v);
      localStorage.setItem("ixmedia:settings", JSON.stringify({ v, s: speed }));
    },
    [speed]
  );

  const changeSpeed = useCallback(
    (s: number) => {
      setSpeed(s);
      const isDelegatedActive =
        activeTrack && (activeTrack.isDynamicTts || activeTrack.id.startsWith("wiki:"));
      if (activeDelegateRef.current?.setSpeed && isDelegatedActive) {
        activeDelegateRef.current.setSpeed(s);
      } else {
        engineRef.current?.setSpeed(s);
      }
      localStorage.setItem("ixmedia:settings", JSON.stringify({ v: volume, s }));
    },
    [volume, activeTrack]
  );

  const addToQueue = useCallback((track: Media) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback(
    (indexToRemove: number) => {
      setQueue((prev) => prev.filter((_, idx) => idx !== indexToRemove));

      setCurrentIndex((prevIdx) => {
        if (indexToRemove === prevIdx) {
          pauseTrack();
          return -1;
        }
        if (indexToRemove < prevIdx) {
          return prevIdx - 1;
        }
        return prevIdx;
      });
    },
    [pauseTrack]
  );

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

  const registerPlaybackDelegate = useCallback((delegate: PlaybackDelegate | null) => {
    activeDelegateRef.current = delegate;
  }, []);

  const updatePlaybackState = useCallback(
    (state: Partial<{ currentTime: number; duration: number; isPlaying: boolean }>) => {
      if (state.currentTime !== undefined) setCurrentTime(state.currentTime);
      if (state.duration !== undefined) setDuration(state.duration);
      if (state.isPlaying !== undefined) setIsPlaying(state.isPlaying);
    },
    []
  );

  // Keep a ref to the latest skipNext function to avoid stale closures in the ended listener
  const skipNextRef = useRef(skipNext);
  useEffect(() => {
    skipNextRef.current = skipNext;
  }, [skipNext]);

  // Mount effect to initialize engine, listeners, and load settings/session
  useEffect(() => {
    engineRef.current = new IxMediaEngine();
    const engine = engineRef.current;

    const handleStateChange = (state: string) => {
      // If we have an active delegate, do not let engine state events override the delegate's playback state.
      if (activeDelegateRef.current) return;
      setIsPlaying(state === "playing");
    };
    const handleTimeUpdate = (time: number) => {
      if (activeDelegateRef.current) return;
      setCurrentTime(time);
    };
    const handleDurationChange = (dur: number) => {
      if (activeDelegateRef.current) return;
      setDuration(dur);
    };
    const handleEnded = () => {
      if (activeDelegateRef.current) return;
      skipNextRef.current();
    };

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
        registerPlaybackDelegate,
        updatePlaybackState,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
}

export function useIxMedia() {
  return useContext(MediaContext);
}
