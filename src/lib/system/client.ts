/**
 * Client entrypoint for system & diagnostics primitives
 */

export { isStandaloneClient, isStandaloneRequest } from "./standalone-detection";

export {
  localStorageMutex,
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeGetItemSync,
  safeSetItemSync,
  safeRemoveItemSync,
} from "./local-storage-mutex";

export { logger, LogLevel, LogCategory, type LogEntry } from "./logger";

export {
  calculateAuditSummary,
  getStatusColor,
  getStatusBgColor,
  type CheckStatus,
  type ValidationCheck,
  type ValidationCategory,
  type AuditSummary,
} from "./system-validation";
