export const play = jest.fn();
export const bind = jest.fn(() => () => {});
export const setEnabled = jest.fn();
export const setVolume = jest.fn();
export const sounds = [
  "press",
  "release",
  "toggle",
  "tick",
  "chime",
  "whisper",
  "bloom",
  "droplet",
  "page",
  "scan",
  "loading",
  "ready",
  "arrival",
  "pulse",
  "sparkle",
  "success",
  "error",
] as const;
export type SoundName = (typeof sounds)[number];
