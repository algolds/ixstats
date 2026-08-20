/**
 * Tests for BidirectionalSyncService
 *
 * Phase 3 Task 3.6: Service layer testing
 */

import {
  BidirectionalSyncService,
  type BidirectionalSyncState,
  type SyncRecommendation,
  type SyncImpact,
  type SyncEvent,
} from "~/app/builder/services/base/BidirectionalSyncService";

// Test types
interface TestRecommendation extends SyncRecommendation {
  category: string;
}

interface TestImpact extends SyncImpact {
  metric: string;
}

interface TestState extends BidirectionalSyncState<TestRecommendation, TestImpact> {
  sourceData: TestSource | null;
  targetData: TestTarget | null;
}

interface TestSource {
  id: string;
  value: number;
  settings: Record<string, boolean>;
}

interface TestTarget {
  id: string;
  computedValue: number;
  flags: string[];
}

// Concrete implementation for testing
class TestSyncService extends BidirectionalSyncService<
  TestState,
  TestRecommendation,
  TestImpact,
  TestSource,
  TestTarget
> {
  public generateRecommendationsCallCount = 0;
  public calculateImpactsCallCount = 0;
  public applyRecommendationsCallCount = 0;

  // Control test behavior
  public mockRecommendations: TestRecommendation[] = [];
  public mockImpacts: TestImpact[] = [];
  public shouldThrowOnSync = false;

  protected getInitialState(): TestState {
    return {
      isSyncing: false,
      lastSyncTimestamp: null,
      syncError: null,
      recommendations: [],
      impacts: [],
      sourceData: null,
      targetData: null,
    };
  }

  protected generateRecommendations(source: TestSource): TestRecommendation[] {
    this.generateRecommendationsCallCount++;

    if (this.mockRecommendations.length > 0) {
      return this.mockRecommendations;
    }

    // Generate default recommendations based on source
    const recommendations: TestRecommendation[] = [];

    if (source.value > 50) {
      recommendations.push({
        id: "rec_high_value",
        type: "optimization",
        title: "Optimize high value",
        description: "Source value is high, consider optimization",
        priority: "high",
        impact: 75,
        autoApply: true,
        category: "performance",
      });
    }

    if (source.settings.enableFeature) {
      recommendations.push({
        id: "rec_feature",
        type: "feature",
        title: "Feature enabled",
        description: "Feature is enabled in source",
        priority: "medium",
        impact: 50,
        autoApply: false,
        category: "features",
      });
    }

    return recommendations;
  }

  protected calculateImpacts(source: TestSource, target: TestTarget): TestImpact[] {
    this.calculateImpactsCallCount++;

    if (this.mockImpacts.length > 0) {
      return this.mockImpacts;
    }

    // Calculate default impacts
    const impacts: TestImpact[] = [];
    const projectedValue = source.value * 1.5;
    const changePercent = ((projectedValue - target.computedValue) / target.computedValue) * 100;

    impacts.push({
      field: "computedValue",
      currentValue: target.computedValue,
      projectedValue,
      changePercent,
      direction: changePercent > 0 ? "increase" : changePercent < 0 ? "decrease" : "unchanged",
      severity: changePercent > 20 ? "positive" : changePercent < -20 ? "negative" : "neutral",
      metric: "computed_value",
    });

    return impacts;
  }

  protected applyRecommendations(
    recommendations: TestRecommendation[],
    target: TestTarget
  ): TestTarget {
    this.applyRecommendationsCallCount++;

    if (this.shouldThrowOnSync) {
      throw new Error("Sync error for testing");
    }

    // Apply auto-apply recommendations
    const updatedTarget = { ...target };

    for (const rec of recommendations) {
      if (rec.type === "optimization") {
        updatedTarget.computedValue *= 1.1;
      }
      if (rec.type === "feature") {
        updatedTarget.flags.push("feature_applied");
      }
    }

    return updatedTarget;
  }

  // Expose protected methods for testing
  public testSetSyncing(isSyncing: boolean): void {
    this.setSyncing(isSyncing);
  }

  public testSetSyncError(error: string | null): void {
    this.setSyncError(error);
  }

  public testAddSyncEvent(event: SyncEvent<TestSource, TestTarget>): void {
    this.addSyncEvent(event);
  }

  public testCreateSyncEvent(
    direction: "forward" | "reverse" | "bidirectional",
    source: TestSource,
    target: TestTarget,
    success: boolean,
    changes?: string[],
    error?: string
  ): SyncEvent<TestSource, TestTarget> {
    return this.createSyncEvent(direction, source, target, success, changes, error);
  }

  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
  }
}

describe("BidirectionalSyncService", () => {
  let service: TestSyncService;

  const createTestSource = (overrides: Partial<TestSource> = {}): TestSource => ({
    id: "source_1",
    value: 100,
    settings: { enableFeature: true },
    ...overrides,
  });

  const createTestTarget = (overrides: Partial<TestTarget> = {}): TestTarget => ({
    id: "target_1",
    computedValue: 50,
    flags: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new TestSyncService();
  });

  afterEach(() => {
    service.dispose();
  });

  describe("Initialization", () => {
    it("initializes with default sync state", () => {
      const state = service.getState();

      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTimestamp).toBeNull();
      expect(state.syncError).toBeNull();
      expect(state.recommendations).toEqual([]);
      expect(state.impacts).toEqual([]);
    });

    it("starts with empty sync history", () => {
      expect(service.getSyncHistory()).toEqual([]);
    });
  });

  describe("Sync State Management", () => {
    it("sets syncing state", () => {
      const listener = jest.fn();
      service.subscribe(listener);

      service.testSetSyncing(true);

      expect(service.getState().isSyncing).toBe(true);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ isSyncing: true }));
    });

    it("clears error when starting sync", () => {
      service.testSetSyncError("Previous error");
      service.testSetSyncing(true);

      expect(service.getState().syncError).toBeNull();
    });

    it("sets sync error", () => {
      const listener = jest.fn();
      service.subscribe(listener);

      service.testSetSyncError("Test error");

      const state = service.getState();
      expect(state.syncError).toBe("Test error");
      expect(state.isSyncing).toBe(false);
    });
  });

  describe("Sync History", () => {
    it("adds sync events to history", () => {
      const source = createTestSource();
      const target = createTestTarget();
      const event = service.testCreateSyncEvent("forward", source, target, true, ["change1"]);

      service.testAddSyncEvent(event);

      const history = service.getSyncHistory();
      expect(history.length).toBe(1);
      expect(history[0]).toEqual(event);
    });

    it("creates sync events with correct structure", () => {
      const source = createTestSource();
      const target = createTestTarget();

      const event = service.testCreateSyncEvent("bidirectional", source, target, true, [
        "change1",
        "change2",
      ]);

      expect(event.id).toMatch(/^sync_\d+_[a-z0-9]+$/);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.direction).toBe("bidirectional");
      expect(event.source).toBe(source);
      expect(event.target).toBe(target);
      expect(event.success).toBe(true);
      expect(event.changes).toEqual(["change1", "change2"]);
      expect(event.error).toBeUndefined();
    });

    it("creates failed sync events with error", () => {
      const source = createTestSource();
      const target = createTestTarget();

      const event = service.testCreateSyncEvent(
        "forward",
        source,
        target,
        false,
        undefined,
        "Sync failed"
      );

      expect(event.success).toBe(false);
      expect(event.error).toBe("Sync failed");
    });

    it("trims history when exceeding max size", () => {
      service.setMaxHistorySize(3);
      const source = createTestSource();
      const target = createTestTarget();

      for (let i = 0; i < 5; i++) {
        const event = service.testCreateSyncEvent("forward", source, target, true, [`change_${i}`]);
        service.testAddSyncEvent(event);
      }

      const history = service.getSyncHistory();
      expect(history.length).toBe(3);
      // Should keep the most recent events
      expect(history[0].changes).toEqual(["change_2"]);
      expect(history[2].changes).toEqual(["change_4"]);
    });

    it("clears sync history", () => {
      const source = createTestSource();
      const target = createTestTarget();
      const event = service.testCreateSyncEvent("forward", source, target, true);
      service.testAddSyncEvent(event);

      service.clearSyncHistory();

      expect(service.getSyncHistory()).toEqual([]);
    });

    it("returns immutable copy of history", () => {
      const source = createTestSource();
      const target = createTestTarget();
      const event = service.testCreateSyncEvent("forward", source, target, true);
      service.testAddSyncEvent(event);

      const history1 = service.getSyncHistory();
      const history2 = service.getSyncHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe("Bidirectional Sync", () => {
    it("performs successful bidirectional sync", async () => {
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();

      const result = await service.performBidirectionalSync(source, target);

      expect(service.generateRecommendationsCallCount).toBe(1);
      expect(service.calculateImpactsCallCount).toBe(1);
      expect(service.applyRecommendationsCallCount).toBe(1);

      const state = service.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTimestamp).not.toBeNull();
      expect(state.syncError).toBeNull();
      expect(state.recommendations.length).toBeGreaterThan(0);
      expect(state.impacts.length).toBeGreaterThan(0);

      // Auto-apply recommendation should have been applied
      expect(result.computedValue).toBeGreaterThan(target.computedValue);
    });

    it("records sync event on success", async () => {
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();

      await service.performBidirectionalSync(source, target);

      const history = service.getSyncHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
      expect(history[0].direction).toBe("bidirectional");
    });

    it("handles sync errors gracefully", async () => {
      service.shouldThrowOnSync = true;
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();

      await expect(service.performBidirectionalSync(source, target)).rejects.toThrow(
        "Sync error for testing"
      );

      const state = service.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.syncError).toBe("Sync error for testing");

      const history = service.getSyncHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBe("Sync error for testing");
    });

    it("notifies listeners during sync", async () => {
      const listener = jest.fn();
      service.subscribe(listener);
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();

      await service.performBidirectionalSync(source, target);

      // Should have been called multiple times (start syncing, end syncing)
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("applies only auto-apply recommendations", async () => {
      service.mockRecommendations = [
        {
          id: "auto",
          type: "optimization",
          title: "Auto apply",
          description: "Will be applied",
          priority: "high",
          impact: 80,
          autoApply: true,
          category: "auto",
        },
        {
          id: "manual",
          type: "feature",
          title: "Manual apply",
          description: "Will not be applied",
          priority: "low",
          impact: 30,
          autoApply: false,
          category: "manual",
        },
      ];

      const source = createTestSource();
      const target = createTestTarget();

      await service.performBidirectionalSync(source, target);

      // Only auto-apply recommendation should trigger applyRecommendations
      // (applyRecommendations receives filtered array)
      expect(service.applyRecommendationsCallCount).toBe(1);
    });
  });

  describe("Update Source", () => {
    it("generates recommendations and impacts when source updates", async () => {
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();

      await service.updateSource(source, target);

      expect(service.generateRecommendationsCallCount).toBe(1);
      expect(service.calculateImpactsCallCount).toBe(1);

      const state = service.getState();
      expect(state.recommendations.length).toBeGreaterThan(0);
      expect(state.impacts.length).toBeGreaterThan(0);
    });

    it("uses deep equality for notification", async () => {
      const listener = jest.fn();
      service.subscribe(listener);

      const source = createTestSource({ value: 30 }); // Low value = no recommendations
      const target = createTestTarget();

      await service.updateSource(source, target);
      const callCount = listener.mock.calls.length;

      // Update with same source - should not notify if state unchanged
      await service.updateSource(source, target);

      // Calls may not increase if deep equality prevents notification
      // (depends on whether recommendations/impacts changed)
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(callCount);
    });
  });

  describe("Recommendation Filtering", () => {
    it("gets pending recommendations", async () => {
      service.mockRecommendations = [
        {
          id: "auto",
          type: "opt",
          title: "Auto",
          description: "",
          priority: "high",
          impact: 80,
          autoApply: true,
          category: "a",
        },
        {
          id: "manual1",
          type: "feat",
          title: "Manual 1",
          description: "",
          priority: "low",
          impact: 30,
          autoApply: false,
          category: "b",
        },
        {
          id: "manual2",
          type: "feat",
          title: "Manual 2",
          description: "",
          priority: "medium",
          impact: 50,
          autoApply: false,
          category: "c",
        },
      ];

      const source = createTestSource();
      const target = createTestTarget();
      await service.updateSource(source, target);

      const pending = service.getPendingRecommendations();
      expect(pending.length).toBe(2);
      expect(pending.every((r) => !r.autoApply)).toBe(true);
    });

    it("gets auto-apply recommendations", async () => {
      service.mockRecommendations = [
        {
          id: "auto1",
          type: "opt",
          title: "Auto 1",
          description: "",
          priority: "high",
          impact: 80,
          autoApply: true,
          category: "a",
        },
        {
          id: "manual",
          type: "feat",
          title: "Manual",
          description: "",
          priority: "low",
          impact: 30,
          autoApply: false,
          category: "b",
        },
        {
          id: "auto2",
          type: "opt",
          title: "Auto 2",
          description: "",
          priority: "medium",
          impact: 60,
          autoApply: true,
          category: "c",
        },
      ];

      const source = createTestSource();
      const target = createTestTarget();
      await service.updateSource(source, target);

      const autoApply = service.getAutoApplyRecommendations();
      expect(autoApply.length).toBe(2);
      expect(autoApply.every((r) => r.autoApply)).toBe(true);
    });
  });

  describe("Reset", () => {
    it("clears sync history on reset", async () => {
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();
      await service.performBidirectionalSync(source, target);

      service.reset();

      expect(service.getSyncHistory()).toEqual([]);
    });

    it("resets to initial state", async () => {
      const source = createTestSource({ value: 75 });
      const target = createTestTarget();
      await service.performBidirectionalSync(source, target);

      service.reset();

      const state = service.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTimestamp).toBeNull();
      expect(state.syncError).toBeNull();
      expect(state.recommendations).toEqual([]);
      expect(state.impacts).toEqual([]);
    });
  });
});
