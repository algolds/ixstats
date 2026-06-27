// src/lib/onoma/browser-speech.ts
// Onoma Lab — Browser Native Web Speech API wrapper

import { ipaToSpeechSpelling } from "./branding-utils";

// Map Onoma naming cultures to BCP-47 language codes
export const CULTURE_LANG: Record<string, string> = {
  latin: "la",
  germanic: "de-DE",
  celtic: "en-GB",
  slavic: "pl-PL",
  arabic: "en-US",
  "east-asian": "ja-JP",
  austronesian: "en-US",
  constructed: "en-US",
  any: "en-US",
};

/**
 * Pronounces a generated name using the browser's native window.speechSynthesis,
 * converting its IPA string to readable English syllable chunks.
 */
export function speakBrowserNative(
  name: string,
  ipa: string,
  culture: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return reject(new Error("Web Speech API SpeechSynthesis is not supported in this browser."));
    }

    try {
      window.speechSynthesis.cancel();

      const phoneticSpelling = ipaToSpeechSpelling(ipa) || name;
      const utterance = new SpeechSynthesisUtterance(phoneticSpelling);

      // Determine voice lang from naming culture
      const primaryCulture = culture ? culture.split("+")[0].toLowerCase().trim() : "any";
      const targetLang = CULTURE_LANG[primaryCulture] || "en-US";

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Fallback for browsers that load voices asynchronously
        utterance.lang = targetLang;
      } else {
        const matchedVoice = voices.find(
          (v) =>
            v.lang.toLowerCase() === targetLang.toLowerCase() ||
            v.lang.toLowerCase().startsWith(targetLang.split("-")[0].toLowerCase())
        );
        if (matchedVoice) {
          utterance.voice = matchedVoice;
        } else {
          utterance.lang = targetLang;
        }
      }

      // Configure natural rate and pitch
      const personalSpeed = typeof window !== "undefined" ? localStorage.getItem("onoma-personal-speed") : null;
      utterance.rate = personalSpeed ? Number(personalSpeed) : 0.82; // slightly slower for clean syllable articulation
      utterance.pitch = 1.05;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(`SpeechSynthesis error: ${e.error}`));

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Play a name's pronunciation: prefer Kokoro (phoneme mode from the IPA) when enabled,
 * otherwise (or on failure) fall back to the browser Web Speech voice.
 * Shared by the naming cards and the IPA Studio so playback behaves identically.
 */
export async function speakName(opts: {
  name: string;
  ipa: string;
  culture: string | null;
  kokoroEnabled: boolean;
  /** Explicit voice (per-name override). When omitted, the server resolves culture map → default. */
  voice?: string;
  /** The configured default voice, used only when forceDefaultVoice is set. */
  defaultVoice?: string;
  /** 🔊 Pronounce: read exact phonemes in the default voice (skip culture/per-name voice). */
  forceDefaultVoice?: boolean;
}): Promise<void> {
  const { name, ipa, culture, kokoroEnabled, voice, defaultVoice, forceDefaultVoice } = opts;

  if (kokoroEnabled) {
    try {
      const params = new URLSearchParams({ text: name, ipa });
      if (culture) params.set("culture", culture);

      // Read client personal overrides from localStorage
      let personalVoice = "";
      let personalSpeed = "";
      if (typeof window !== "undefined") {
        personalVoice = localStorage.getItem("onoma-personal-voice") || "";
        personalSpeed = localStorage.getItem("onoma-personal-speed") || "";
      }

      const chosen = forceDefaultVoice ? defaultVoice : (voice || personalVoice || undefined);
      if (chosen) params.set("voice", chosen); // explicit/personal voice -> server skips culture map
      if (personalSpeed) params.set("speed", personalSpeed); // personal speed override

      const res = await fetch(`/api/onoma/tts?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    } catch (err) {
      console.error("Kokoro TTS failed, falling back to browser speech:", err);
      // fall through to browser speech
    }
  }
  await speakBrowserNative(name, ipa, culture);
}
