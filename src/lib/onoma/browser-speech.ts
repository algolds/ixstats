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
      utterance.rate = 0.82; // slightly slower for clean syllable articulation
      utterance.pitch = 1.05;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(`SpeechSynthesis error: ${e.error}`));

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      reject(err);
    }
  });
}
