jest.mock("~/lib/sound/cuelume", () => ({
  soundCues: { reveal: jest.fn() },
  isSoundMuted: jest.fn(() => false),
}));

import { isSoundMuted, soundCues } from "~/lib/sound/cuelume";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";

describe("playRevealFeedback", () => {
  const vibrate = jest.fn();
  beforeAll(() =>
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true })
  );
  beforeEach(() => jest.clearAllMocks());

  it("is quiet for common pulls, plays the reveal cue from Rare, and buzzes lightly from Epic", () => {
    playRevealFeedback("UNCOMMON", false);
    expect(soundCues.reveal).not.toHaveBeenCalled();
    playRevealFeedback("RARE", false);
    expect(soundCues.reveal).toHaveBeenCalledTimes(1);
    expect(vibrate).not.toHaveBeenCalled();
    playRevealFeedback("LEGENDARY", false);
    expect(soundCues.reveal).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenCalledWith(40);
  });

  it("never buzzes under Reduce Motion", () => {
    playRevealFeedback("LEGENDARY", true);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("never buzzes while sound is switched off, the one feedback setting", () => {
    jest.mocked(isSoundMuted).mockReturnValueOnce(true);
    playRevealFeedback("EPIC", false);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
