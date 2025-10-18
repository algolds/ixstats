# Diplomatic Encryption Service - Database Schema Changes

This document outlines the required database schema changes to support the Diplomatic Encryption Service.

## Required Schema Additions

Add the following models to `/prisma/schema.prisma`:

### 1. EncryptionKey Model

Stores encryption key pairs for countries with support for key rotation.

```prisma
model EncryptionKey {
  id                          String   @id @default(cuid())
  countryId                   String
  publicKey                   String   @db.Text // Base64-encoded RSA public key
  encryptedPrivateKey         String   @db.Text // Encrypted RSA private key
  signingPublicKey            String   @db.Text // Base64-encoded RSA signing public key
  encryptedSigningPrivateKey  String   @db.Text // Encrypted RSA signing private key
  version                     String   @default("v1") // Encryption version
  status                      String   @default("ACTIVE") // ACTIVE, ROTATED, REVOKED, EXPIRED
  createdAt                   DateTime @default(now())
  expiresAt                   DateTime
  revokedAt                   DateTime?
  revocationReason            String?

  // Relations
  country                     Country  @relation(fields: [countryId], references: [id], onDelete: Cascade)

  @@index([countryId])
  @@index([status])
  @@index([expiresAt])
}
```

### 2. EncryptionAuditLog Model

Comprehensive audit logging for all encryption operations.

```prisma
model EncryptionAuditLog {
  id             String   @id @default(cuid())
  countryId      String
  operation      String   // GENERATE_KEY, ENCRYPT, DECRYPT, SIGN, VERIFY, ROTATE_KEY, REVOKE_KEY
  classification String   // PUBLIC, RESTRICTED, CONFIDENTIAL
  success        Boolean
  errorMessage   String?
  metadata       String   @db.Text // JSON string with operation details
  timestamp      DateTime @default(now())
  userId         String?

  @@index([countryId])
  @@index([operation])
  @@index([timestamp])
  @@index([userId])
  @@index([success])
}
```

### 3. Updates to DiplomaticMessage Model

Add encryption-related fields to the existing `DiplomaticMessage` model:

```prisma
model DiplomaticMessage {
  id              String   @id @default(cuid())
  channelId       String
  fromCountryId   String
  fromCountryName String
  toCountryId     String?
  toCountryName   String?
  subject         String?
  content         String   @db.Text
  classification  String   @default("PUBLIC")
  priority        String   @default("NORMAL")
  status          String   @default("SENT")
  encrypted       Boolean  @default(false)
  ixTimeTimestamp Float
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // NEW ENCRYPTION FIELDS
  encryptedContent    String?  @db.Text // Base64-encoded encrypted content
  signature           String?  @db.Text // Base64-encoded message signature
  encryptionVersion   String?  @default("v1") // Encryption version used
  iv                  String?  @db.Text // Initialization vector for AES
  encryptedKey        String?  @db.Text // RSA-encrypted AES key
  senderKeyId         String?  // Reference to sender's encryption key
  signatureVerified   Boolean? @default(false) // Signature verification status

  // Relations
  channel DiplomaticChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@index([channelId])
  @@index([fromCountryId])
  @@index([toCountryId])
  @@index([classification])
  @@index([priority])
  @@index([status])
  @@index([ixTimeTimestamp])
  @@index([encrypted]) // NEW
  @@index([senderKeyId]) // NEW
}
```

### 4. Update Country Model

Add encryption key relation to the existing `Country` model:

```prisma
model Country {
  // ... existing fields ...

  // NEW RELATION
  encryptionKeys  EncryptionKey[]

  // ... existing relations ...
}
```

## Migration Steps

### Step 1: Create Migration File

Run the following command to create a new migration:

```bash
npx prisma migrate dev --name add_diplomatic_encryption
```

### Step 2: Manual Migration SQL (if needed)

If you need to create the migration manually, here's the SQL:

```sql
-- Create EncryptionKey table
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "signingPublicKey" TEXT NOT NULL,
    "encryptedSigningPrivateKey" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    CONSTRAINT "EncryptionKey_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EncryptionKey_countryId_idx" ON "EncryptionKey"("countryId");
CREATE INDEX "EncryptionKey_status_idx" ON "EncryptionKey"("status");
CREATE INDEX "EncryptionKey_expiresAt_idx" ON "EncryptionKey"("expiresAt");

-- Create EncryptionAuditLog table
CREATE TABLE "EncryptionAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "success" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "metadata" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT
);

CREATE INDEX "EncryptionAuditLog_countryId_idx" ON "EncryptionAuditLog"("countryId");
CREATE INDEX "EncryptionAuditLog_operation_idx" ON "EncryptionAuditLog"("operation");
CREATE INDEX "EncryptionAuditLog_timestamp_idx" ON "EncryptionAuditLog"("timestamp");
CREATE INDEX "EncryptionAuditLog_userId_idx" ON "EncryptionAuditLog"("userId");
CREATE INDEX "EncryptionAuditLog_success_idx" ON "EncryptionAuditLog"("success");

-- Add encryption fields to DiplomaticMessage
ALTER TABLE "DiplomaticMessage" ADD COLUMN "encryptedContent" TEXT;
ALTER TABLE "DiplomaticMessage" ADD COLUMN "signature" TEXT;
ALTER TABLE "DiplomaticMessage" ADD COLUMN "encryptionVersion" TEXT DEFAULT 'v1';
ALTER TABLE "DiplomaticMessage" ADD COLUMN "iv" TEXT;
ALTER TABLE "DiplomaticMessage" ADD COLUMN "encryptedKey" TEXT;
ALTER TABLE "DiplomaticMessage" ADD COLUMN "senderKeyId" TEXT;
ALTER TABLE "DiplomaticMessage" ADD COLUMN "signatureVerified" INTEGER DEFAULT 0;

CREATE INDEX "DiplomaticMessage_encrypted_idx" ON "DiplomaticMessage"("encrypted");
CREATE INDEX "DiplomaticMessage_senderKeyId_idx" ON "DiplomaticMessage"("senderKeyId");
```

### Step 3: Generate Prisma Client

After migration, regenerate the Prisma client:

```bash
npx prisma generate
```

## Environment Variables

Add the following environment variable to `.env`:

```env
# Master password for encrypting private keys at rest
# IMPORTANT: Use a strong, unique password in production
ENCRYPTION_MASTER_PASSWORD=your-secure-master-password-here
```

**Security Note:** In production, this should be:
- At least 32 characters long
- Randomly generated
- Stored in a secure vault (e.g., AWS Secrets Manager, Azure Key Vault)
- Rotated periodically

## Usage Examples

### 1. Generate Key Pair for a Country

```typescript
import { DiplomaticEncryptionService } from '~/lib/diplomatic-encryption';

const keyPair = await DiplomaticEncryptionService.generateKeyPair(
  'country_123',
  userContext // Optional for audit logging
);
```

### 2. Encrypt a Diplomatic Message

```typescript
const encryptedMessage = await DiplomaticEncryptionService.encryptMessage(
  'This is a confidential diplomatic message',
  'recipient_country_id',
  'sender_country_id',
  'CONFIDENTIAL',
  userContext
);

// Store in database
await db.diplomaticMessage.create({
  data: {
    channelId: 'channel_123',
    fromCountryId: 'sender_country_id',
    fromCountryName: 'Sender Country',
    toCountryId: 'recipient_country_id',
    toCountryName: 'Recipient Country',
    subject: 'Confidential Communication',
    content: encryptedMessage.encryptedContent, // Store encrypted
    encrypted: true,
    encryptedContent: encryptedMessage.encryptedContent,
    signature: encryptedMessage.signature,
    encryptionVersion: encryptedMessage.encryptionVersion,
    iv: encryptedMessage.iv,
    encryptedKey: encryptedMessage.encryptedKey,
    senderKeyId: encryptedMessage.senderKeyId,
    classification: 'CONFIDENTIAL',
    ixTimeTimestamp: Date.now(),
  },
});
```

### 3. Decrypt a Message

```typescript
const message = await db.diplomaticMessage.findUnique({
  where: { id: 'message_123' },
});

if (message.encrypted && message.encryptedContent) {
  const encryptedMessage = {
    encryptedContent: message.encryptedContent,
    signature: message.signature!,
    encryptionVersion: message.encryptionVersion!,
    iv: message.iv!,
    encryptedKey: message.encryptedKey!,
    senderKeyId: message.senderKeyId!,
    timestamp: message.createdAt.getTime(),
    classification: message.classification as ClassificationLevel,
  };

  const decrypted = await DiplomaticEncryptionService.decryptMessage(
    encryptedMessage,
    'recipient_country_id',
    userContext
  );

  console.log('Decrypted content:', decrypted.content);
  console.log('Signature verified:', decrypted.verified);
}
```

### 4. Sign a Public Message (No Encryption)

```typescript
const signature = await DiplomaticEncryptionService.signMessage(
  'This is a public announcement',
  'sender_country_id',
  userContext
);

// Verify signature
const isValid = await DiplomaticEncryptionService.verifySignature(
  'This is a public announcement',
  signature,
  'sender_country_id',
  userContext
);
```

### 5. Rotate Keys

```typescript
const newKeyPair = await DiplomaticEncryptionService.rotateKeys(
  'country_123',
  userContext
);
// Old keys are marked as ROTATED, new keys are ACTIVE
```

### 6. Revoke Keys

```typescript
await DiplomaticEncryptionService.revokeKeys(
  'country_123',
  'Security breach detected',
  userContext
);
// All keys for the country are marked as REVOKED
```

## Integration with Diplomatic Router

Update `/src/server/api/routers/diplomatic.ts`:

```typescript
import { DiplomaticEncryptionService } from '~/lib/diplomatic-encryption';

// Update sendMessage mutation
sendMessage: protectedProcedure
  .input(z.object({
    // ... existing fields ...
    encrypted: z.boolean().default(false)
  }))
  .mutation(async ({ ctx, input }) => {
    let messageData: any = {
      // ... existing fields ...
      content: input.content,
      encrypted: input.encrypted,
    };

    // Auto-encrypt for RESTRICTED and CONFIDENTIAL
    if (DiplomaticEncryptionService.requiresEncryption(input.classification as any)) {
      const encryptedMessage = await DiplomaticEncryptionService.encryptMessage(
        input.content,
        input.toCountryId!,
        input.fromCountryId,
        input.classification as any,
        {
          userId: ctx.user.id,
          clerkUserId: ctx.user.clerkUserId,
          countryId: ctx.user.countryId,
        }
      );

      messageData = {
        ...messageData,
        encrypted: true,
        encryptedContent: encryptedMessage.encryptedContent,
        signature: encryptedMessage.signature,
        encryptionVersion: encryptedMessage.encryptionVersion,
        iv: encryptedMessage.iv,
        encryptedKey: encryptedMessage.encryptedKey,
        senderKeyId: encryptedMessage.senderKeyId,
        content: '[ENCRYPTED]', // Placeholder for plaintext field
      };
    }

    return await ctx.db.diplomaticMessage.create({
      data: messageData,
    });
  }),
```

## Security Best Practices

### 1. Key Management
- Generate keys immediately when a country is created
- Rotate keys annually or after security incidents
- Revoke keys immediately upon detection of compromise
- Never log or expose private keys in any form

### 2. Classification Enforcement
- PUBLIC: No encryption required, optional signing
- RESTRICTED: Encryption required, signing required
- CONFIDENTIAL: Encryption required, signing required, additional access controls

### 3. Audit Logging
- All encryption operations are logged to `EncryptionAuditLog`
- User actions are logged via `UserLogger`
- Failed operations are logged with error details
- Audit logs should be regularly reviewed for security incidents

### 4. Production Configuration
- Use environment-specific master passwords
- Store master password in secure vault
- Implement key rotation schedule
- Monitor audit logs for suspicious activity
- Implement rate limiting on encryption operations

### 5. Performance Considerations
- AES-256-GCM is used for message content (fast)
- RSA-2048 is only used for key exchange (slower but secure)
- Signature verification is performed on decryption
- Consider caching public keys for frequently contacted countries

## Testing Checklist

- [ ] Generate key pair for a country
- [ ] Encrypt and decrypt a message successfully
- [ ] Verify signature verification works correctly
- [ ] Test classification enforcement
- [ ] Verify audit logging for all operations
- [ ] Test key rotation functionality
- [ ] Test key revocation
- [ ] Verify error handling for expired keys
- [ ] Test browser and Node.js environments
- [ ] Verify performance with large messages
- [ ] Test concurrent encryption operations
- [ ] Verify database constraints and indexes

## Troubleshooting

### Issue: "No crypto API available"
- Ensure running in browser or Node.js 15+ environment
- Check that `webcrypto` is available in Node.js

### Issue: "No encryption key found"
- Generate keys for the country using `generateKeyPair()`
- Verify keys are not expired or revoked

### Issue: "Signature verification failed"
- Ensure message content hasn't been modified
- Verify sender's key ID matches the stored key
- Check that sender's public key is still valid

### Issue: "Master password error"
- Verify `ENCRYPTION_MASTER_PASSWORD` is set correctly
- Ensure the same password is used for encryption and decryption
- Check for environment variable typos

## Future Enhancements

- [ ] Add support for group message encryption (multiple recipients)
- [ ] Implement forward secrecy with ephemeral keys
- [ ] Add support for file/attachment encryption
- [ ] Implement automatic key rotation based on usage
- [ ] Add support for emergency key recovery
- [ ] Implement key escrow for compliance
- [ ] Add support for hardware security modules (HSM)
- [ ] Implement quantum-resistant encryption algorithms
