import { describe, it, expect, beforeEach } from "@jest/globals";
import { play } from "cuelume";
import {
  isSoundMuted,
  playSound,
  setSoundEnabled,
  soundCues,
  SOUND_STORAGE_KEYS,
} from "~/lib/sound/cuelume";

const mockPlay = play as unknown as jest.Mock;
const root = document.documentElement;

beforeEach(() => {
  mockPlay.mockClear();
  localStorage.clear();
  root.removeAttribute("data-motion");
  root.removeAttribute("data-sound");
});

describe("Cuelume mute policy (spec §9)", () => {
  it("plays when nothing mutes it", () => {
    expect(isSoundMuted()).toBe(false);
    playSound("success");
    expect(mockPlay).toHaveBeenCalledWith("success", undefined);
  });

  it('is muted under html[data-motion="reduced"]', () => {
    root.setAttribute("data-motion", "reduced");
    expect(isSoundMuted()).toBe(true);
    soundCues.success();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('is muted under html[data-sound="off"]', () => {
    root.setAttribute("data-sound", "off");
    expect(isSoundMuted()).toBe(true);
    soundCues.present();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("checks at play time, so removing the attribute unmutes", () => {
    root.setAttribute("data-motion", "reduced");
    soundCues.error();
    root.removeAttribute("data-motion");
    soundCues.error();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("honours the one mute toggle (ixstates:sound-enabled)", () => {
    const events: unknown[] = [];
    const listener = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("ixstates-sound-settings-changed", listener);
    setSoundEnabled(false);
    window.removeEventListener("ixstates-sound-settings-changed", listener);

    expect(localStorage.getItem(SOUND_STORAGE_KEYS.ENABLED)).toBe("false");
    expect(events).toEqual([{ enabled: false }]);
    expect(isSoundMuted()).toBe(true);
    soundCues.arrival();
    expect(mockPlay).not.toHaveBeenCalled();

    setSoundEnabled(true);
    soundCues.arrival();
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});
