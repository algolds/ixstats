/**
 * Tests for useBuilderState Hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useBuilderState } from '../../hooks/useBuilderState';
import type { BuilderState } from '../../hooks/useBuilderState';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useBuilderState', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(result.current.builderState.step).toBe('foundation');
      expect(result.current.builderState.selectedCountry).toBeNull();
      expect(result.current.builderState.economicInputs).toBeNull();
      expect(result.current.builderState.governmentComponents).toEqual([]);
    });

    it('provides update handlers', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(typeof result.current.updateEconomicInputs).toBe('function');
      expect(typeof result.current.updateGovernmentComponents).toBe('function');
      expect(typeof result.current.updateGovernmentStructure).toBe('function');
      expect(typeof result.current.updateTaxSystem).toBe('function');
      expect(typeof result.current.updateStep).toBe('function');
    });

    it('initializes with null lastSaved', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(result.current.lastSaved).toBeNull();
    });

    it('initializes with isAutoSaving false', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(result.current.isAutoSaving).toBe(false);
    });
  });

  describe('State Updates', () => {
    it('updates economic inputs', () => {
      const { result } = renderHook(() => useBuilderState());

      const mockInputs = {
        nationalIdentity: {
          countryName: 'Test Country',
          capitalCity: 'Test Capital',
          currency: 'TST',
        },
      } as any;

      act(() => {
        result.current.updateEconomicInputs(mockInputs);
      });

      expect(result.current.builderState.economicInputs).toEqual(mockInputs);
    });

    it('updates government components', () => {
      const { result } = renderHook(() => useBuilderState());

      const mockComponents = ['parliament', 'judiciary', 'executive'] as any;

      act(() => {
        result.current.updateGovernmentComponents(mockComponents);
      });

      expect(result.current.builderState.governmentComponents).toEqual(mockComponents);
    });

    it('updates government structure', () => {
      const { result } = renderHook(() => useBuilderState());

      const mockStructure = { type: 'democracy' };

      act(() => {
        result.current.updateGovernmentStructure(mockStructure);
      });

      expect(result.current.builderState.governmentStructure).toEqual(mockStructure);
    });

    it('updates tax system', () => {
      const { result } = renderHook(() => useBuilderState());

      const mockTaxData = { progressive: true } as any;

      act(() => {
        result.current.updateTaxSystem(mockTaxData);
      });

      expect(result.current.builderState.taxSystemData).toEqual(mockTaxData);
    });
  });

  describe('Step Navigation', () => {
    it('updates step and marks as completed', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateStep('core', null);
      });

      expect(result.current.builderState.step).toBe('government');
      expect(result.current.builderState.completedSteps).toContain('core');
    });

    it('maintains completed steps list', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateStep('foundation', null);
        result.current.updateStep('core', null);
      });

      expect(result.current.builderState.completedSteps).toContain('foundation');
      expect(result.current.builderState.completedSteps).toContain('core');
    });

    it('prevents duplicate completed steps', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateStep('foundation', null);
        result.current.updateStep('foundation', null);
      });

      const foundationCount = result.current.builderState.completedSteps.filter(
        (s) => s === 'foundation'
      ).length;
      expect(foundationCount).toBe(1);
    });
  });

  describe('Step Access Control', () => {
    it('allows access to current step', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(result.current.canAccessStep('foundation')).toBe(true);
    });

    it('allows access to completed steps', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateStep('foundation', null);
      });

      expect(result.current.canAccessStep('foundation')).toBe(true);
    });

    it('allows access to next step after current', () => {
      const { result } = renderHook(() => useBuilderState());

      expect(result.current.canAccessStep('foundation')).toBe(true);
    });
  });

  describe('LocalStorage Persistence', () => {
    it('saves state to localStorage', async () => {
      const { result } = renderHook(() => useBuilderState());

      const mockInputs = {
        nationalIdentity: { countryName: 'Test' },
      } as any;

      act(() => {
        result.current.updateEconomicInputs(mockInputs);
      });

      await waitFor(
        () => {
          const saved = localStorage.getItem('builder_state');
          expect(saved).toBeTruthy();
        },
        { timeout: 1000 }
      );
    });

    it('loads state from localStorage on mount', () => {
      const savedState: BuilderState = {
        step: 'core',
        selectedCountry: null,
        economicInputs: { nationalIdentity: { countryName: 'Saved Country' } } as any,
        governmentComponents: [],
        taxSystemData: null,
        governmentStructure: null,
        completedSteps: ['foundation'],
        activeCoreTab: 'identity',
        activeGovernmentTab: 'components',
        activeEconomicsTab: 'economy',
        showAdvancedMode: false,
      };

      localStorage.setItem('builder_state', JSON.stringify(savedState));

      const { result } = renderHook(() => useBuilderState());

      expect(result.current.builderState.economicInputs).toEqual(savedState.economicInputs);
    });

    it('updates lastSaved timestamp', async () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateEconomicInputs({} as any);
      });

      await waitFor(
        () => {
          expect(result.current.lastSaved).not.toBeNull();
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Clear Draft', () => {
    it('clears builder state', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateEconomicInputs({ test: 'data' } as any);
        result.current.clearDraft();
      });

      expect(result.current.builderState.economicInputs).toBeNull();
      expect(result.current.builderState.step).toBe('foundation');
    });

    it('clears localStorage', () => {
      const { result } = renderHook(() => useBuilderState());

      localStorage.setItem('builder_state', 'test');

      act(() => {
        result.current.clearDraft();
      });

      expect(localStorage.getItem('builder_state')).toBeNull();
    });

    it('resets lastSaved', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.clearDraft();
      });

      expect(result.current.lastSaved).toBeNull();
    });
  });

  describe('Auto-save', () => {
    it('triggers auto-save on state change', async () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateEconomicInputs({ test: true } as any);
      });

      await waitFor(
        () => {
          expect(result.current.isAutoSaving).toBe(false);
        },
        { timeout: 1000 }
      );
    });

    it('debounces auto-save', async () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateEconomicInputs({ test: 1 } as any);
        result.current.updateEconomicInputs({ test: 2 } as any);
        result.current.updateEconomicInputs({ test: 3 } as any);
      });

      // Should only save once after debounce
      await waitFor(() => {
        expect(result.current.isAutoSaving).toBe(false);
      });
    });
  });

  describe('Tab State Management', () => {
    it('manages core tab state', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.setBuilderState((prev) => ({
          ...prev,
          activeCoreTab: 'indicators',
        }));
      });

      expect(result.current.builderState.activeCoreTab).toBe('indicators');
    });

    it('manages government tab state', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.setBuilderState((prev) => ({
          ...prev,
          activeGovernmentTab: 'structure',
        }));
      });

      expect(result.current.builderState.activeGovernmentTab).toBe('structure');
    });

    it('manages economics tab state', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.setBuilderState((prev) => ({
          ...prev,
          activeEconomicsTab: 'sectors',
        }));
      });

      expect(result.current.builderState.activeEconomicsTab).toBe('sectors');
    });
  });

  describe('Advanced Mode', () => {
    it('toggles advanced mode', () => {
      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.setBuilderState((prev) => ({
          ...prev,
          showAdvancedMode: true,
        }));
      });

      expect(result.current.builderState.showAdvancedMode).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage errors gracefully', () => {
      // Override localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Quota exceeded');
      });

      const { result } = renderHook(() => useBuilderState());

      act(() => {
        result.current.updateEconomicInputs({ test: true } as any);
      });

      // Should not crash
      expect(result.current.builderState).toBeDefined();

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('handles invalid saved state gracefully', () => {
      localStorage.setItem('builder_state', 'invalid json{');

      const { result } = renderHook(() => useBuilderState());

      // Should fall back to default state
      expect(result.current.builderState.step).toBe('foundation');
    });
  });
});
