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

  const playTrack = useCallback((track: Media) => {
    if (!engineRef.current) return;
    setActiveTrack(track);
    engineRef.current.load(track.audioUrl, speed);
    engineRef.current.play().catch(console.warn);
  }, [speed]);

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

  useEffect(() => {
    engineRef.current = new IxMediaEngine();
    const engine = engineRef.current;

    engine.addEventListener("statechange", (state: string) => setIsPlaying(state === "playing"));
    engine.addEventListener("timeupdate", (time: number) => setCurrentTime(time));
    engine.addEventListener("durationchange", (dur: number) => setDuration(dur));
    engine.addEventListener("ended", () => skipNextRef.current());

    // Load settings
    const savedSettings = localStorage.getItem("ixmedia:settings");
    if (savedSettings) {
      try {
        const { v, s } = JSON.parse(savedSettings);
        setVolume(v ?? 0.8);
        setSpeed(s ?? 1.0);
        engine.setVolume(v ?? 0.8);
        engine.setSpeed(s ?? 1.0);
      } catch (e) {
        console.warn("Failed to parse ixmedia settings", e);
      }
    }
  }, []);

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
