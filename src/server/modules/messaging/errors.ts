/**
 * Messaging Domain Errors (Plan 163)
 */

class MessagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingError";
  }
}

export class MessagingForbiddenError extends MessagingError {
  constructor(message = "Not authorized to access this conversation or resource") {
    super(message);
    this.name = "MessagingForbiddenError";
  }
}

/** The recipient has blocked the sender (Settings → Privacy & Security). */
export class MessagingBlockedError extends MessagingError {
  constructor(message = "This user is not accepting messages from you") {
    super(message);
    this.name = "MessagingBlockedError";
  }
}

export class MessagingNotFoundError extends MessagingError {
  constructor(message = "Conversation or message not found") {
    super(message);
    this.name = "MessagingNotFoundError";
  }
}

export class MessagingValidationError extends MessagingError {
  constructor(message = "Invalid messaging request") {
    super(message);
    this.name = "MessagingValidationError";
  }
}
