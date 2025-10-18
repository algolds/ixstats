/**
 * Simple mutex for localStorage operations to prevent race conditions
 */

class LocalStorageMutex {
  private locks: Map<string, Promise<void>> = new Map();

  async withLock<T>(
    key: string,
    operation: () => Promise<T> | T
  ): Promise<T> {
    // Wait for any existing lock on this key
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock for this operation
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      const result = await operation();
      return result;
    } finally {
      // Release the lock
      resolveLock!();
      this.locks.delete(key);
    }
  }

  // Synchronous version for simple operations
  withLockSync<T>(key: string, operation: () => T): T {
    // For synchronous operations, we just check if there's an active lock
    const existingLock = this.locks.get(key);
    if (existingLock) {
      console.warn(`LocalStorage operation on '${key}' blocked by active lock`);
      // Return a default value or throw
      throw new Error(`LocalStorage operation on '${key}' is currently locked`);
    }

    return operation();
  }
}

// Singleton instance
export const localStorageMutex = new LocalStorageMutex();

// Helper functions for common localStorage operations
export async function safeGetItem(key: string): Promise<string | null> {
  return localStorageMutex.withLock(key, () => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.warn(`Failed to get localStorage item '${key}':`, error);
      return null;
    }
  });
}

export async function safeSetItem(key: string, value: string): Promise<void> {
  return localStorageMutex.withLock(key, () => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`Failed to set localStorage item '${key}':`, error);
      throw error;
    }
  });
}

export async function safeRemoveItem(key: string): Promise<void> {
  return localStorageMutex.withLock(key, () => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove localStorage item '${key}':`, error);
    }
  });
}

// Synchronous versions for cases where async isn't possible
export function safeGetItemSync(key: string): string | null {
  try {
    return localStorageMutex.withLockSync(key, () => localStorage.getItem(key));
  } catch (error) {
    console.warn(`Failed to get localStorage item '${key}':`, error);
    return null;
  }
}

export function safeSetItemSync(key: string, value: string): boolean {
  try {
    localStorageMutex.withLockSync(key, () => localStorage.setItem(key, value));
    return true;
  } catch (error) {
    console.warn(`Failed to set localStorage item '${key}':`, error);
    return false;
  }
}

export function safeRemoveItemSync(key: string): boolean {
  try {
    localStorageMutex.withLockSync(key, () => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.warn(`Failed to remove localStorage item '${key}':`, error);
    return false;
  }
}
