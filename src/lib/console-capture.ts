// src/lib/console-capture.ts
const MAX_LOGS = 50;

export interface CapturedLog {
  type: string;
  message: string;
  timestamp: string;
}

export function initConsoleCapture() {
  if (typeof window === "undefined") return;
  if ((window as any).__console_logs_initialized__) return;
  (window as any).__console_logs_initialized__ = true;

  const logs: CapturedLog[] = [];
  (window as any).__console_logs__ = logs;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const addLog = (type: string, args: any[]) => {
    try {
      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return arg.stack || arg.message;
          }
          if (typeof arg === "object") {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(" ");

      logs.push({
        type,
        message,
        timestamp: new Date().toISOString(),
      });

      if (logs.length > MAX_LOGS) {
        logs.shift();
      }
    } catch {
      // Prevent infinite loops or errors in console override
    }
  };

  console.log = (...args) => {
    addLog("log", args);
    originalLog.apply(console, args);
  };

  console.warn = (...args) => {
    addLog("warn", args);
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    addLog("error", args);
    originalError.apply(console, args);
  };
}

export function getConsoleLogs(): CapturedLog[] {
  if (typeof window === "undefined") return [];
  return (window as any).__console_logs__ || [];
}
