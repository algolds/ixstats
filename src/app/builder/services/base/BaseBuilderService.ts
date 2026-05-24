/**
 * BaseBuilderService - Abstract base class for builder integration services
 *
 * Phase 3 optimization: Consolidates common pub/sub patterns, state management,
 * and update queue handling across all builder services.
 *
 * Features:
 * - Generic subscribe/unsubscribe lifecycle
 * - Optional deep equality notification checking (prevents redundant updates)
 * - Update queue with configurable debouncing
 * - Error-wrapped listener notifications
 * - Type-safe state management
 */

import { isEqual } from "lodash";

/**
 * Configuration options for notification behavior
 */
export interface NotifyOptions {
  /** Use deep equality check to prevent redundant notifications */
  deepEqual?: boolean;
  /** Force notification even if state hasn't changed */
  force?: boolean;
}

/**
 * Configuration options for the update queue
 */
export interface QueueOptions {
  /** Debounce time in milliseconds (default: 100ms) */
  debounceMs?: number;
  /** Process immediately without debouncing */
  immediate?: boolean;
}

/**
 * Abstract base class for builder services with pub/sub pattern
 *
 * @template TState - The state type managed by the service
 * @template TEvent - The event type for update queue (optional)
 */
export abstract class BaseBuilderService<TState, TEvent = unknown> {
  protected state: TState;
  private listeners: Array<(state: TState) => void> = [];
  private lastNotifiedState: TState | null = null;
  protected updateQueue: TEvent[] = [];
  protected isProcessingQueue = false;
  protected updateTimeout: ReturnType<typeof setTimeout> | null = null;
  protected defaultDebounceMs = 100;

  /**
   * Get the initial state for the service.
   * Must be implemented by subclasses.
   */
  protected abstract getInitialState(): TState;

  constructor() {
    this.state = this.getInitialState();
  }

  /**
   * Subscribe to state changes
   *
   * @param listener - Callback function invoked when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: TState) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get the current state (immutable copy)
   */
  getState(): TState {
    return { ...this.state };
  }

  /**
   * Get the number of active listeners
   */
  getListenerCount(): number {
    return this.listeners.length;
  }

  /**
   * Notify all listeners of state change
   *
   * @param options - Notification options
   */
  protected notifyListeners(options: NotifyOptions = {}): void {
    const { deepEqual = false, force = false } = options;
    const newState = { ...this.state };

    // Skip if state hasn't changed (when using deep equality check)
    if (!force && deepEqual) {
      if (this.lastNotifiedState && isEqual(newState, this.lastNotifiedState)) {
        return;
      }
    }

    this.lastNotifiedState = newState;

    // Notify all listeners with error handling
    this.listeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (error) {
        console.error(`[${this.constructor.name}] Error in listener callback:`, error);
      }
    });
  }

  /**
   * Add an event to the update queue with debouncing
   *
   * @param event - The event to queue
   * @param options - Queue options
   */
  protected addToQueue(event: TEvent, options: QueueOptions = {}): void {
    const { debounceMs = this.defaultDebounceMs, immediate = false } = options;

    this.updateQueue.push(event);

    if (immediate) {
      this.processQueue();
      return;
    }

    // Clear existing timeout and set new one
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.processQueue();
    }, debounceMs);
  }

  /**
   * Process all events in the queue
   * Override this method to handle events
   */
  protected async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.updateQueue.length > 0) {
        const event = this.updateQueue.shift();
        if (event !== undefined) {
          await this.processEvent(event);
        }
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Error processing queue:`, error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Process a single event from the queue
   * Override this method in subclasses to handle specific event types
   *
   * @param event - The event to process
   */
  protected async processEvent(_event: TEvent): Promise<void> {
    // Default implementation does nothing
    // Subclasses should override this method
  }

  /**
   * Force immediate processing of the queue (bypass debounce)
   */
  forceProcessQueue(): Promise<void> {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    return this.processQueue();
  }

  /**
   * Clear the update queue without processing
   */
  clearQueue(): void {
    this.updateQueue = [];
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
  }

  /**
   * Reset the service to its initial state
   */
  reset(): void {
    this.clearQueue();
    this.state = this.getInitialState();
    this.lastNotifiedState = null;
    this.notifyListeners({ force: true });
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.clearQueue();
    this.listeners = [];
    this.lastNotifiedState = null;
  }
}

export default BaseBuilderService;
