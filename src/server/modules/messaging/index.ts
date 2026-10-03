/**
 * Messaging Domain Module Entrypoint (Plan 163)
 */

export { MessagingService, createMessagingService } from "./service";
export {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";
export { recordMessagingTelemetry } from "./telemetry";
