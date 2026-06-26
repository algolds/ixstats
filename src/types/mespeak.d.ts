// meSpeak (asm.js eSpeak) ships no types. Onoma uses loadConfig/loadVoice/speak.
declare module "mespeak" {
  interface MeSpeak {
    loadConfig(url: string): void;
    loadVoice(url: string, callback?: (success: boolean | string, message?: string) => void): void;
    speak(text: string, options?: Record<string, unknown>): unknown;
    isConfigLoaded(): boolean;
    isVoiceLoaded(id: string): boolean;
  }
  const meSpeak: MeSpeak;
  export default meSpeak;
}
