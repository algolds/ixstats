import { play, unlock } from "cuelume";
import { setSoundEnabled, soundCues } from "~/lib/sound/cuelume";

const root = document.documentElement;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  root.removeAttribute("data-sound");
  root.removeAttribute("data-motion");
});

describe("soundCues on cuelume 0.2.8", () => {
  it("plays each moment as the cue for its job", () => {
    soundCues.present();
    soundCues.dismiss("subtle");
    soundCues.destructive();
    soundCues.reveal();
    soundCues.notify();
    soundCues.attention();
    expect((play as jest.Mock).mock.calls.map(([name, opts]) => [name, opts?.emphasis])).toEqual([
      ["open", undefined],
      ["close", "subtle"],
      ["close", "strong"],
      ["success", "strong"],
      ["ready", undefined],
      ["attention", undefined],
    ]);
  });

  it("stays silent when sound is off or Reduce Motion is on", () => {
    root.setAttribute("data-sound", "off");
    soundCues.success();
    root.removeAttribute("data-sound");
    root.setAttribute("data-motion", "reduced");
    soundCues.success();
    expect(play).not.toHaveBeenCalled();
  });

  it("unlocks audio from the gesture that turns sound on", () => {
    setSoundEnabled(false);
    expect(unlock).not.toHaveBeenCalled();
    setSoundEnabled(true);
    expect(unlock).toHaveBeenCalledTimes(1);
  });
});
