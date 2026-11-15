// cuelume 0.2.8: the fourteen canonical cues and the public API, as no-ops.
export const play = jest.fn();
export const press = jest.fn();
export const release = jest.fn();
export const bind = jest.fn(() => () => {});
export const setEnabled = jest.fn();
export const setVolume = jest.fn();
export const setTheme = jest.fn();
export const unlock = jest.fn(() => Promise.resolve(false));
export const themes = ["default", "mech", "bubble", "press"] as const;
export const sounds = [
  "tap",
  "type",
  "select",
  "toggle",
  "open",
  "close",
  "navigate",
  "success",
  "warning",
  "error",
  "loading",
  "ready",
  "attention",
  "count",
] as const;
export type SoundName = (typeof sounds)[number];
export type Emphasis = "subtle" | "normal" | "strong";
export type ThemeName = (typeof themes)[number];
