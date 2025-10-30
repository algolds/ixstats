/**
 * Diplomatic Encryption Service
 *
 * Provides end-to-end encryption for diplomatic communications with:
 * - RSA-2048 key pair generation for countries
 * - AES-256-GCM message encryption for performance
 * - RSA signature verification for authenticity
 * - Classification level enforcement (PUBLIC, RESTRICTED, CONFIDENTIAL)
 * - Key rotation support
 * - Comprehensive audit logging
 * - Browser-compatible using Web Crypto API with Node.js fallback
 *
 * Security Architecture:
 * - RSA-2048 for key exchange and signing
 * - AES-256-GCM for message content encryption
 * - PBKDF2 for key derivation
 * - SHA-256 for hashing and signatures
 * - Secure key storage with encryption at rest
 *
 * @module DiplomaticEncryption
 */

import { db } from "~/server/db";
import { UserLogger } from "./user-logger";
import type { UserLogContext } from "./user-logger";
import { logger, LogCategory } from "./logger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ClassificationLevel = "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET";
export type EncryptionVersion = "v1" | "v2";

export interface KeyPair {
  publicKey: string; // Base64-encoded public key
  privateKey: string; // Base64-encoded encrypted private key
  keyId: string; // Unique identifier for this key pair
  version: EncryptionVersion;
  createdAt: Date;
  expiresAt: Date; // For key rotation support
}

export type EncryptionKeyModel = KeyPair;

export interface EncryptedMessage {
  encryptedContent: string; // Base64-encoded encrypted content
  signature: string; // Base64-encoded signature
  encryptionVersion: EncryptionVersion;
  iv: string; // Initialization vector for AES
  encryptedKey: string; // RSA-encrypted AES key
  senderKeyId: string; // ID of sender's key pair
  timestamp: number; // Unix timestamp
  classification: ClassificationLevel;
}

export interface DecryptedMessage {
  content: string;
  verified: boolean; // Signature verification result
  senderCountryId: string;
  timestamp: number;
  classification: ClassificationLevel;
}

export interface EncryptionAuditLog {
  id: string;
  countryId: string;
  operation:
    | "GENERATE_KEY"
    | "ENCRYPT"
    | "DECRYPT"
    | "SIGN"
    | "VERIFY"
    | "ROTATE_KEY"
    | "REVOKE_KEY";
  classification: ClassificationLevel;
  success: boolean;
  errorMessage?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  userId?: string;
}

// ============================================================================
// CRYPTO UTILITIES
// ============================================================================

class CryptoUtils {
  /**
   * Get crypto API (browser SubtleCrypto or Node.js crypto)
   */
  private static getCrypto(): SubtleCrypto {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    // Node.js environment
    if (typeof global !== "undefined") {
      const { webcrypto } = require("crypto");
      return webcrypto.subtle as SubtleCrypto;
    }
    throw new Error("No crypto API available");
  }

  /**
   * Get random values (browser or Node.js)
   */
  private static getRandomValues(array: Uint8Array): Uint8Array {
    if (typeof window !== "undefined" && window.crypto) {
      return window.crypto.getRandomValues(array);
    }
    // Node.js environment
    const { randomFillSync } = require("crypto");
    return randomFillSync(array);
  }

  /**
   * Generate RSA-2048 key pair for encryption and signing
   */
  static async generateRSAKeyPair(): Promise<CryptoKeyPair> {
    const crypto = this.getCrypto();
    return await crypto.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Generate signing key pair
   */
  static async generateSigningKeyPair(): Promise<CryptoKeyPair> {
    const crypto = this.getCrypto();
    return await crypto.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
  }

  /**
   * Generate AES-256 key for message encryption
   */
  static async generateAESKey(): Promise<CryptoKey> {
    const crypto = this.getCrypto();
    return await crypto.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Export key to base64 string
   */
  static async exportKey(key: CryptoKey, format: "spki" | "pkcs8" | "raw"): Promise<string> {
    const crypto = this.getCrypto();
    const exported = await crypto.exportKey(format, key);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import key from base64 string
   */
  static async importKey(
    keyData: string,
    format: "spki" | "pkcs8" | "raw",
    algorithm: RsaHashedImportParams | AesKeyAlgorithm,
    extractable: boolean,
    keyUsages: KeyUsage[]
  ): Promise<CryptoKey> {
    const crypto = this.getCrypto();
    const buffer = this.base64ToArrayBuffer(keyData);
    return await crypto.importKey(format, buffer, algorithm, extractable, keyUsages);
  }

  /**
   * Encrypt data with RSA-OAEP
   */
  static async rsaEncrypt(publicKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const crypto = this.getCrypto();
    return await crypto.encrypt(
      {
        name: "RSA-OAEP",
      },
      publicKey,
      data
    );
  }

  /**
   * Decrypt data with RSA-OAEP
   */
  static async rsaDecrypt(privateKey: CryptoKey, encryptedData: ArrayBuffer): Promise<ArrayBuffer> {
    const crypto = this.getCrypto();
    return await crypto.decrypt(
      {
        name: "RSA-OAEP",
      },
      privateKey,
      encryptedData
    );
  }

  /**
   * Encrypt data with AES-GCM
   */
  static async aesEncrypt(key: CryptoKey, data: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
    const crypto = this.getCrypto();
    return await crypto.encrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
      },
      key,
      data
    );
  }

  /**
   * Decrypt data with AES-GCM
   */
  static async aesDecrypt(
    key: CryptoKey,
    encryptedData: ArrayBuffer,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    const crypto = this.getCrypto();
    return await crypto.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
      },
      key,
      encryptedData
    );
  }

  /**
   * Sign data with RSA-PSS
   */
  static async sign(privateKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    const crypto = this.getCrypto();
    return await crypto.sign(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      privateKey,
      data
    );
  }

  /**
   * Verify signature with RSA-PSS
   */
  static async verify(
    publicKey: CryptoKey,
    signature: ArrayBuffer,
    data: ArrayBuffer
  ): Promise<boolean> {
    const crypto = this.getCrypto();
    return await crypto.verify(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      publicKey,
      signature,
      data
    );
  }

  /**
   * Convert ArrayBuffer to base64
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return typeof btoa !== "undefined"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary =
      typeof atob !== "undefined" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }

  /**
   * Convert string to ArrayBuffer
   */
  static stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  /**
   * Convert ArrayBuffer to string
   */
  static arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  }

  /**
   * Generate random IV for AES
   */
  static generateIV(): Uint8Array {
    const iv = new Uint8Array(12); // 96-bit IV for GCM
    return this.getRandomValues(iv);
  }

  /**
   * Encrypt private key with master password (for storage)
   */
  static async encryptPrivateKey(privateKey: string, masterPassword: string): Promise<string> {
    // Derive key from master password using PBKDF2
    const crypto = this.getCrypto();
    const passwordBuffer = this.stringToArrayBuffer(masterPassword);
    const salt = this.generateIV();

    const keyMaterial = await crypto.importKey("raw", passwordBuffer, "PBKDF2", false, [
      "deriveBits",
      "deriveKey",
    ]);

    const derivedKey = await crypto.deriveKey(
      {
        name: "PBKDF2",
        salt: salt as BufferSource,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = this.generateIV();
    const privateKeyBuffer = this.stringToArrayBuffer(privateKey);
    const encryptedBuffer = await this.aesEncrypt(derivedKey, privateKeyBuffer, iv);

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedBuffer.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

    return this.arrayBufferToBase64(combined.buffer);
  }

  /**
   * Decrypt private key with master password
   */
  static async decryptPrivateKey(
    encryptedPrivateKey: string,
    masterPassword: string
  ): Promise<string> {
    const crypto = this.getCrypto();
    const combined = new Uint8Array(this.base64ToArrayBuffer(encryptedPrivateKey));

    const salt = combined.slice(0, 12);
    const iv = combined.slice(12, 24);
    const encryptedData = combined.slice(24);

    const passwordBuffer = this.stringToArrayBuffer(masterPassword);

    const keyMaterial = await crypto.importKey("raw", passwordBuffer, "PBKDF2", false, [
      "deriveBits",
      "deriveKey",
    ]);

    const derivedKey = await crypto.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const decryptedBuffer = await this.aesDecrypt(derivedKey, encryptedData.buffer, iv);
    return this.arrayBufferToString(decryptedBuffer);
  }
}

// ============================================================================
// DIPLOMATIC ENCRYPTION SERVICE
// ============================================================================

export class DiplomaticEncryptionService {
  private static readonly CURRENT_VERSION: EncryptionVersion = "v1";
  private static readonly KEY_EXPIRY_DAYS = 365; // Keys expire after 1 year
  private static readonly MASTER_PASSWORD =
    process.env.ENCRYPTION_MASTER_PASSWORD || "default-master-password-change-in-production";

  /**
   * Generate RSA key pair for a country
   *
   * @param countryId - Country ID to generate keys for
   * @param userContext - User context for audit logging
   * @returns KeyPair with public and encrypted private keys
   */
  static async generateKeyPair(countryId: string, userContext?: UserLogContext): Promise<KeyPair> {
    const startTime = Date.now();

    try {
      logger.info(LogCategory.SECURITY, `Generating encryption key pair for country: ${countryId}`);

      // Check if country already has active keys
      const existingKey = await db.encryptionKey.findFirst({
        where: {
          countryId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });

      if (existingKey) {
        throw new Error(
          `Country ${countryId} already has an active key pair. Revoke existing keys before generating new ones.`
        );
      }

      // Generate encryption key pair
      const encryptionKeyPair = await CryptoUtils.generateRSAKeyPair();
      const publicKey = await CryptoUtils.exportKey(encryptionKeyPair.publicKey, "spki");
      const privateKey = await CryptoUtils.exportKey(encryptionKeyPair.privateKey, "pkcs8");

      // Generate signing key pair
      const signingKeyPair = await CryptoUtils.generateSigningKeyPair();
      const signingPublicKey = await CryptoUtils.exportKey(signingKeyPair.publicKey, "spki");
      const signingPrivateKey = await CryptoUtils.exportKey(signingKeyPair.privateKey, "pkcs8");

      // Encrypt private keys with master password
      const encryptedPrivateKey = await CryptoUtils.encryptPrivateKey(
        privateKey,
        this.MASTER_PASSWORD
      );
      const encryptedSigningPrivateKey = await CryptoUtils.encryptPrivateKey(
        signingPrivateKey,
        this.MASTER_PASSWORD
      );

      const keyId = `key_${countryId}_${Date.now()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.KEY_EXPIRY_DAYS);

      // Store in database
      await db.encryptionKey.create({
        data: {
          id: keyId,
          countryId,
          publicKey,
          encryptedPrivateKey,
          signingPublicKey,
          encryptedSigningPrivateKey,
          version: this.CURRENT_VERSION,
          status: "ACTIVE",
          expiresAt,
          createdAt: new Date(),
        },
      });

      // Audit log
      await this.auditLog({
        countryId,
        operation: "GENERATE_KEY",
        classification: "CONFIDENTIAL",
        success: true,
        metadata: {
          keyId,
          version: this.CURRENT_VERSION,
          expiresAt: expiresAt.toISOString(),
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      // User activity log
      if (userContext) {
        await UserLogger.logDiplomaticAction(
          userContext,
          "GENERATE_ENCRYPTION_KEYS",
          `Generated encryption key pair for country ${countryId}`,
          countryId,
          {
            action: "GENERATE_ENCRYPTION_KEYS",
            severity: "HIGH",
            targetResource: "EncryptionKey",
            targetId: keyId,
            success: true,
            duration: Date.now() - startTime,
            metadata: { keyId, version: this.CURRENT_VERSION },
          }
        );
      }

      logger.info(
        LogCategory.SECURITY,
        `Successfully generated key pair for country ${countryId}: ${keyId}`
      );

      return {
        publicKey,
        privateKey: encryptedPrivateKey,
        keyId,
        version: this.CURRENT_VERSION,
        createdAt: new Date(),
        expiresAt,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        LogCategory.SECURITY,
        `Failed to generate key pair for country ${countryId}: ${errorMessage}`
      );

      // Audit log failure
      await this.auditLog({
        countryId,
        operation: "GENERATE_KEY",
        classification: "CONFIDENTIAL",
        success: false,
        errorMessage,
        metadata: { durationMs: Date.now() - startTime },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Encrypt a diplomatic message
   *
   * @param message - Plain text message content
   * @param recipientCountryId - Country ID of the recipient
   * @param senderCountryId - Country ID of the sender
   * @param classification - Classification level
   * @param userContext - User context for audit logging
   * @returns EncryptedMessage object
   */
  static async encryptMessage(
    message: string,
    recipientCountryId: string,
    senderCountryId: string,
    classification: ClassificationLevel = "RESTRICTED",
    userContext?: UserLogContext
  ): Promise<EncryptedMessage> {
    const startTime = Date.now();

    try {
      logger.info(
        LogCategory.SECURITY,
        `Encrypting message from ${senderCountryId} to ${recipientCountryId} [${classification}]`
      );

      // Get recipient's public key
      const recipientKey = await this.getCountryPublicKey(recipientCountryId);
      if (!recipientKey) {
        throw new Error(`No encryption key found for recipient country: ${recipientCountryId}`);
      }

      // Get sender's signing key
      const senderKey = await db.encryptionKey.findFirst({
        where: {
          countryId: senderCountryId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });

      if (!senderKey) {
        throw new Error(`No encryption key found for sender country: ${senderCountryId}`);
      }

      // Generate AES key for message encryption (for performance)
      const aesKey = await CryptoUtils.generateAESKey();
      const iv = CryptoUtils.generateIV();

      // Encrypt message content with AES
      const messageBuffer = CryptoUtils.stringToArrayBuffer(message);
      const encryptedMessageBuffer = await CryptoUtils.aesEncrypt(aesKey, messageBuffer, iv);

      // Export AES key and encrypt it with recipient's RSA public key
      const aesKeyRaw = await CryptoUtils.exportKey(aesKey, "raw");
      const aesKeyBuffer = CryptoUtils.base64ToArrayBuffer(aesKeyRaw);

      const recipientPublicKeyCrypto = await CryptoUtils.importKey(
        recipientKey.publicKey,
        "spki",
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );

      const encryptedAESKey = await CryptoUtils.rsaEncrypt(recipientPublicKeyCrypto, aesKeyBuffer);

      // Sign the message for authenticity
      const decryptedSigningKey = await CryptoUtils.decryptPrivateKey(
        senderKey.encryptedSigningPrivateKey,
        this.MASTER_PASSWORD
      );

      const signingPrivateKeyCrypto = await CryptoUtils.importKey(
        decryptedSigningKey,
        "pkcs8",
        { name: "RSA-PSS", hash: "SHA-256" },
        true,
        ["sign"]
      );

      const signature = await CryptoUtils.sign(signingPrivateKeyCrypto, messageBuffer);

      const encryptedMessage: EncryptedMessage = {
        encryptedContent: CryptoUtils.arrayBufferToBase64(encryptedMessageBuffer),
        signature: CryptoUtils.arrayBufferToBase64(signature),
        encryptionVersion: this.CURRENT_VERSION,
        iv: CryptoUtils.arrayBufferToBase64(iv.buffer as ArrayBuffer),
        encryptedKey: CryptoUtils.arrayBufferToBase64(encryptedAESKey),
        senderKeyId: senderKey.id,
        timestamp: Date.now(),
        classification,
      };

      // Audit log
      await this.auditLog({
        countryId: senderCountryId,
        operation: "ENCRYPT",
        classification,
        success: true,
        metadata: {
          recipientCountryId,
          senderKeyId: senderKey.id,
          recipientKeyId: recipientKey.id,
          messageLength: message.length,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      logger.info(
        LogCategory.SECURITY,
        `Successfully encrypted message from ${senderCountryId} to ${recipientCountryId}`
      );

      return encryptedMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to encrypt message: ${errorMessage}`);

      await this.auditLog({
        countryId: senderCountryId,
        operation: "ENCRYPT",
        classification,
        success: false,
        errorMessage,
        metadata: {
          recipientCountryId,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Decrypt an encrypted diplomatic message
   *
   * @param encryptedMessage - Encrypted message object
   * @param recipientCountryId - Country ID of the recipient (for verification)
   * @param userContext - User context for audit logging
   * @returns DecryptedMessage object with verification status
   */
  static async decryptMessage(
    encryptedMessage: EncryptedMessage,
    recipientCountryId: string,
    userContext?: UserLogContext
  ): Promise<DecryptedMessage> {
    const startTime = Date.now();

    try {
      logger.info(
        LogCategory.SECURITY,
        `Decrypting message for ${recipientCountryId} [${encryptedMessage.classification}]`
      );

      // Get recipient's private key
      const recipientKey = await db.encryptionKey.findFirst({
        where: {
          countryId: recipientCountryId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });

      if (!recipientKey) {
        throw new Error(`No encryption key found for recipient country: ${recipientCountryId}`);
      }

      // Get sender's public signing key
      const senderKey = await db.encryptionKey.findUnique({
        where: { id: encryptedMessage.senderKeyId },
      });

      if (!senderKey) {
        throw new Error(`Sender's encryption key not found: ${encryptedMessage.senderKeyId}`);
      }

      // Decrypt recipient's private key
      const decryptedPrivateKey = await CryptoUtils.decryptPrivateKey(
        recipientKey.encryptedPrivateKey,
        this.MASTER_PASSWORD
      );

      const privateKeyCrypto = await CryptoUtils.importKey(
        decryptedPrivateKey,
        "pkcs8",
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );

      // Decrypt AES key with RSA private key
      const encryptedAESKeyBuffer = CryptoUtils.base64ToArrayBuffer(encryptedMessage.encryptedKey);
      const aesKeyBuffer = await CryptoUtils.rsaDecrypt(privateKeyCrypto, encryptedAESKeyBuffer);

      const aesKey = await CryptoUtils.importKey(
        CryptoUtils.arrayBufferToBase64(aesKeyBuffer),
        "raw",
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"]
      );

      // Decrypt message content with AES
      const iv = new Uint8Array(CryptoUtils.base64ToArrayBuffer(encryptedMessage.iv));
      const encryptedContentBuffer = CryptoUtils.base64ToArrayBuffer(
        encryptedMessage.encryptedContent
      );
      const decryptedBuffer = await CryptoUtils.aesDecrypt(aesKey, encryptedContentBuffer, iv);
      const content = CryptoUtils.arrayBufferToString(decryptedBuffer);

      // Verify signature
      const signingPublicKeyCrypto = await CryptoUtils.importKey(
        senderKey.signingPublicKey,
        "spki",
        { name: "RSA-PSS", hash: "SHA-256" },
        true,
        ["verify"]
      );

      const signatureBuffer = CryptoUtils.base64ToArrayBuffer(encryptedMessage.signature);
      const messageBuffer = CryptoUtils.stringToArrayBuffer(content);
      const verified = await CryptoUtils.verify(
        signingPublicKeyCrypto,
        signatureBuffer,
        messageBuffer
      );

      // Audit log
      await this.auditLog({
        countryId: recipientCountryId,
        operation: "DECRYPT",
        classification: encryptedMessage.classification,
        success: true,
        metadata: {
          senderCountryId: senderKey.countryId,
          senderKeyId: encryptedMessage.senderKeyId,
          signatureVerified: verified,
          messageLength: content.length,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      if (!verified) {
        logger.warn(
          LogCategory.SECURITY,
          `Signature verification failed for message to ${recipientCountryId} from ${senderKey.countryId}`
        );
      }

      logger.info(
        LogCategory.SECURITY,
        `Successfully decrypted message for ${recipientCountryId} (verified: ${verified})`
      );

      return {
        content,
        verified,
        senderCountryId: senderKey.countryId,
        timestamp: encryptedMessage.timestamp,
        classification: encryptedMessage.classification,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to decrypt message: ${errorMessage}`);

      await this.auditLog({
        countryId: recipientCountryId,
        operation: "DECRYPT",
        classification: encryptedMessage.classification,
        success: false,
        errorMessage,
        metadata: {
          senderKeyId: encryptedMessage.senderKeyId,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Sign a message for authenticity (without encryption)
   *
   * @param message - Message content to sign
   * @param senderCountryId - Country ID of the sender
   * @param userContext - User context for audit logging
   * @returns Base64-encoded signature
   */
  static async signMessage(
    message: string,
    senderCountryId: string,
    userContext?: UserLogContext
  ): Promise<string> {
    const startTime = Date.now();

    try {
      logger.info(LogCategory.SECURITY, `Signing message for country: ${senderCountryId}`);

      const senderKey = await db.encryptionKey.findFirst({
        where: {
          countryId: senderCountryId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
        },
      });

      if (!senderKey) {
        throw new Error(`No encryption key found for sender country: ${senderCountryId}`);
      }

      const decryptedSigningKey = await CryptoUtils.decryptPrivateKey(
        senderKey.encryptedSigningPrivateKey,
        this.MASTER_PASSWORD
      );

      const signingPrivateKeyCrypto = await CryptoUtils.importKey(
        decryptedSigningKey,
        "pkcs8",
        { name: "RSA-PSS", hash: "SHA-256" },
        true,
        ["sign"]
      );

      const messageBuffer = CryptoUtils.stringToArrayBuffer(message);
      const signature = await CryptoUtils.sign(signingPrivateKeyCrypto, messageBuffer);

      await this.auditLog({
        countryId: senderCountryId,
        operation: "SIGN",
        classification: "PUBLIC",
        success: true,
        metadata: {
          senderKeyId: senderKey.id,
          messageLength: message.length,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      return CryptoUtils.arrayBufferToBase64(signature);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to sign message: ${errorMessage}`);

      await this.auditLog({
        countryId: senderCountryId,
        operation: "SIGN",
        classification: "PUBLIC",
        success: false,
        errorMessage,
        metadata: { durationMs: Date.now() - startTime },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Verify a message signature
   *
   * @param message - Message content
   * @param signature - Base64-encoded signature
   * @param senderCountryId - Country ID of the sender
   * @param userContext - User context for audit logging
   * @returns True if signature is valid
   */
  static async verifySignature(
    message: string,
    signature: string,
    senderCountryId: string,
    userContext?: UserLogContext
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      logger.info(LogCategory.SECURITY, `Verifying signature from country: ${senderCountryId}`);

      const senderKey = await this.getCountryPublicKey(senderCountryId);
      if (!senderKey) {
        throw new Error(`No encryption key found for sender country: ${senderCountryId}`);
      }

      const signingPublicKeyCrypto = await CryptoUtils.importKey(
        senderKey.signingPublicKey,
        "spki",
        { name: "RSA-PSS", hash: "SHA-256" },
        true,
        ["verify"]
      );

      const signatureBuffer = CryptoUtils.base64ToArrayBuffer(signature);
      const messageBuffer = CryptoUtils.stringToArrayBuffer(message);
      const verified = await CryptoUtils.verify(
        signingPublicKeyCrypto,
        signatureBuffer,
        messageBuffer
      );

      await this.auditLog({
        countryId: senderCountryId,
        operation: "VERIFY",
        classification: "PUBLIC",
        success: true,
        metadata: {
          senderKeyId: senderKey.id,
          verified,
          messageLength: message.length,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      return verified;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to verify signature: ${errorMessage}`);

      await this.auditLog({
        countryId: senderCountryId,
        operation: "VERIFY",
        classification: "PUBLIC",
        success: false,
        errorMessage,
        metadata: { durationMs: Date.now() - startTime },
        userId: userContext?.userId,
      });

      return false;
    }
  }

  /**
   * Get a country's public key
   *
   * @param countryId - Country ID
   * @returns Encryption key record or null
   */
  static async getCountryPublicKey(countryId: string) {
    return await db.encryptionKey.findFirst({
      where: {
        countryId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Rotate encryption keys for a country
   *
   * @param countryId - Country ID
   * @param userContext - User context for audit logging
   * @returns New KeyPair
   */
  static async rotateKeys(countryId: string, userContext?: UserLogContext): Promise<KeyPair> {
    const startTime = Date.now();

    try {
      logger.info(LogCategory.SECURITY, `Rotating encryption keys for country: ${countryId}`);

      // Mark existing keys as ROTATED
      await db.encryptionKey.updateMany({
        where: {
          countryId,
          status: "ACTIVE",
        },
        data: {
          status: "ROTATED",
        },
      });

      // Generate new key pair
      const newKeyPair = await this.generateKeyPair(countryId, userContext);

      await this.auditLog({
        countryId,
        operation: "ROTATE_KEY",
        classification: "CONFIDENTIAL",
        success: true,
        metadata: {
          newKeyId: newKeyPair.keyId,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      logger.info(LogCategory.SECURITY, `Successfully rotated keys for country ${countryId}`);

      return newKeyPair;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to rotate keys: ${errorMessage}`);

      await this.auditLog({
        countryId,
        operation: "ROTATE_KEY",
        classification: "CONFIDENTIAL",
        success: false,
        errorMessage,
        metadata: { durationMs: Date.now() - startTime },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Revoke a country's encryption keys
   *
   * @param countryId - Country ID
   * @param reason - Reason for revocation
   * @param userContext - User context for audit logging
   */
  static async revokeKeys(
    countryId: string,
    reason: string,
    userContext?: UserLogContext
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        LogCategory.SECURITY,
        `Revoking encryption keys for country: ${countryId} (${reason})`
      );

      await db.encryptionKey.updateMany({
        where: {
          countryId,
          status: { in: ["ACTIVE", "ROTATED"] },
        },
        data: {
          status: "REVOKED",
        },
      });

      await this.auditLog({
        countryId,
        operation: "REVOKE_KEY",
        classification: "CONFIDENTIAL",
        success: true,
        metadata: {
          reason,
          durationMs: Date.now() - startTime,
        },
        userId: userContext?.userId,
      });

      logger.info(LogCategory.SECURITY, `Successfully revoked keys for country ${countryId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SECURITY, `Failed to revoke keys: ${errorMessage}`);

      await this.auditLog({
        countryId,
        operation: "REVOKE_KEY",
        classification: "CONFIDENTIAL",
        success: false,
        errorMessage,
        metadata: { reason, durationMs: Date.now() - startTime },
        userId: userContext?.userId,
      });

      throw error;
    }
  }

  /**
   * Check if classification level allows encryption
   *
   * @param classification - Classification level
   * @returns True if encryption is required
   */
  static requiresEncryption(classification: ClassificationLevel): boolean {
    return (
      classification === "RESTRICTED" ||
      classification === "CONFIDENTIAL" ||
      classification === "SECRET"
    );
  }

  /**
   * Audit log for encryption operations
   */
  private static async auditLog(log: Omit<EncryptionAuditLog, "id" | "timestamp">): Promise<void> {
    try {
      await db.encryptionAuditLog.create({
        data: {
          ...log,
          metadata: JSON.stringify(log.metadata),
        },
      });
    } catch (error) {
      logger.error(
        LogCategory.SECURITY,
        `Failed to write encryption audit log: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      // Don't throw - audit log failures shouldn't break encryption operations
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DiplomaticEncryptionService;
