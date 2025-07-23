// src/types/client.ts
// Type utilities for client-side components

/**
 * Marks a function as a client-side callback to suppress Next.js warnings
 * about non-serializable props in "use client" components
 *
 * Note: If you need to support specific argument types, use a generic or overload as needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClientCallback<T extends (...args: any[]) => any> = T & {
    readonly __clientCallback: true;
  };
  
  /**
   * Helper to create a client callback type
   */
  export function createClientCallback<T extends (...args: any[]) => any>(fn: T): ClientCallback<T> {
    return fn as ClientCallback<T>;
  }
  
  /**
   * Common client callback types for chart components
   */
  export namespace ChartCallbacks {
    export type OnChartTypeChange = ClientCallback<(type: string) => void>;
    export type OnTimeRangeChange = ClientCallback<(range: string) => void>;
    export type OnTimeChange = ClientCallback<(time: number) => void>;
    export type OnDataChange<T> = ClientCallback<(data: T) => void>;
    export type OnToggle = ClientCallback<(enabled: boolean) => void>;
  }
  
  /**
   * Props interface for components with client callbacks
   */
  export interface ClientComponentProps {
    children?: React.ReactNode;
    className?: string;
  }
  
  /**
   * Base props for chart components
   */
  export interface ChartComponentProps extends ClientComponentProps {
    isLoading?: boolean;
    error?: string | null;
  }