import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

const mockTheme = {
  theme: "system" as "system" | "light" | "dark",
  setTheme: jest.fn(),
  compactMode: false,
  setCompactMode: jest.fn(),
  textScale: 1,
  setTextScale: jest.fn(),
  increaseContrast: false,
  setIncreaseContrast: jest.fn(),
  reduceTransparency: false,
  setReduceTransparency: jest.fn(),
  reduceAnimations: false,
  setReduceAnimations: jest.fn(),
  enableTextures: true,
  setEnableTextures: jest.fn(),
  interactiveHover: true,
  setInteractiveHover: jest.fn(),
};

const mockSound = {
  enabled: true,
  volume: 0.25,
  setEnabled: jest.fn(),
  setVolume: jest.fn(),
  toggleEnabled: jest.fn(),
  previewSound: jest.fn(),
  sounds: [],
};

jest.mock("~/context/theme-context", () => ({ useTheme: () => mockTheme }));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => mockSound }));

// Imported after the mocks.
// eslint-disable-next-line import/first
import { AppearanceAccessibilityPanel } from "~/app/settings/_components/panels/AppearanceAccessibilityPanel";

beforeAll(() => {
  // jsdom has no ResizeObserver; the Radix slider measures its thumbs with it.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AppearanceAccessibilityPanel", () => {
  it("sets the theme from the segmented control", () => {
    render(<AppearanceAccessibilityPanel />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(screen.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(group).toBeInTheDocument();
    expect(mockTheme.setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches density", () => {
    render(<AppearanceAccessibilityPanel />);
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    expect(mockTheme.setCompactMode).toHaveBeenCalledWith(true);
  });

  it.each([
    ["Increase contrast", "setIncreaseContrast"],
    ["Reduce transparency", "setReduceTransparency"],
    ["Reduce motion", "setReduceAnimations"],
  ] as const)("turns on %s", (label, setter) => {
    render(<AppearanceAccessibilityPanel />);
    const toggle = screen.getByRole("switch", { name: label });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(mockTheme[setter]).toHaveBeenCalledWith(true);
  });

  it("mutes sound through the shared toggle", () => {
    render(<AppearanceAccessibilityPanel />);
    fireEvent.click(screen.getByRole("switch", { name: "Sound effects" }));
    expect(mockSound.setEnabled).toHaveBeenCalledWith(false);
  });

  it("adjusts text size with the keyboard and previews it", () => {
    render(<AppearanceAccessibilityPanel />);
    const [textSize] = screen.getAllByRole("slider");
    expect(textSize).toHaveAttribute("aria-valuemin", "90");
    expect(textSize).toHaveAttribute("aria-valuemax", "130");
    expect(textSize).toHaveAttribute("aria-valuenow", "100");
    fireEvent.keyDown(textSize!, { key: "ArrowRight" });
    expect(mockTheme.setTextScale).toHaveBeenCalledWith(1.05);
    expect(screen.getByText(/shown at 100% of the default size/)).toBeInTheDocument();
  });

  it("turns the new navigation preview on and off (facet-nav flag)", () => {
    document.documentElement.removeAttribute("data-nav");
    render(<AppearanceAccessibilityPanel />);
    const toggle = screen.getByRole("switch", { name: "New navigation (preview)" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-nav")).toBe("facet");
    expect(localStorage.getItem("ixstats-facet-nav")).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: "New navigation (preview)" }));
    expect(document.documentElement.hasAttribute("data-nav")).toBe(false);
    localStorage.removeItem("ixstats-facet-nav");
  });
});
