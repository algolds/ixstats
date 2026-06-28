"use client";

// src/hooks/useWikiNarrator.ts
// Custom hook to manage full-article audio narration using Onoma Voice (Kokoro TTS).
// Splits the article DOM into clean text segments, manages sequential playback,
// pre-buffers future blocks, highlights active text, and bridges state/actions
// to the Dynamic Island (Halo) context.

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useIxMedia } from "~/hooks/useIxMedia";
import type { Media } from "~/lib/media/types";

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
    setNarratorState,
    registerNarratorActions,
    activeSectionId,
    setActiveSectionId,
  } = useWikiContext() as any;

  const { playTrack, registerPlaybackDelegate, updatePlaybackState } = useIxMedia();

  const [blocks, setBlocks] = useState<PlaybackBlock[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voice, setVoice] = useState("");

  // Create mediaTrack representing the article
  const mediaTrack = useMemo<Media>(() => {
    // Generate chapters from blocks of type "heading"
    const chaptersList: { title: string; startTime: number; endTime: number }[] = [];
    blocks.forEach((b, idx) => {
      if (b.type === "heading" || idx === 0) {
        const startTime = idx * 10;
        if (chaptersList.length > 0) {
          chaptersList[chaptersList.length - 1].endTime = startTime;
        }
        chaptersList.push({
          title: b.text,
          startTime,
          endTime: blocks.length * 10,
        });
      }
    });

    return {
      id: `wiki:${articleTitle || "article"}`,
      title: articleTitle || "Wiki Article",
      subtitle: "WikiOS Narration",
      type: "NARRATION",
      audioUrl: "", // plays locally
      duration: blocks.length * 10,
      transcript: blocks.map((b, idx) => ({
        startTime: idx * 10,
        endTime: (idx + 1) * 10,
        text: b.text,
      })),
      chapters: chaptersList,
      isDynamicTts: true,
    };
  }, [articleTitle, blocks]);

  const playRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const seekRef = useRef<(seconds: number) => void>(() => {});
  const setSpeedRef = useRef<(speed: number) => void>(() => {});

  // Expose a stable delegate memoized once
  const playbackDelegate = useMemo(
    () => ({
      play: () => playRef.current(),
      pause: () => pauseRef.current(),
      seek: (seconds: number) => seekRef.current(seconds),
      setSpeed: (s: number) => setSpeedRef.current(s),
    }),
    []
  );

  // Load public speech config (including Kokoro settings)
  const { data: config } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const activeIdxRef = useRef(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const highlightedElementRef = useRef<HTMLElement | null>(null);
  const isPlayingRef = useRef(false);
  const blocksRef = useRef<PlaybackBlock[]>([]);
  const activeFetchesRef = useRef<Map<string, Promise<Blob>>>(new Map());
  const transitionTimeoutRef = useRef<any>(null);
  const speedRef = useRef(1.0);
  const voiceRef = useRef("");

  const fetchAudioBlob = useCallback(async (requestUrl: string): Promise<Blob> => {
    if (activeFetchesRef.current.has(requestUrl)) {
      return activeFetchesRef.current.get(requestUrl)!;
    }

    const fetchPromise = (async () => {
      try {
        const hasCache = typeof window !== "undefined" && typeof caches !== "undefined";
        if (hasCache) {
          try {
            const cache = await caches.open("onoma-voice-cache");
            const cachedResponse = await cache.match(requestUrl);
            if (cachedResponse) {
              return await cachedResponse.blob();
            }
          } catch (err) {
            console.warn("[Narrator Cache Read Fail]:", err);
          }
        }

        const res = await fetch(requestUrl);
        if (!res.ok) {
          throw new Error("TTS API returned non-2xx");
        }

        if (hasCache) {
          try {
            const cache = await caches.open("onoma-voice-cache");
            await cache.put(requestUrl, res.clone());
          } catch (err) {
            console.warn("[Narrator Cache Write Fail]:", err);
          }
        }

        return await res.blob();
      } finally {
        activeFetchesRef.current.delete(requestUrl);
      }
    })();

    activeFetchesRef.current.set(requestUrl, fetchPromise);
    return fetchPromise;
  }, []);

  const preFetchBlocks = useCallback(
    async (index: number) => {
      const isKokoroEnabled = Boolean(config?.kokoro?.enabled);
      if (!isKokoroEnabled) return;

      const activeVoice = voiceRef.current || undefined;
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
          params.set("speed", String(speedRef.current));

          const requestUrl = `/api/onoma/tts?${params.toString()}`;
          // Trigger fetch in background and ignore failures
          fetchAudioBlob(requestUrl).catch(() => {});
        }
      }
    },
    [config, fetchAudioBlob]
  );

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

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  useEffect(() => {
    registerPlaybackDelegate(playbackDelegate);
    return () => {
      registerPlaybackDelegate(null);
    };
  }, [registerPlaybackDelegate, playbackDelegate]);

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
    return;
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

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setActiveIdx(-1);
    clearHighlight();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
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
    updatePlaybackState({
      isPlaying: false,
      currentTime: 0,
    });
  }, [clearHighlight, setNarratorState, updatePlaybackState]);

  // Synthesize and play block
  const playBlock = useCallback(
    async (index: number) => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      if (index < 0 || index >= blocksRef.current.length) {
        // Done reading article
        stopPlayback();
        notify.success("Finished reading article.");
        return;
      }

      setActiveIdx(index);
      const block = blocksRef.current[index];

      // Sync playback state initially for this block
      updatePlaybackState({
        currentTime: index * 10,
        duration: blocksRef.current.length * 10,
        isPlaying: true,
      });

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
        speed: speedRef.current,
        voice: voiceRef.current,
      });

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }

      const isKokoroEnabled = Boolean(config?.kokoro?.enabled);
      const activeVoice = voiceRef.current || undefined;

      try {
        if (isKokoroEnabled) {
          const params = new URLSearchParams({
            text: block.text,
            ipa: "",
          });
          const chosenVoice = activeVoice || config?.kokoro?.voice;
          if (chosenVoice) params.set("voice", chosenVoice);
          params.set("speed", String(speedRef.current));

          const requestUrl = `/api/onoma/tts?${params.toString()}`;

          // Pre-fetch N+1 and N+2
          preFetchBlocks(index);

          const blob = await fetchAudioBlob(requestUrl);
          if (!isPlayingRef.current || activeIdxRef.current !== index) {
            return;
          }
          const url = URL.createObjectURL(blob);
          activeAudioUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.ontimeupdate = () => {
            if (audioRef.current === audio) {
              const progress = audio.duration ? audio.currentTime / audio.duration : 0;
              const currentSecs = index * 10 + progress * 10;
              updatePlaybackState({
                currentTime: currentSecs,
                isPlaying: !audio.paused,
              });
            }
          };

          audio.onended = () => {
            if (activeAudioUrlRef.current === url) {
              URL.revokeObjectURL(url);
              activeAudioUrlRef.current = null;
            }
            if (isPlayingRef.current) {
              if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
              transitionTimeoutRef.current = setTimeout(
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
          utterance.rate = speedRef.current * 0.85;

          utterance.onend = () => {
            if (isPlayingRef.current) {
              if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
              transitionTimeoutRef.current = setTimeout(
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
        utterance.rate = speedRef.current * 0.85;
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
      updatePlaybackState,
      stopPlayback,
    ]
  );

  // Narrator Control Actions
  const play = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    playTrack(mediaTrack);
  }, [isPlaying, playTrack, mediaTrack]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.pause();
    }
    setNarratorState({ isPlaying: false });
    updatePlaybackState({ isPlaying: false });
  }, [setNarratorState, updatePlaybackState]);

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
      const targetIdx =
        idx !== -1 ? idx : blocksRef.current.findIndex((b) => b.sectionId === sectionId);
      if (targetIdx !== -1) {
        setIsPlaying(true);
        activeIdxRef.current = targetIdx;
        setActiveIdx(targetIdx);
        playTrack(mediaTrack);
      }
    },
    [playTrack, mediaTrack]
  );

  const changeSpeed = useCallback(
    (newSpeed: number) => {
      setSpeed(newSpeed);
      speedRef.current = newSpeed;
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
      voiceRef.current = newVoice;
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
      if (typeof window === "undefined" || typeof caches === "undefined") {
        notify.info("Voice narrator cache is not supported in this environment.");
        return;
      }
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

  useEffect(() => {
    playRef.current = () => {
      setIsPlaying(true);
      const idx = activeIdxRef.current === -1 ? 0 : activeIdxRef.current;
      playBlock(idx);
    };
    pauseRef.current = () => {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
      setNarratorState({ isPlaying: false });
      updatePlaybackState({ isPlaying: false });
    };
    seekRef.current = (seconds: number) => {
      const idx = Math.floor(seconds / 10);
      if (idx >= 0 && idx < blocksRef.current.length) {
        setIsPlaying(true);
        playBlock(idx);
      }
    };
    setSpeedRef.current = (s: number) => {
      changeSpeed(s);
    };
  }, [playBlock, changeSpeed, setNarratorState, updatePlaybackState]);

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
        activeIdxRef.current = idx;
        setActiveIdx(idx);
        playTrack(mediaTrack);
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
    clearVoiceCache,
    playTrack,
    mediaTrack,
  ]);

  // Halt playback and clear native audio / speech on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
