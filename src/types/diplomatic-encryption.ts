/**
 * Type definitions for Diplomatic Encryption Service
 *
 * Provides comprehensive type safety for all encryption operations,
 * database models, and API integration.
 */

// ============================================================================
// CORE ENCRYPTION TYPES
// ============================================================================

export type ClassificationLevel = "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET";
export type EncryptionVersion = "v1" | "v2";
export type KeyStatus = "ACTIVE" | "ROTATED" | "REVOKED" | "EXPIRED";
export type EncryptionOperation =
  | "GENERATE_KEY"
  | "ENCRYPT"
  | "DECRYPT"
  | "SIGN"
  | "VERIFY"
  | "ROTATE_KEY"
  | "REVOKE_KEY";

/**
 * Encryption key pair for a country
 */
export interface KeyPair {
  publicKey: string; // Base64-encoded RSA public key
  privateKey: string; // Base64-encoded encrypted private key
  keyId: string; // Unique identifier
  version: EncryptionVersion; // Encryption algorithm version
  createdAt: Date; // Key creation timestamp
  expiresAt: Date; // Key expiration timestamp
}

/**
 * Encrypted message structure
 */
export interface EncryptedMessage {
  encryptedContent: string; // Base64-encoded encrypted content
  signature: string; // Base64-encoded RSA signature
  encryptionVersion: EncryptionVersion; // Version used for encryption
  iv: string; // Initialization vector (base64)
  encryptedKey: string; // RSA-encrypted AES key (base64)
  senderKeyId: string; // Sender's key identifier
  timestamp: number; // Unix timestamp
  classification: ClassificationLevel; // Message classification
}

/**
 * Decrypted message with verification status
 */
export interface DecryptedMessage {
  content: string; // Decrypted message content
  verified: boolean; // Signature verification result
  senderCountryId: string; // Sender's country ID
  timestamp: number; // Message timestamp
  classification: ClassificationLevel; // Message classification
}

/**
 * Encryption audit log entry
 */
export interface EncryptionAuditLog {
  id: string;
  countryId: string;
  operation: EncryptionOperation;
  classification: ClassificationLevel;
  success: boolean;
  errorMessage?: string;
  metadata: EncryptionAuditMetadata;
  timestamp: Date;
  userId?: string;
}

/**
 * Metadata for audit logs
 */
export interface EncryptionAuditMetadata {
  keyId?: string;
  recipientCountryId?: string;
  senderCountryId?: string;
  senderKeyId?: string;
  recipientKeyId?: string;
  messageLength?: number;
  durationMs?: number;
  signatureVerified?: boolean;
  version?: EncryptionVersion;
  expiresAt?: string;
  reason?: string;
  newKeyId?: string;
  [key: string]: any;
}

// ============================================================================
// DATABASE MODEL TYPES
// ============================================================================

/**
 * EncryptionKey database model
 */
export interface EncryptionKeyModel {
  id: string;
  countryId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  signingPublicKey: string;
  encryptedSigningPrivateKey: string;
  version: EncryptionVersion;
  status: KeyStatus;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  revocationReason?: string | null;
}

/**
 * EncryptionAuditLog database model
 */
export interface EncryptionAuditLogModel {
  id: string;
  countryId: string;
  operation: EncryptionOperation;
  classification: ClassificationLevel;
  success: boolean;
  errorMessage?: string | null;
  metadata: string; // JSON string
  timestamp: Date;
  userId?: string | null;
}

/**
 * DiplomaticMessage with encryption fields
 */
export interface DiplomaticMessageWithEncryption {
  id: string;
  channelId: string;
  fromCountryId: string;
  fromCountryName: string;
  toCountryId?: string | null;
  toCountryName?: string | null;
  subject?: string | null;
  content: string;
  classification: ClassificationLevel;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "SENT" | "DELIVERED" | "READ" | "ARCHIVED";
  encrypted: boolean;
  ixTimeTimestamp: number;
  createdAt: Date;
  updatedAt: Date;

  // Encryption fields
  encryptedContent?: string | null;
  signature?: string | null;
  encryptionVersion?: EncryptionVersion | null;
  iv?: string | null;
  encryptedKey?: string | null;
  senderKeyId?: string | null;
  signatureVerified?: boolean | null;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request to generate key pair
 */
export interface GenerateKeyPairRequest {
  countryId: string;
}

/**
 * Response from key pair generation
 */
export interface GenerateKeyPairResponse {
  success: boolean;
  keyPair?: KeyPair;
  error?: string;
}

/**
 * Request to encrypt a message
 */
export interface EncryptMessageRequest {
  message: string;
  recipientCountryId: string;
  senderCountryId: string;
  classification?: ClassificationLevel;
}

/**
 * Response from message encryption
 */
export interface EncryptMessageResponse {
  success: boolean;
  encryptedMessage?: EncryptedMessage;
  error?: string;
}

/**
 * Request to decrypt a message
 */
export interface DecryptMessageRequest {
  encryptedMessage: EncryptedMessage;
  recipientCountryId: string;
}

/**
 * Response from message decryption
 */
export interface DecryptMessageResponse {
  success: boolean;
  decryptedMessage?: DecryptedMessage;
  error?: string;
}

/**
 * Request to sign a message
 */
export interface SignMessageRequest {
  message: string;
  senderCountryId: string;
}

/**
 * Response from message signing
 */
export interface SignMessageResponse {
  success: boolean;
  signature?: string;
  error?: string;
}

/**
 * Request to verify a signature
 */
export interface VerifySignatureRequest {
  message: string;
  signature: string;
  senderCountryId: string;
}

/**
 * Response from signature verification
 */
export interface VerifySignatureResponse {
  success: boolean;
  verified?: boolean;
  error?: string;
}

/**
 * Request to rotate keys
 */
export interface RotateKeysRequest {
  countryId: string;
}

/**
 * Response from key rotation
 */
export interface RotateKeysResponse {
  success: boolean;
  newKeyPair?: KeyPair;
  error?: string;
}

/**
 * Request to revoke keys
 */
export interface RevokeKeysRequest {
  countryId: string;
  reason: string;
}

/**
 * Response from key revocation
 */
export interface RevokeKeysResponse {
  success: boolean;
  error?: string;
}

/**
 * Request to get public key
 */
export interface GetPublicKeyRequest {
  countryId: string;
}

/**
 * Response with public key
 */
export interface GetPublicKeyResponse {
  success: boolean;
  publicKey?: EncryptionKeyModel;
  error?: string;
}

// ============================================================================
// ENCRYPTION SERVICE OPTIONS
// ============================================================================

/**
 * Options for encryption operations
 */
export interface EncryptionOptions {
  classification?: ClassificationLevel;
  enforceSignature?: boolean;
  allowExpiredKeys?: boolean;
  skipAuditLog?: boolean;
}

/**
 * Options for key generation
 */
export interface KeyGenerationOptions {
  expiryDays?: number;
  keyLength?: 2048 | 4096;
  allowDuplicates?: boolean;
}

/**
 * Options for key rotation
 */
export interface KeyRotationOptions {
  revokeOldKeys?: boolean;
  gracePeriodDays?: number;
}

// ============================================================================
// SECURITY ANALYSIS TYPES
// ============================================================================

/**
 * Key security status
 */
export interface KeySecurityStatus {
  keyId: string;
  countryId: string;
  status: KeyStatus;
  age: number; // Days since creation
  expiresIn: number; // Days until expiration
  isExpired: boolean;
  isNearExpiry: boolean; // Within 30 days of expiration
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
}

/**
 * Encryption statistics for a country
 */
export interface EncryptionStatistics {
  countryId: string;
  totalMessagesEncrypted: number;
  totalMessagesDecrypted: number;
  totalSignatureVerifications: number;
  failedDecryptions: number;
  failedSignatureVerifications: number;
  averageEncryptionTime: number; // milliseconds
  averageDecryptionTime: number; // milliseconds
  keyRotations: number;
  lastKeyRotation?: Date;
  activeKeys: number;
  expiredKeys: number;
  revokedKeys: number;
}

/**
 * Audit log query parameters
 */
export interface AuditLogQueryParams {
  countryId?: string;
  operation?: EncryptionOperation;
  classification?: ClassificationLevel;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit log summary
 */
export interface AuditLogSummary {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  operationsByType: Record<EncryptionOperation, number>;
  operationsByClassification: Record<ClassificationLevel, number>;
  averageOperationTime: number;
  topCountries: Array<{ countryId: string; operations: number }>;
  topUsers: Array<{ userId: string; operations: number }>;
  recentErrors: Array<{
    operation: EncryptionOperation;
    error: string;
    timestamp: Date;
    countryId: string;
  }>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Encryption error types
 */
export type EncryptionErrorType =
  | "KEY_NOT_FOUND"
  | "KEY_EXPIRED"
  | "KEY_REVOKED"
  | "INVALID_SIGNATURE"
  | "DECRYPTION_FAILED"
  | "ENCRYPTION_FAILED"
  | "INVALID_CLASSIFICATION"
  | "UNAUTHORIZED"
  | "CRYPTO_API_UNAVAILABLE";

/**
 * Encryption error
 */
export interface EncryptionError {
  type: EncryptionErrorType;
  message: string;
  countryId?: string;
  keyId?: string;
  details?: Record<string, any>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if classification requires encryption
 */
export function requiresEncryption(classification: ClassificationLevel): boolean {
  return (
    classification === "RESTRICTED" ||
    classification === "CONFIDENTIAL" ||
    classification === "SECRET"
  );
}

/**
 * Check if key is expired
 */
export function isKeyExpired(key: EncryptionKeyModel): boolean {
  return new Date() > key.expiresAt;
}

/**
 * Check if key is active
 */
export function isKeyActive(key: EncryptionKeyModel): boolean {
  return key.status === "ACTIVE" && !isKeyExpired(key);
}

/**
 * Check if key needs rotation
 */
export function needsKeyRotation(key: EncryptionKeyModel, warningDays: number = 30): boolean {
  const daysUntilExpiry = Math.floor(
    (key.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysUntilExpiry <= warningDays;
}

/**
 * Get risk level for a key
 */
export function getKeyRiskLevel(key: EncryptionKeyModel): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (key.status === "REVOKED") return "CRITICAL";
  if (isKeyExpired(key)) return "CRITICAL";
  if (needsKeyRotation(key, 7)) return "HIGH";
  if (needsKeyRotation(key, 30)) return "MEDIUM";
  return "LOW";
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Encryption configuration constants
 */
export const ENCRYPTION_CONSTANTS = {
  KEY_EXPIRY_DAYS: 365,
  KEY_ROTATION_WARNING_DAYS: 30,
  RSA_KEY_LENGTH: 2048,
  AES_KEY_LENGTH: 256,
  IV_LENGTH: 12, // 96 bits for GCM
  MAX_MESSAGE_SIZE: 10 * 1024 * 1024, // 10MB
  PBKDF2_ITERATIONS: 100000,
  SIGNATURE_SALT_LENGTH: 32,
} as const;

/**
 * Classification level hierarchy
 */
export const CLASSIFICATION_HIERARCHY: Record<ClassificationLevel, number> = {
  PUBLIC: 0,
  RESTRICTED: 1,
  CONFIDENTIAL: 2,
  SECRET: 3,
};

/**
 * Check if one classification level is higher than another
 */
export function isHigherClassification(
  level1: ClassificationLevel,
  level2: ClassificationLevel
): boolean {
  return CLASSIFICATION_HIERARCHY[level1] > CLASSIFICATION_HIERARCHY[level2];
}
