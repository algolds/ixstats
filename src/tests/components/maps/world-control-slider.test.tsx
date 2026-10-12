/**
 * The World tab's sliders ask for a new world when they are released, not on every tick of a drag: dragging
 * updates the readout, releasing (or a key step) is the only thing that reports a commit.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/ui/slider", () => ({
  Slider: (props: {
    value: number[];
    disabled?: boolean;
    "aria-labelledby"?: string;
    onValueChange: (value: number[]) => void;
    onValueCommit: (value: number[]) => void;
  }) => (
    <div>
      <button disabled={props.disabled} onClick={() => props.onValueChange([8])}>
        drag
      </button>
      <button disabled={props.disabled} onClick={() => props.onValueCommit([8])}>
        release
      </button>
    </div>
  ),
}));

import { ControlSlider } from "~/components/maps/editor/panels/WorldControlParts";
import { WorldBasicControls } from "~/components/maps/editor/panels/WorldBasicControls";
import { controlAvailability, controlsForPreset } from "~/lib/worldgen/world-controls";

describe("ControlSlider", () => {
  const setup = () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(
      <ControlSlider
        label="Continents"
        value={6}
        min={1}
        max={12}
        step={1}
        display="6"
        ends={["Few", "Many"]}
        onChange={onChange}
        onCommit={onCommit}
      />
    );
    return { onChange, onCommit };
  };

  it("reports a drag as a change and nothing else", () => {
    const { onChange, onCommit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "drag" }));
    expect(onChange).toHaveBeenCalledWith(8);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("reports a release as a commit", () => {
    const { onChange, onCommit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "release" }));
    expect(onCommit).toHaveBeenCalledWith(8);
    expect(onChange).not.toHaveBeenCalled();
  });

  describe("keys", () => {
    const keys = () => {
      const { onChange, onCommit } = setup();
      return {
        onChange,
        onCommit,
        wrapper: screen.getByText("Continents").closest("div")!.parentElement!,
      };
    };

    it("commit once, when the key comes up, with the last value", () => {
      const { onCommit, wrapper } = keys();
      const release = screen.getByRole("button", { name: "release" });
      // A key held down: each repeat steps the slider
      for (let repeat = 0; repeat < 5; repeat++) {
        fireEvent.keyDown(wrapper, { key: "ArrowRight", repeat: repeat > 0 });
        fireEvent.click(release);
      }
      expect(onCommit).not.toHaveBeenCalled();
      fireEvent.keyUp(wrapper, { key: "ArrowRight" });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith(8);
      fireEvent.keyUp(wrapper, { key: "ArrowRight" });
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("commit when focus leaves, if the key never came up here", () => {
      const { onCommit, wrapper } = keys();
      fireEvent.keyDown(wrapper, { key: "ArrowRight" });
      fireEvent.click(screen.getByRole("button", { name: "release" }));
      fireEvent.blur(wrapper);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("leave a pointer release to commit at once, even after keys were used", () => {
      const { onCommit, wrapper } = keys();
      fireEvent.keyDown(wrapper, { key: "ArrowRight" });
      fireEvent.keyUp(wrapper, { key: "ArrowRight" });
      fireEvent.pointerDown(wrapper);
      fireEvent.click(screen.getByRole("button", { name: "release" }));
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it("commit a key step that is still waiting when the pointer takes over", () => {
      const { onCommit, wrapper } = keys();
      fireEvent.keyDown(wrapper, { key: "ArrowRight" });
      fireEvent.click(screen.getByRole("button", { name: "release" }));
      fireEvent.pointerDown(wrapper);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  it("shows its label, the value as text and the captions at its ends", () => {
    setup();
    expect(screen.getByText("Continents")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("Few")).toBeInTheDocument();
    expect(screen.getByText("Many")).toBeInTheDocument();
  });
});

describe("WorldBasicControls", () => {
  it("sends the dragged value to onLive and the released one to onCommit, per control", () => {
    const onLive = jest.fn();
    const onCommit = jest.fn();
    render(
      <WorldBasicControls
        controls={controlsForPreset("earthlike")}
        available={controlAvailability("preset")}
        onLive={onLive}
        onCommit={onCommit}
      />
    );
    const drag = screen.getAllByRole("button", { name: "drag" });
    const release = screen.getAllByRole("button", { name: "release" });
    // Continents is the first slider, Land share the second
    fireEvent.click(drag[0]!);
    fireEvent.click(release[1]!);
    expect(onLive).toHaveBeenCalledWith({ continents: 8 });
    expect(onCommit).toHaveBeenCalledWith({ landShare: 8 });
    expect(onLive).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("leaves the controls the realm's map decides switched off", () => {
    render(
      <WorldBasicControls
        controls={controlsForPreset("earthlike")}
        available={controlAvailability("realm-map")}
        onLive={jest.fn()}
        onCommit={jest.fn()}
      />
    );
    // Continents, Land share, Nations are off; Temperature and Rainfall stay on
    const dragButtons = screen.getAllByRole("button", { name: "drag" });
    expect(dragButtons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
