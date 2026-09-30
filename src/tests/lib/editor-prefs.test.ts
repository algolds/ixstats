/**
 * Tests for editor-prefs.ts — localStorage-backed editor preferences.
 */

import {
  getSnapEnabled,
  setSnapEnabled,
  getSnapTolerance,
  setSnapTolerance,
  getDisabledSnapLayers,
  setSnapLayerEnabled,
  withoutDisabledSnapLayers,
} from "~/lib/maps/editor-prefs";

describe("editor-prefs — snap enabled", () => {
  test("default is true", () => {
    expect(getSnapEnabled()).toBe(true);
  });

  test("setSnapEnabled(false) round-trips", () => {
    setSnapEnabled(false);
    expect(getSnapEnabled()).toBe(false);
  });

  test("setSnapEnabled(true) round-trips", () => {
    setSnapEnabled(true);
    expect(getSnapEnabled()).toBe(true);
    // restore default for other tests
    setSnapEnabled(true);
  });
});

describe("editor-prefs — snap tolerance", () => {
  test("default is 0.015", () => {
    expect(getSnapTolerance()).toBeCloseTo(0.015, 10);
  });

  test("setSnapTolerance(0.03) round-trips", () => {
    setSnapTolerance(0.03);
    expect(getSnapTolerance()).toBeCloseTo(0.03, 10);
    // restore default
    setSnapTolerance(0.015);
  });

  test("invalid values fall back to default", () => {
    // The setter stores a string, but the getter falls back on NaN.
    // Simulate by clearing the key (localStorage available in Jest jsdom).
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      localStorage.removeItem("ixeditor-snap-tolerance");
      expect(getSnapTolerance()).toBeCloseTo(0.015, 10);
    }
  });
});

describe("editor-prefs — per-layer snap toggles", () => {
  test("all snap layers are on by default", () => {
    expect(getDisabledSnapLayers().size).toBe(0);
  });

  test("switching a layer off and on round-trips", () => {
    setSnapLayerEnabled("background", false);
    setSnapLayerEnabled("rivers", false);
    expect([...getDisabledSnapLayers()].sort()).toEqual(["background", "rivers"]);

    setSnapLayerEnabled("rivers", true);
    expect([...getDisabledSnapLayers()]).toEqual(["background"]);

    setSnapLayerEnabled("background", true);
    expect(getDisabledSnapLayers().size).toBe(0);
  });

  test("withoutDisabledSnapLayers drops only switched-off layers", () => {
    const visible = new Set(["background", "rivers", "lakes", "political"]);
    expect(withoutDisabledSnapLayers(visible)).toEqual(visible);

    setSnapLayerEnabled("lakes", false);
    expect(withoutDisabledSnapLayers(visible)).toEqual(
      new Set(["background", "rivers", "political"])
    );
    setSnapLayerEnabled("lakes", true);
  });

  test("unknown stored layer names are ignored", () => {
    localStorage.setItem("ixeditor-snap-layers-off", "rivers,bogus");
    expect([...getDisabledSnapLayers()]).toEqual(["rivers"]);
    localStorage.removeItem("ixeditor-snap-layers-off");
  });
});
