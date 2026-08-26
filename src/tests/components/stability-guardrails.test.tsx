/**
 * Stability Guardrails Test Suite
 *
 * Verifies that WebGL errors, empty/malformed NPC data, and rate-limited
 * NationStates API responses are handled gracefully without crashing the application.
 */

import { NPCPersonalitySystem } from "~/lib/diplomacy/npc-personality";
import { nsApiClient } from "~/lib/nationstates/api-client";
import { toast } from "sonner";
import { renderHook } from "@testing-library/react";
import { useWebGLErrorHandler } from "~/hooks/use-webgl-error-handler";

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
  },
}));

describe("Stability Guardrails", () => {
  let warnSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy?.mockRestore();
    errorSpy?.mockRestore();
    logSpy?.mockRestore();
  });

  // ─── WebGL / Graphics Error Safety ───
  describe("WebGL Error Handler Hook", () => {
    it("should intercept and notify on WebGL context errors", () => {
      // Mount the hook
      renderHook(() => useWebGLErrorHandler());

      // Create a mock CustomEvent listener for custom webgl-error event
      const onWebGLError = jest.fn();
      window.addEventListener("webgl-error", onWebGLError);

      // Trigger a simulated WebGL error event
      const webglErrorEvent = new ErrorEvent("error", {
        message:
          "WebGL: INVALID_OPERATION: drawElements: texture bound to texture unit 0 is not renderable",
        error: new Error("WebGL error context"),
      });
      window.dispatchEvent(webglErrorEvent);

      // Verify custom event dispatched
      expect(onWebGLError).toHaveBeenCalled();

      // Verify user-facing error toast was triggered
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Graphics rendering error detected"),
        expect.any(Object)
      );

      // Clean up event listener
      window.removeEventListener("webgl-error", onWebGLError);
    });

    it("should intercept and notify on WebGL context lost and restored", () => {
      renderHook(() => useWebGLErrorHandler());

      const onContextLost = jest.fn();
      const onContextRestored = jest.fn();
      window.addEventListener("webgl-context-lost", onContextLost);
      window.addEventListener("webgl-context-restored", onContextRestored);

      // Trigger context lost
      const contextLostEvent = new Event("webglcontextlost");
      window.dispatchEvent(contextLostEvent);

      expect(onContextLost).toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("context lost"),
        expect.any(Object)
      );

      // Trigger context restored
      const contextRestoredEvent = new Event("webglcontextrestored");
      window.dispatchEvent(contextRestoredEvent);

      expect(onContextRestored).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("context restored successfully"),
        expect.any(Object)
      );

      window.removeEventListener("webgl-context-lost", onContextLost);
      window.removeEventListener("webgl-context-restored", onContextRestored);
    });
  });

  // ─── AI Personality Resilience ───
  describe("NPC AI Personality Calculations", () => {
    it("should handle empty or undefined observable data without crashing", () => {
      // Pass empty object cast as ObservableData
      const emptyData = {} as any;

      // Calculation should proceed and not throw TypeError
      let personality: any;
      expect(() => {
        personality = NPCPersonalitySystem.calculatePersonality(
          "country-abc",
          "TestLand",
          emptyData
        );
      }).not.toThrow();

      expect(personality).toBeDefined();
      expect(personality?.countryId).toBe("country-abc");
      expect(personality?.countryName).toBe("TestLand");

      // Verify default fallback traits are calculated cleanly
      expect(personality?.traits).toEqual({
        assertiveness: 25, // Base value
        cooperativeness: 25, // Base value
        economicFocus: 5, // Base value
        culturalOpenness: 30, // Base value
        riskTolerance: 40, // Base value
        ideologicalRigidity: 65, // Calculated: (50 * 0.7) + (100 * 0.3) = 35 + 30 = 65
        militarism: 20, // Base value
        isolationism: 100, // No engagement leads to max isolationism (capped at 100)
      });

      // Archetype should resolve to default pragmatic realist
      expect(personality?.archetype).toBe("pragmatic_realist");

      // Data quality metrics should degrade gracefully
      expect(personality?.dataQuality).toBe(0);
      expect(personality?.confidence).toBe(15); // base confidence from default consistency
    });

    it("should handle partially incomplete data values safely", () => {
      const partialData = {
        relationships: { total: 2, hostile: 1 },
        historical: { totalActions: 10, aggressiveActions: 5 },
      } as any;

      let personality: any;
      expect(() => {
        personality = NPCPersonalitySystem.calculatePersonality(
          "country-def",
          "Freeland",
          partialData
        );
      }).not.toThrow();

      expect(personality?.traits.assertiveness).toBe(65); // calculation works with partial fields
      expect(personality?.traits.cooperativeness).toBe(25); // cooperativeness defaults other fields cleanly
    });
  });

  // ─── Cards & Sync Fallbacks ───
  describe("NationStates API Client Error Propagation", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should propagate RATE_LIMIT errors when API returns HTTP 429", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow("RATE_LIMIT");
    });

    it("should propagate SERVER_ERROR errors when API returns HTTP 503", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });

      await expect(nsApiClient.fetchDeck("testnation")).rejects.toThrow("SERVER_ERROR");
    });

    it("should return null for expected HTTP 404 nation not found errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const deck = await nsApiClient.fetchDeck("unknown_nation_xyz");
      expect(deck).toBeNull();
    });
  });
});
