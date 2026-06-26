// src/lib/onoma/mespeak-loader.ts
// Onoma Lab — meSpeak (asm.js eSpeak) lazy loader, browser-only (Phase 7).
// Synthesizes a name from the IPA the phonology engine produced, using a
// culture-matched eSpeak voice. The heavy engine + voice JSON load on first use
// and are cached. Any failure falls back to native Web Speech.

import { ipaToEspeak, voiceForCulture, getSpeechConfig } from "./speech";
import { withBasePath } from "~/lib/base-path";

const assetUrl = (p: string) => withBasePath(`/onoma/mespeak/${p}`);

let enginePromise: Promise<any> | null = null;
const loadedVoices = new Set<string>();

async function getEngine(): Promise<any> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod: any = await import("mespeak");
      const meSpeak = mod.default ?? mod;
      meSpeak.loadConfig(assetUrl("mespeak_config.json")); // queues until ready
      return meSpeak;
    })();
  }
  return enginePromise;
}

function ensureVoice(meSpeak: any, voiceId: string): Promise<void> {
  if (loadedVoices.has(voiceId)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // voice_id maps 1:1 to its file path, e.g. "la" → voices/la.json, "en/en" → voices/en/en.json
    meSpeak.loadVoice(assetUrl(`voices/${voiceId}.json`), (ok: boolean | string) => {
      if (ok === true) {
        loadedVoices.add(voiceId);
        resolve();
      } else {
        reject(new Error(`meSpeak voice load failed: ${voiceId}`));
      }
    });
  });
}

function webSpeechFallback(name: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(name);
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

/**
 * Speak a name via eSpeak phonemes derived from its IPA, in a culture-matched voice.
 * Falls back to native Web Speech (spelled name) on any error.
 */
export async function speakName(name: string, ipa: string, culture: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const meSpeak = await getEngine();
    const voice = voiceForCulture(culture);
    await ensureVoice(meSpeak, voice);
    const c = getSpeechConfig();
    const opts: Record<string, unknown> = {
      voice,
      speed: c.speed,
      pitch: c.pitch,
      amplitude: c.amplitude,
      wordgap: c.wordgap,
      ...(c.variant ? { variant: c.variant } : {}),
    };
    const phonemes = ipaToEspeak(ipa);
    if (phonemes) meSpeak.speak(`[[${phonemes}]]`, opts);
    else meSpeak.speak(name, opts); // no IPA → let eSpeak's letter-to-sound handle it
  } catch {
    webSpeechFallback(name);
  }
}
