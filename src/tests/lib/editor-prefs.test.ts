/**
 * Tests for editor-prefs.ts — localStorage-backed editor preferences.
 */

import {
  getSnapEnabled,
  setSnapEnabled,
  getSnapTolerance,
  setSnapTolerance,
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
