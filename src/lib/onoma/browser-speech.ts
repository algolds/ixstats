// src/lib/onoma/browser-speech.ts
// Onoma Lab — Browser Native Web Speech API wrapper

import { ipaToSpeechSpelling } from "./branding-utils";
import { withBasePath } from "~/lib/base-path";

// Map Onoma naming cultures to BCP-47 language codes
const CULTURE_LANG: Record<string, string> = {
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

/** The visitor's saved voice preference for `key`, or "" when unset (or outside the browser). */
const personal = (key: string): string =>
  typeof window === "undefined" ? "" : localStorage.getItem(`onoma-personal-${key}`) || "";

const personalNumber = (key: string, fallback: number): number => {
  const value = personal(key);
  return value ? Number(value) : fallback;
};

const PROSODY_PUNCTUATION: Record<string, string> = {
  exclamatory: "!",
  inquisitive: "?",
  mysterious: "...",
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

      const phoneticSpelling =
        (ipaToSpeechSpelling(ipa) || name) + (PROSODY_PUNCTUATION[personal("prosody")] ?? "");

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

      // Slightly slower than natural for clean syllable articulation
      utterance.rate = personalNumber("speed", 0.82);
      utterance.pitch = personalNumber("pitch", 1.05);
      if (personal("volume")) utterance.volume = personalNumber("volume", 1);

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(`SpeechSynthesis error: ${e.error}`));

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}

/** The voice the visitor mapped to this culture's primary family, if any. */
function cultureMappedVoice(culture: string | null): string {
  if (!culture) return "";
  try {
    const cultureMap = JSON.parse(personal("voice-map") || "{}");
    return cultureMap[culture.split("+")[0].toLowerCase().trim()] || "";
  } catch {
    return ""; // malformed personal voice map — use default voice selection
  }
}

interface SpeakNameOptions {
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
}

/** The TTS request: the name plus the visitor's personal voice settings. */
function ttsParams({
  name,
  ipa,
  culture,
  voice,
  defaultVoice,
  forceDefaultVoice,
}: SpeakNameOptions): URLSearchParams {
  const params = new URLSearchParams({ text: name, ipa });
  if (culture) params.set("culture", culture);

  const primaryBlend = personal("voice-blend-primary");
  const secondaryBlend = personal("voice-blend-secondary");
  const userDefaultVoice =
    personal("voice-blend-active") === "true" && primaryBlend && secondaryBlend
      ? `${primaryBlend}+${secondaryBlend}`
      : personal("voice");

  const chosen = forceDefaultVoice
    ? userDefaultVoice || defaultVoice || ""
    : voice || cultureMappedVoice(culture) || userDefaultVoice;

  if (chosen) params.set("voice", chosen); // explicit/personal voice -> server skips culture map
  const optionalParams: Array<[string, string]> = [
    ["speed", personal("speed")],
    ["model", personal("model")],
    ["phonemePrefix", personal("phoneme-prefix")],
  ];
  for (const [key, value] of optionalParams) if (value) params.set(key, value);
  if (personal("anglicize") === "false") params.set("anglicize", "false");
  if (personal("strip-stress") === "true") params.set("stripStress", "true");
  const prosody = personal("prosody");
  if (prosody && prosody !== "neutral") params.set("prosody", prosody);
  return params;
}

/**
 * Play a name's pronunciation: prefer Kokoro (phoneme mode from the IPA) when enabled,
 * otherwise (or on failure) fall back to the browser Web Speech voice.
 * Shared by the naming cards and the IPA Studio so playback behaves identically.
 */
export async function speakName(opts: SpeakNameOptions): Promise<void> {
  const { name, ipa, culture, kokoroEnabled } = opts;

  const useKokoro = kokoroEnabled && personal("force-native") !== "true";

  if (useKokoro) {
    try {
      const params = ttsParams(opts);

      const res = await fetch(withBasePath(`/api/onoma/tts?${params.toString()}`));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (personal("volume")) audio.volume = Number(personal("volume"));
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
