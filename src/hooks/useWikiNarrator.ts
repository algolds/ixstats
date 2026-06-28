"use client";

// src/hooks/useWikiNarrator.ts
// Custom hook to manage full-article audio narration using Onoma Voice (Kokoro TTS).
// Splits the article DOM into clean text segments, manages sequential playback,
// pre-buffers future blocks, highlights active text, and bridges state/actions
// to the Dynamic Island (Halo) context.

import { useEffect, useRef, useState, useCallback } from "react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { speakName } from "~/lib/onoma/browser-speech";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export interface PlaybackBlock {
  id: string; // DOM element ID or data-index key
  text: string; // Cleaned plain text to speak
  type: "heading" | "prose";
  sectionId?: string; // Nearest parent heading section ID
  element: HTMLElement;
}

export function useWikiNarrator(articleRef: React.RefObject<HTMLDivElement | null>) {
  const notify = useNotify();
  const {
    articleTitle,
    tocEntries,
    speechConfig,
    setNarratorState,
    registerNarratorActions,
    activeSectionId,
    setActiveSectionId,
  } = useWikiContext() as any;

  // Load public speech config (including Kokoro settings)
  const { data: config } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const [blocks, setBlocks] = useState<PlaybackBlock[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voice, setVoice] = useState("");

  const activeIdxRef = useRef(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const highlightedElementRef = useRef<HTMLElement | null>(null);
  const isPlayingRef = useRef(false);
  const blocksRef = useRef<PlaybackBlock[]>([]);
  const activeFetchesRef = useRef<Map<string, Promise<Blob>>>(new Map());

  const fetchAudioBlob = useCallback(async (requestUrl: string): Promise<Blob> => {
    if (activeFetchesRef.current.has(requestUrl)) {
      return activeFetchesRef.current.get(requestUrl)!;
    }

    const fetchPromise = (async () => {
      try {
        const cache = await caches.open("onoma-voice-cache");
        const cachedResponse = await cache.match(requestUrl);
        if (cachedResponse) {
          return await cachedResponse.blob();
        }

        const res = await fetch(requestUrl);
        if (!res.ok) {
          throw new Error("TTS API returned non-2xx");
        }

        // Store cloned response in Cache API
        await cache.put(requestUrl, res.clone());
        return await res.blob();
      } finally {
        activeFetchesRef.current.delete(requestUrl);
      }
    })();

    activeFetchesRef.current.set(requestUrl, fetchPromise);
    return fetchPromise;
  }, []);

  const preFetchBlocks = useCallback(async (index: number) => {
    const isKokoroEnabled = Boolean(config?.kokoro?.enabled);
    if (!isKokoroEnabled) return;

    const activeVoice = voice || undefined;
    const chosenVoice = activeVoice || config?.kokoro?.voice;

    for (let i = 1; i <= 2; i++) {
      const nextIdx = index + i;
      if (nextIdx < blocksRef.current.length) {
        const block = blocksRef.current[nextIdx];
        const params = new URLSearchParams({
          text: block.text,
          ipa: "",
        });
        const finalVoice = chosenVoice;
        if (finalVoice) params.set("voice", finalVoice);
        params.set("speed", String(speed));

        const requestUrl = `/api/onoma/tts?${params.toString()}`;
        // Trigger fetch in background and ignore failures
        fetchAudioBlob(requestUrl).catch(() => {});
      }
    }
  }, [config, speed, voice, fetchAudioBlob]);

  // Local storage personal preferences loading
  useEffect(() => {
    if (typeof window !== "undefined") {
      const personalVoice = localStorage.getItem("onoma-personal-voice") || "";
      const personalSpeed = localStorage.getItem("onoma-personal-speed");
      setVoice(personalVoice);
      setSpeed(personalSpeed ? Number(personalSpeed) : 1.0);
    }
  }, []);

  // Sync refs to avoid stale closures in callbacks
  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Clean raw HTML content
  const cleanContentText = (text: string): string => {
    return text
      .replace(/\[\d+\]/g, "") // remove [1], [2] citation brackets
      .replace(/\[citation needed\]/gi, "")
      .replace(/\[edit\]/gi, "")
      .trim();
  };

  // Re-build text blocks when article DOM renders
  const rebuildBlocks = useCallback(() => {
    if (!articleRef.current) return;
    const container = articleRef.current;

    // Find all headings, paragraphs, and list items
    const elements = Array.from(container.querySelectorAll("h2, h3, h4, p, li")) as HTMLElement[];

    const validBlocks: PlaybackBlock[] = [];
    let currentSectionId = "";

    elements.forEach((el, index) => {
      // Exclude elements inside infoboxes, sidebars, coordinates, nav boxes, math, etc.
      if (
        el.closest(".infobox") ||
        el.closest(".aside") ||
        el.closest(".sidebar") ||
        el.closest(".navbox") ||
        el.closest(".reflist") ||
        el.closest(".coordinates") ||
        el.closest(".wikios-ixworld-loading") ||
        el.closest("table")
      ) {
        return;
      }

      // Read cleaned text content
      const clean = cleanContentText(el.textContent || "");
      if (!clean) return;

      const isHeading = el.tagName.startsWith("H");

      if (isHeading) {
        currentSectionId = el.id || `heading-${index}`;
      }

      // Add a unique identifier class to bind the DOM element
      const blockId = `wikios-narrator-block-${index}`;
      el.setAttribute("data-narrator-block", blockId);

      validBlocks.push({
        id: blockId,
        text: clean,
        type: isHeading ? "heading" : "prose",
        sectionId: currentSectionId || undefined,
        element: el,
      });
    });

    setBlocks(validBlocks);
    setActiveIdx(-1);
    setNarratorState({
      isPlaying: false,
      activeBlockIndex: 0,
      totalBlocks: validBlocks.length,
      activeText: "",
      activeSectionTitle: "",
      speed,
      voice,
    });
  }, [articleRef, setNarratorState, speed, voice]);

  // Sync blocks on articleTitle load
  useEffect(() => {
    if (articleTitle) {
      // short delay to let article content mount completely
      const timer = setTimeout(rebuildBlocks, 500);
      return () => clearTimeout(timer);
    }
  }, [articleTitle, rebuildBlocks]);

  // Clean highlighting
  const clearHighlight = useCallback(() => {
    if (highlightedElementRef.current) {
      highlightedElementRef.current.classList.remove(
        "wikios-narrator-active-block",
        "border-l-4",
        "border-[#0091ff]",
        "pl-3",
        "bg-[#0091ff]/5",
        "transition-all",
        "duration-300"
      );
      highlightedElementRef.current = null;
    }
  }, []);

  // Highlight block
  const highlightBlock = useCallback(
    (el: HTMLElement) => {
      clearHighlight();
      el.classList.add(
        "wikios-narrator-active-block",
        "border-l-4",
        "border-[#0091ff]",
        "pl-3",
        "bg-[#0091ff]/5",
        "transition-all",
        "duration-300"
      );
      highlightedElementRef.current = el;

      // Check if auto-scroll is enabled in localStorage
      const autoScroll = localStorage.getItem("onoma-narrator-autoscroll") !== "false";
      if (autoScroll) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [clearHighlight]
  );

  // Synthesize and play block
  const playBlock = useCallback(
    async (index: number) => {
      if (index < 0 || index >= blocksRef.current.length) {
        // Done reading article
        stopPlayback();
        notify.success("Finished reading article.");
        return;
      }

      setActiveIdx(index);
      const block = blocksRef.current[index];

      // Highlight block UI
      highlightBlock(block.element);

      // Sync active section id in WikiContext
      if (block.sectionId) {
        setActiveSectionId(block.sectionId);
      }

      // Determine Nearest Heading Section text
      let nearestSectionText = "";
      for (let i = index; i >= 0; i--) {
        if (blocksRef.current[i].type === "heading") {
          nearestSectionText = blocksRef.current[i].text;
          break;
        }
      }

      // Sync state with Dynamic Island
      setNarratorState({
        isPlaying: true,
        activeBlockIndex: index + 1,
        totalBlocks: blocksRef.current.length,
        activeText: block.text,
        activeSectionTitle: nearestSectionText || "Overview",
        speed,
        voice,
      });

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const isKokoroEnabled = Boolean(config?.kokoro?.enabled);
      const activeVoice = voice || undefined;

      try {
        if (isKokoroEnabled) {
          const params = new URLSearchParams({
            text: block.text,
            ipa: "",
          });
          const chosenVoice = activeVoice || config?.kokoro?.voice;
          if (chosenVoice) params.set("voice", chosenVoice);
          params.set("speed", String(speed));

          const requestUrl = `/api/onoma/tts?${params.toString()}`;

          // Pre-fetch N+1 and N+2
          preFetchBlocks(index);

          const blob = await fetchAudioBlob(requestUrl);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (isPlayingRef.current) {
              setTimeout(
                () => {
                  if (isPlayingRef.current) {
                    playBlock(activeIdxRef.current + 1);
                  }
                },
                block.type === "heading" ? 600 : 350
              );
            }
          };

          await audio.play();
        } else {
          // Fallback to browser SpeechSynthesis
          const phonetic = block.text;
          const utterance = new SpeechSynthesisUtterance(phonetic);
          utterance.rate = speed * 0.85;

          utterance.onend = () => {
            if (isPlayingRef.current) {
              setTimeout(
                () => {
                  if (isPlayingRef.current) {
                    playBlock(activeIdxRef.current + 1);
                  }
                },
                block.type === "heading" ? 600 : 350
              );
            }
          };

          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      } catch (err: any) {
        console.warn(
          "[Narrator Synthesis Fallback] TTS API fell back to browser speech. Error:",
          err?.message || err
        );
        // Fallback to browser speech directly
        const utterance = new SpeechSynthesisUtterance(block.text);
        utterance.rate = speed * 0.85;
        utterance.onend = () => {
          if (isPlayingRef.current) {
            playBlock(activeIdxRef.current + 1);
          }
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    },
    [
      config,
      speed,
      voice,
      highlightBlock,
      setNarratorState,
      setActiveSectionId,
      notify,
      preFetchBlocks,
      fetchAudioBlob,
    ]
  );

  // Narrator Control Actions
  const play = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    const startIdx = activeIdx === -1 ? 0 : activeIdx;
    playBlock(startIdx);
  }, [isPlaying, activeIdx, playBlock]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setNarratorState({ isPlaying: false });
  }, [setNarratorState]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setActiveIdx(-1);
    clearHighlight();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setNarratorState({
      isPlaying: false,
      activeBlockIndex: 0,
      activeText: "",
      activeSectionTitle: "",
    });
  }, [clearHighlight, setNarratorState]);

  const skipNext = useCallback(() => {
    const nextIdx = activeIdx + 1;
    if (nextIdx < blocks.length) {
      playBlock(nextIdx);
    }
  }, [activeIdx, blocks, playBlock]);

  const skipPrev = useCallback(() => {
    const prevIdx = activeIdx - 1;
    if (prevIdx >= 0) {
      playBlock(prevIdx);
    }
  }, [activeIdx, playBlock]);

  const jumpToSection = useCallback(
    (sectionId: string) => {
      const idx = blocksRef.current.findIndex(
        (b) => b.sectionId === sectionId && b.type === "heading"
      );
      if (idx !== -1) {
        setIsPlaying(true);
        playBlock(idx);
      } else {
        // Find paragraph under that section if no heading
        const paraIdx = blocksRef.current.findIndex((b) => b.sectionId === sectionId);
        if (paraIdx !== -1) {
          setIsPlaying(true);
          playBlock(paraIdx);
        }
      }
    },
    [playBlock]
  );

  const changeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      localStorage.setItem("onoma-personal-speed", String(newSpeed));
      setNarratorState({ speed: newSpeed });
      if (isPlayingRef.current) {
        // Re-trigger current block to apply speed changes
        playBlock(activeIdxRef.current);
      }
    },
    [playBlock, setNarratorState]
  );

  const changeVoice = useCallback(
    (newVoice: string) => {
      setVoice(newVoice);
      localStorage.setItem("onoma-personal-voice", newVoice);
      setNarratorState({ voice: newVoice });
      if (isPlayingRef.current) {
        // Re-trigger current block to apply voice changes
        playBlock(activeIdxRef.current);
      }
    },
    [playBlock, setNarratorState]
  );

  const clearVoiceCache = useCallback(async () => {
    try {
      const deleted = await caches.delete("onoma-voice-cache");
      if (deleted) {
        notify.success("Voice narrator cache cleared.");
      } else {
        notify.info("Voice narrator cache is already empty.");
      }
    } catch (err) {
      console.warn("Failed to clear voice cache:", err);
      notify.error("Failed to clear voice narrator cache.");
    }
  }, [notify]);

  // Register action hooks in global WikiContext
  useEffect(() => {
    registerNarratorActions({
      play,
      pause,
      stop: stopPlayback,
      skipNext,
      skipPrev,
      setSpeed: changeSpeed,
      setVoice: changeVoice,
      jumpToSection,
      jumpToBlock: (idx: number) => {
        setIsPlaying(true);
        playBlock(idx);
      },
      clearCache: clearVoiceCache,
    });
    return () => registerNarratorActions(null);
  }, [
    registerNarratorActions,
    play,
    pause,
    stopPlayback,
    skipNext,
    skipPrev,
    changeSpeed,
    changeVoice,
    jumpToSection,
    playBlock,
    clearVoiceCache,
  ]);

  return {
    blocks,
    activeIdx,
    isPlaying,
    speed,
    voice,
    play,
    pause,
    stop: stopPlayback,
    skipNext,
    skipPrev,
    setSpeed: changeSpeed,
    setVoice: changeVoice,
    clearCache: clearVoiceCache,
  };
}
