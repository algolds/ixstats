/**
 * Messaging Domain Service (Plan 163)
 *
 * Single domain service orchestrator delegating to specialized
 * query, message, and conversation sub-services.
 */

import {
  DEFAULT_USER_MESSAGE_CAP,
  type MessagingDependencies,
  type UserAccount,
  type GetConversationsByFolderInput,
  type GetConversationsLegacyInput,
  type GetConversationMessagesInput,
  type CreateConversationInput,
  type CreateConversationByCountriesInput,
  type SendMessageInput,
  type EditMessageInput,
  type DeleteMessageInput,
  type MarkMessagesAsReadInput,
  type AddReactionInput,
  type RemoveReactionInput,
  type AddParticipantInput,
  type LeaveConversationInput,
  type SearchUsersInput,
  type UpdatePresenceInput,
  type SendAdminBroadcastInput,
  type SendAdminMessageInput,
} from "./contracts";
import { batchResolveMessagingAccounts } from "./account-resolver";
import { MessagingQueryOperations } from "./query-operations";
import { MessagingMessageOperations } from "./message-operations";
import { MessagingConversationOperations } from "./conversation-operations";

export class MessagingService {
  private db: any;
  private queries: MessagingQueryOperations;
  private messages: MessagingMessageOperations;
  private conversations: MessagingConversationOperations;

  constructor(dependencies: MessagingDependencies) {
    this.db = dependencies.db;
    this.queries = new MessagingQueryOperations(dependencies);
    this.messages = new MessagingMessageOperations(dependencies);
    this.conversations = new MessagingConversationOperations(dependencies);
  }

  // ─── Identity & Account Resolution ─────────────────────────────────────────

  public async batchResolveUsers(userIds: string[]): Promise<Map<string, UserAccount>> {
    return await batchResolveMessagingAccounts(userIds, this.db);
  }

  // ─── Query Operations ──────────────────────────────────────────────────────

  public async getConversationsByFolder(actorId: string, input: GetConversationsByFolderInput) {
    return await this.queries.getConversationsByFolder(actorId, input);
  }

  public async getFolderCounts(actorId: string) {
    return await this.queries.getFolderCounts(actorId);
  }

  public async getConversation(actorId: string, conversationId: string) {
    return await this.queries.getConversation(actorId, conversationId);
  }

  public async getConversationsLegacy(actorId: string, input: GetConversationsLegacyInput) {
    return await this.queries.getConversationsLegacy(actorId, input);
  }

  public async getConversationMessages(actorId: string, input: GetConversationMessagesInput) {
    return await this.queries.getConversationMessages(actorId, input);
  }

  public async searchUsers(actorId: string, input: SearchUsersInput) {
    return await this.queries.searchUsers(actorId, input);
  }

  public async getPresenceForUsers(userIds: string[]) {
    return await this.queries.getPresenceForUsers(userIds);
  }

  // ─── Message Operations ────────────────────────────────────────────────────

  public async sendMessage(actorId: string, input: SendMessageInput) {
    return await this.messages.sendMessage(actorId, input);
  }

  public async editMessage(actorId: string, input: EditMessageInput) {
    return await this.messages.editMessage(actorId, input);
  }

  public async deleteMessage(actorId: string, input: DeleteMessageInput) {
    return await this.messages.deleteMessage(actorId, input);
  }

  public async markMessagesAsRead(actorId: string, input: MarkMessagesAsReadInput) {
    return await this.messages.markMessagesAsRead(actorId, input);
  }

  public async markAllAsRead(actorId: string) {
    return await this.messages.markAllAsRead(actorId);
  }

  public async addReaction(actorId: string, input: AddReactionInput) {
    return await this.messages.addReaction(actorId, input);
  }

  public async removeReaction(actorId: string, input: RemoveReactionInput) {
    return await this.messages.removeReaction(actorId, input);
  }

  public async pruneOldMessagesForUser(
    userId: string,
    cap: number = DEFAULT_USER_MESSAGE_CAP
  ): Promise<number> {
    return await this.messages.pruneOldMessagesForUser(userId, cap);
  }

  public async pruneConversationMessages(
    conversationId: string,
    cap: number = DEFAULT_USER_MESSAGE_CAP
  ): Promise<number> {
    return await this.messages.pruneConversationMessages(conversationId, cap);
  }

  // ─── Conversation Operations ───────────────────────────────────────────────

  public async createConversation(actorId: string, input: CreateConversationInput) {
    return await this.conversations.createConversation(actorId, input);
  }

  public async createConversationByCountries(
    actorId: string,
    input: CreateConversationByCountriesInput
  ) {
    return await this.conversations.createConversationByCountries(actorId, input);
  }

  public async addParticipant(actorId: string, input: AddParticipantInput) {
    return await this.conversations.addParticipant(actorId, input);
  }

  public async leaveConversation(actorId: string, input: LeaveConversationInput) {
    return await this.conversations.leaveConversation(actorId, input);
  }

  public async clearAllSystemNotifications(actorId: string) {
    return await this.conversations.clearAllSystemNotifications(actorId);
  }

  public async updatePresence(actorId: string, input: UpdatePresenceInput) {
    return await this.conversations.updatePresence(actorId, input);
  }

  public async syncDiscussions(actorId: string) {
    return await this.conversations.syncDiscussions(actorId);
  }

  public async sendAdminBroadcast(_actorId: string, input: SendAdminBroadcastInput) {
    return await this.conversations.sendAdminBroadcast(input);
  }

  public async sendAdminMessage(actorId: string, input: SendAdminMessageInput) {
    return await this.conversations.sendAdminMessage(actorId, input);
  }
}

export function createMessagingService(dependencies: MessagingDependencies): MessagingService {
  return new MessagingService(dependencies);
}
