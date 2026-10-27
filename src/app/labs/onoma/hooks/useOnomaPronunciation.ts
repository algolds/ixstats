"use client";

// src/app/labs/onoma/hooks/useOnomaPronunciation.ts
// Encapsulated brand audio pronunciation interaction hook for Onoma

import { useState, useCallback, useEffect } from "react";
import { speakName } from "~/lib/onoma/browser-speech";

interface UseOnomaPronunciationOptions {
  kokoroEnabled?: boolean;
  kokoroVoice?: string;
}

export function useOnomaPronunciation({
  kokoroEnabled = false,
  kokoroVoice,
}: UseOnomaPronunciationOptions = {}) {
  const [hasInteractedPronunciation, setHasInteractedPronunciation] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const sessionTried = sessionStorage.getItem("onoma-pronunciation-interacted");
      if (!sessionTried) {
        setHasInteractedPronunciation(false);
        // Automatically settle to quiet state after 2 pulses (2.4s)
        timer = setTimeout(() => {
          setHasInteractedPronunciation(true);
          try {
            sessionStorage.setItem("onoma-pronunciation-interacted", "true");
          } catch {
            // Safe fallback
          }
        }, 2400);
      } else {
        setHasInteractedPronunciation(true);
      }
    } catch {
      setHasInteractedPronunciation(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const playPronunciation = useCallback(async () => {
    if (!hasInteractedPronunciation) {
      setHasInteractedPronunciation(true);
      try {
        sessionStorage.setItem("onoma-pronunciation-interacted", "true");
      } catch {
        // Safe fallback
      }
    }

    if (kokoroEnabled) {
      try {
        await speakName({
          name: "Onoma",
          ipa: "ˈɒnəmə",
          culture: "constructed",
          kokoroEnabled: true,
          defaultVoice: kokoroVoice,
        });
        return;
      } catch (err) {
        console.error(
          "Kokoro TTS failed for hero pronunciation, falling back to browser speech:",
          err
        );
      }
    }

    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance();
    const voices = window.speechSynthesis.getVoices();
    const greekVoice = voices.find((v) => v.lang.startsWith("el-") || v.lang.includes("Greek"));
    if (greekVoice) {
      utterance.voice = greekVoice;
      utterance.text = "Όνομα";
      utterance.lang = "el-GR";
    } else {
      utterance.text = "OH-nuh-muh";
      utterance.lang = "en-US";
      const englishVoice = voices.find(
        (v) => v.lang.startsWith("en-") || v.lang.includes("English")
      );
      if (englishVoice) utterance.voice = englishVoice;
    }
    utterance.rate = 0.82;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [hasInteractedPronunciation, kokoroEnabled, kokoroVoice]);

  return {
    hasInteractedPronunciation,
    setHasInteractedPronunciation,
    playPronunciation,
  };
}
