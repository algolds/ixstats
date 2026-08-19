// src/lib/onoma/browser-speech.ts
// Onoma Lab — Browser Native Web Speech API wrapper

import { ipaToSpeechSpelling } from "./branding-utils";
import { withBasePath } from "~/lib/base-path";

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

      const personalProsody =
        typeof window !== "undefined"
          ? localStorage.getItem("onoma-personal-prosody") || "neutral"
          : "neutral";
      let phoneticSpelling = ipaToSpeechSpelling(ipa) || name;
      if (personalProsody === "exclamatory") phoneticSpelling += "!";
      else if (personalProsody === "inquisitive") phoneticSpelling += "?";
      else if (personalProsody === "mysterious") phoneticSpelling += "...";

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
      const personalSpeed =
        typeof window !== "undefined" ? localStorage.getItem("onoma-personal-speed") : null;
      utterance.rate = personalSpeed ? Number(personalSpeed) : 0.82; // slightly slower for clean syllable articulation

      const personalPitch =
        typeof window !== "undefined" ? localStorage.getItem("onoma-personal-pitch") : null;
      utterance.pitch = personalPitch ? Number(personalPitch) : 1.05;

      const personalVolume =
        typeof window !== "undefined" ? localStorage.getItem("onoma-personal-volume") : null;
      if (personalVolume) {
        utterance.volume = Number(personalVolume);
      }

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

  const forceNative =
    typeof window !== "undefined" && localStorage.getItem("onoma-personal-force-native") === "true";
  const useKokoro = kokoroEnabled && !forceNative;

  if (useKokoro) {
    try {
      const params = new URLSearchParams({ text: name, ipa });
      if (culture) params.set("culture", culture);

      // Read client personal overrides from localStorage
      let personalVoice = "";
      let personalSpeed = "";
      let personalModel = "";
      let personalVolume = "";
      let personalVoiceMap = "";
      let personalAnglicize = "";
      let personalPhonemePrefix = "";
      let personalStripStress = "";
      let personalProsody = "";
      let voiceBlendActive = "";
      let voiceBlendPrimary = "";
      let voiceBlendSecondary = "";

      if (typeof window !== "undefined") {
        personalVoice = localStorage.getItem("onoma-personal-voice") || "";
        personalSpeed = localStorage.getItem("onoma-personal-speed") || "";
        personalModel = localStorage.getItem("onoma-personal-model") || "";
        personalVolume = localStorage.getItem("onoma-personal-volume") || "";
        personalVoiceMap = localStorage.getItem("onoma-personal-voice-map") || "";
        personalAnglicize = localStorage.getItem("onoma-personal-anglicize") || "";
        personalPhonemePrefix = localStorage.getItem("onoma-personal-phoneme-prefix") || "";
        personalStripStress = localStorage.getItem("onoma-personal-strip-stress") || "";
        personalProsody = localStorage.getItem("onoma-personal-prosody") || "";
        voiceBlendActive = localStorage.getItem("onoma-personal-voice-blend-active") || "";
        voiceBlendPrimary = localStorage.getItem("onoma-personal-voice-blend-primary") || "";
        voiceBlendSecondary = localStorage.getItem("onoma-personal-voice-blend-secondary") || "";
      }

      // Determine the resolved default/fallback voice for the user
      let resolvedUserDefaultVoice = personalVoice;
      if (voiceBlendActive === "true" && voiceBlendPrimary && voiceBlendSecondary) {
        resolvedUserDefaultVoice = `${voiceBlendPrimary}+${voiceBlendSecondary}`;
      }

      // Resolve the actual chosen voice
      let chosen = "";
      if (forceDefaultVoice) {
        chosen = resolvedUserDefaultVoice || defaultVoice || "";
      } else if (voice) {
        chosen = voice;
      } else {
        // Check per-culture mappings override first
        let cultureMappedVoice = "";
        if (culture) {
          try {
            const cultureMap = JSON.parse(personalVoiceMap || "{}");
            const primaryCulture = culture.split("+")[0].toLowerCase().trim();
            if (cultureMap[primaryCulture]) {
              cultureMappedVoice = cultureMap[primaryCulture];
            }
          } catch {}
        }
        chosen = cultureMappedVoice || resolvedUserDefaultVoice || "";
      }

      if (chosen) params.set("voice", chosen); // explicit/personal voice -> server skips culture map
      if (personalSpeed) params.set("speed", personalSpeed); // personal speed override
      if (personalModel) params.set("model", personalModel); // personal model override
      if (personalAnglicize === "false") params.set("anglicize", "false");
      if (personalPhonemePrefix) params.set("phonemePrefix", personalPhonemePrefix);
      if (personalStripStress === "true") params.set("stripStress", "true");
      if (personalProsody && personalProsody !== "neutral") params.set("prosody", personalProsody);

      const res = await fetch(withBasePath(`/api/onoma/tts?${params.toString()}`));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (personalVolume) audio.volume = Number(personalVolume);
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
