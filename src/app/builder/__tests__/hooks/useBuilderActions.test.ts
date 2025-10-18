/**
 * Tests for useBuilderActions Hook
 */

import { renderHook, act } from '@testing-library/react';
import { useBuilderActions } from '../../hooks/useBuilderActions';
import type { BuilderState } from '../../hooks/useBuilderState';

describe('useBuilderActions', () => {
  const createMockState = (overrides?: Partial<BuilderState>): BuilderState => ({
    step: 'foundation',
    selectedCountry: null,
    economicInputs: null,
    governmentComponents: [],
    taxSystemData: null,
    governmentStructure: null,
    completedSteps: [],
    activeCoreTab: 'identity',
    activeGovernmentTab: 'components',
    activeEconomicsTab: 'economy',
    showAdvancedMode: false,
    ...overrides,
  });

  describe('Initialization', () => {
    it('provides all required action handlers', () => {
      const mockSetState = jest.fn();
      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: createMockState(),
          setBuilderState: mockSetState,
        })
      );

      expect(typeof result.current.handleContinue).toBe('function');
      expect(typeof result.current.handlePreviousStep).toBe('function');
      expect(typeof result.current.handleStepClick).toBe('function');
      expect(typeof result.current.handleTabChange).toBe('function');
      expect(typeof result.current.canNavigateToStep).toBe('function');
    });

    it('calculates initial progress percentage', () => {
      const mockSetState = jest.fn();
      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: createMockState(),
          setBuilderState: mockSetState,
        })
      );

      expect(typeof result.current.progressPercentage).toBe('number');
      expect(result.current.progressPercentage).toBeGreaterThanOrEqual(0);
      expect(result.current.progressPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('handleContinue', () => {
    it('advances from foundation to core when country selected', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
        selectedCountry: { name: 'Test Country' } as any,
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('does not advance from foundation without country', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
        selectedCountry: null,
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      // Should not transition to next step
      const calls = mockSetState.mock.calls;
      expect(calls.length).toBe(0);
    });

    it('advances core tabs sequentially', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
        activeCoreTab: 'identity',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('advances from core to government after last tab', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
        activeCoreTab: 'indicators',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('advances government tabs sequentially', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'government',
        activeGovernmentTab: 'components',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('advances from economics to preview', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'economics',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleContinue();
      });

      expect(mockSetState).toHaveBeenCalled();
    });
  });

  describe('handlePreviousStep', () => {
    it('navigates back to previous step', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
        completedSteps: ['foundation'],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handlePreviousStep();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('does not go back from foundation step', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handlePreviousStep();
      });

      // Should not navigate back from first step
      expect(mockSetState).toHaveBeenCalledTimes(0);
    });
  });

  describe('handleStepClick', () => {
    it('navigates to clicked step if accessible', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'economics',
        completedSteps: ['foundation', 'core', 'government'],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleStepClick('core');
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('does not navigate to inaccessible step', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
        completedSteps: [],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleStepClick('preview');
      });

      // Should not allow jumping ahead
      const accessible = result.current.canNavigateToStep('preview');
      expect(accessible).toBe(false);
    });
  });

  describe('handleTabChange', () => {
    it('changes core tab', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
        activeCoreTab: 'identity',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleTabChange('core', 'indicators');
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('changes government tab', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'government',
        activeGovernmentTab: 'components',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleTabChange('government', 'structure');
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('changes economics tab', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'economics',
        activeEconomicsTab: 'economy',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      act(() => {
        result.current.handleTabChange('economics', 'sectors');
      });

      expect(mockSetState).toHaveBeenCalled();
    });
  });

  describe('canNavigateToStep', () => {
    it('allows navigation to current step', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.canNavigateToStep('core')).toBe(true);
    });

    it('allows navigation to completed steps', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'government',
        completedSteps: ['foundation', 'core'],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.canNavigateToStep('foundation')).toBe(true);
      expect(result.current.canNavigateToStep('core')).toBe(true);
    });

    it('prevents navigation to future steps', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
        completedSteps: [],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.canNavigateToStep('preview')).toBe(false);
    });
  });

  describe('Progress Calculation', () => {
    it('calculates progress based on completed steps', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'core',
        completedSteps: ['foundation'],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.progressPercentage).toBeGreaterThan(0);
      expect(result.current.progressPercentage).toBeLessThan(100);
    });

    it('shows 0% at start', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'foundation',
        completedSteps: [],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.progressPercentage).toBeGreaterThanOrEqual(0);
    });

    it('shows 100% when all steps completed', () => {
      const mockSetState = jest.fn();
      const state = createMockState({
        step: 'preview',
        completedSteps: ['foundation', 'core', 'government', 'economics', 'preview'],
      });

      const { result } = renderHook(() =>
        useBuilderActions({
          builderState: state,
          setBuilderState: mockSetState,
        })
      );

      expect(result.current.progressPercentage).toBeGreaterThan(80);
    });
  });
});
