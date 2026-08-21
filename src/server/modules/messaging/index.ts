/**
 * Messaging Domain Module Entrypoint (Plan 163)
 */

export { MessagingService, createMessagingService } from "./service";

export type {
  MessageSource,
  MessageFolder,
  UserAccount,
  NotificationCollaborator,
  WebSocketCollaborator,
  BridgeCollaborator,
  TelemetryPayload,
  TelemetryLogger,
  MessagingDependencies,
  GetConversationsByFolderInput,
  GetConversationsLegacyInput,
  GetConversationMessagesInput,
  CreateConversationInput,
  CreateConversationByCountriesInput,
  SendMessageInput,
  EditMessageInput,
  DeleteMessageInput,
  MarkMessagesAsReadInput,
  AddReactionInput,
  RemoveReactionInput,
  AddParticipantInput,
  LeaveConversationInput,
  SearchUsersInput,
  UpdatePresenceInput,
} from "./contracts";

export {
  MessagingError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from "./errors";

export {
  formatMessagesConversation,
  formatMessagesMessage,
  formatThinkpagesConversation,
  formatThinkpagesMessage,
} from "./formatters";

export { recordMessagingTelemetry, defaultTelemetryLogger } from "./telemetry";
export { batchResolveMessagingAccounts } from "./account-resolver";
