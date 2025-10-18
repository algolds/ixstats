# Social Platform Guide

**Version:** 1.1.0
**Last Updated:** October 2025
**Status:** Production-Ready (85% Feature Complete)

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [ThinkPages Feed](#thinkpages-feed)
4. [ThinkTanks Groups](#thinktanks-groups)
5. [ThinkShare Messaging](#thinkshare-messaging)
6. [Database Models](#database-models)
7. [API Endpoints](#api-endpoints)
8. [Component Hierarchy](#component-hierarchy)
9. [WebSocket Integration](#websocket-integration)
10. [Account System](#account-system)
11. [Development Guide](#development-guide)

---

## Overview

The IxStats Social Platform is a comprehensive in-universe social networking system consisting of three interconnected subsystems:

- **ThinkPages Feed**: Public social media platform with posts, reactions, and trending topics (like Twitter/X)
- **ThinkTanks**: Private group discussions with collaborative documents (like Discord/Slack)
- **ThinkShare**: Direct messaging system with real-time conversations (like Messenger)

### Key Features

- **54 tRPC Endpoints**: 22 feed + 16 tanks + 12 share + 4 utility
- **14 Database Models**: Complete relational schema with Prisma ORM
- **Dual Account System**: ThinkpagesAccount (feed posts) vs User (tanks/share)
- **Real-time Updates**: WebSocket integration for live messaging
- **Rich Content**: Wiki integration, Unsplash/Commons images, Discord emoji support
- **Notification System**: Unified notifications for all platform activities

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Social Platform                           │
├─────────────────┬─────────────────┬──────────────────────────┤
│  ThinkPages     │   ThinkTanks    │      ThinkShare          │
│  (Feed/Posts)   │   (Groups)      │      (Messaging)         │
├─────────────────┼─────────────────┼──────────────────────────┤
│ • Posts         │ • Groups        │ • Conversations          │
│ • Reactions     │ • Messages      │ • Direct Messages        │
│ • Accounts      │ • Documents     │ • Read Receipts          │
│ • Hashtags      │ • Members       │ • Presence               │
│ • Bookmarks     │ • Invites       │ • Attachments            │
└─────────────────┴─────────────────┴──────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18 with Next.js 15 App Router
- **API Layer**: tRPC v10 for type-safe endpoints
- **Database**: PostgreSQL (prod) / SQLite (dev) with Prisma ORM
- **Real-time**: WebSocket server for live updates
- **Images**: Unsplash API + Wikimedia Commons integration
- **Emojis**: Discord bot integration for custom emojis

### Data Flow

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Frontend │─────▶│  tRPC    │─────▶│  Prisma  │─────▶│   DB     │
│  Client  │◀─────│ Router   │◀─────│   ORM    │◀─────│  Layer   │
└──────────┘      └──────────┘      └──────────┘      └──────────┘
     │                                                        │
     │                  ┌──────────────┐                     │
     └─────────────────▶│  WebSocket   │◀────────────────────┘
                        │   Server     │
                        └──────────────┘
```

---

## ThinkPages Feed

### Overview

ThinkPages is the public-facing social media component where users create in-universe accounts to post content representing citizens, government officials, or media organizations.

### Key Features

- **Account Types**: `citizen`, `government`, `media`, `organization`
- **Post Types**: `original`, `repost`, `reply`
- **Reactions**: 7 types (like, laugh, angry, sad, fire, thumbsup, thumbsdown)
- **Hashtags & Trending**: Real-time trending topic calculation
- **Mentions**: @-mention other accounts with notifications
- **Visibility**: `public`, `private`, `unlisted` posts
- **Moderation**: Post flagging, pinning, bookmarking

### Account Creation

ThinkPages uses **ThinkpagesAccount** (separate from User) for feed posts:

```typescript
interface ThinkpagesAccount {
  id: string;
  clerkUserId: string; // Owns up to 25 accounts
  countryId: string;
  accountType: 'government' | 'media' | 'citizen';
  username: string; // Unique, alphanumeric + underscore
  displayName: string;
  firstName: string;
  lastName: string;
  bio?: string;
  verified: boolean;
  postingFrequency: 'active' | 'moderate' | 'low';
  politicalLean: 'left' | 'center' | 'right';
  personality: 'serious' | 'casual' | 'satirical';
  profileImageUrl?: string;
  followerCount: number;
  postCount: number;
  isActive: boolean;
}
```

**Limitations:**
- 25 accounts per Clerk user
- Username must be unique globally
- Only account owner can post/edit

### Post Structure

```typescript
interface ThinkpagesPost {
  id: string;
  accountId: string; // ThinkpagesAccount ID
  content: string; // Max 280 characters
  hashtags?: string[]; // JSON array
  mentions?: string[]; // JSON array of usernames
  visualizations?: Visualization[]; // Embedded charts/data
  postType: 'original' | 'repost' | 'reply';
  parentPostId?: string; // For replies
  repostOfId?: string; // For reposts
  visibility: 'public' | 'private' | 'unlisted';
  pinned: boolean;
  trending: boolean;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  reactionCounts: Record<string, number>;
  ixTimeTimestamp: Date;
}
```

### Feed Endpoints

| Endpoint | Type | Description |
|----------|------|-------------|
| `createAccount` | `mutation` | Create new ThinkPages feed account |
| `updateAccount` | `mutation` | Update account settings |
| `checkUsernameAvailability` | `query` | Check if username is available |
| `getAccountsByCountry` | `query` | Get all accounts for a country |
| `getAccountCountsByType` | `query` | Count accounts by type |
| `createPost` | `mutation` | Create new post (original/reply/repost) |
| `updatePost` | `mutation` | Edit existing post |
| `deletePost` | `mutation` | Delete post |
| `pinPost` | `mutation` | Pin/unpin post to profile |
| `bookmarkPost` | `mutation` | Bookmark post for later |
| `flagPost` | `mutation` | Report inappropriate content |
| `getFeed` | `query` | Get paginated feed with filters |
| `getPost` | `query` | Get single post with replies |
| `addReaction` | `mutation` | Add/change reaction to post |
| `removeReaction` | `mutation` | Remove reaction from post |
| `getPostReactions` | `query` | Get all reactions with account details |
| `getTrendingTopics` | `query` | Get trending hashtags |
| `calculateTrendingTopics` | `mutation` | Recalculate trending topics (cron) |
| `triggerCitizenReaction` | `mutation` | Generate AI citizen response |
| `calculateCountryMoodMetrics` | `mutation` | Calculate sentiment scores (cron) |

### Feed Filtering

```typescript
// getFeed parameters
{
  countryId?: string;      // Filter by country
  hashtag?: string;        // Filter by hashtag
  filter: 'recent' | 'trending' | 'hot';
  limit: number;           // Max 50
  cursor?: string;         // Pagination cursor
}
```

### Trending Algorithm

Topics are calculated based on:
1. **Post Count**: Number of posts with hashtag in 24h
2. **Engagement**: Sum of likes + reposts + replies
3. **Recency**: Weighted toward recent activity

```typescript
// Trending calculation (runs on schedule)
const hashtagScore = (postCount * 2) + engagement + recencyBonus;
```

---

## ThinkTanks Groups

### Overview

ThinkTanks provides private group discussions with collaborative documents, similar to Discord servers or Slack workspaces but with IxStats integration.

### Key Features

- **Group Types**: `public`, `private`, `invite_only`
- **Roles**: `owner`, `admin`, `member`
- **Collaborative Docs**: Up to 10 documents per group with version tracking
- **Rich Messaging**: Text, images, files, system messages
- **Member Management**: Invite system, role updates, removal
- **Categories**: Organize groups by topic/purpose

### Group Structure

```typescript
interface ThinktankGroup {
  id: string;
  name: string; // Max 100 chars
  description?: string; // Max 500 chars
  avatar?: string; // Image URL
  type: 'public' | 'private' | 'invite_only';
  category?: string;
  tags?: string[]; // JSON array
  createdBy: string; // User clerkUserId
  memberCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Membership

```typescript
interface ThinktankMember {
  id: string;
  groupId: string;
  userId: string; // User clerkUserId (NOT ThinkpagesAccount)
  role: 'owner' | 'admin' | 'member';
  isActive: boolean;
  joinedAt: Date;
  lastReadAt?: Date;
}
```

**Important**: ThinkTanks use **User.clerkUserId** directly (not ThinkpagesAccount). This enables global access without requiring country selection.

### Messages

```typescript
interface ThinktankMessage {
  id: string;
  groupId: string;
  userId: string; // User clerkUserId
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  replyToId?: string;
  mentions?: string[]; // JSON array
  attachments?: Attachment[]; // JSON array
  reactions?: Record<string, number>; // JSON
  ixTimeTimestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
}
```

### Collaborative Documents

```typescript
interface CollaborativeDoc {
  id: string;
  groupId: string;
  title: string; // Max 200 chars
  content: string; // Markdown/HTML
  version: number; // Auto-incremented
  createdBy: string; // User clerkUserId
  lastEditBy: string;
  isPublic: boolean; // Public docs viewable by non-members
  createdAt: Date;
  updatedAt: Date;
}
```

**Document Limits:**
- 10 documents per group maximum
- Only members can view private documents
- Public documents accessible to anyone with link
- Version tracking via auto-increment counter

### ThinkTanks Endpoints

| Endpoint | Type | Description |
|----------|------|-------------|
| `createThinktank` | `mutation` | Create new group |
| `getThinktanks` | `query` | Get groups (all/joined/created) |
| `updateThinktank` | `mutation` | Update group settings |
| `deleteThinktank` | `mutation` | Delete group (owner only) |
| `joinThinktank` | `mutation` | Join public/invited group |
| `leaveThinktank` | `mutation` | Leave group (non-owner) |
| `inviteToThinktank` | `mutation` | Invite users to group |
| `updateMemberRole` | `mutation` | Change member role (admin/member) |
| `removeMemberFromThinktank` | `mutation` | Kick member from group |
| `getThinktankMessages` | `query` | Get paginated messages |
| `sendThinktankMessage` | `mutation` | Send message to group |
| `addReactionToMessage` | `mutation` | React to message |
| `removeReactionFromMessage` | `mutation` | Remove reaction |
| `editMessage` | `mutation` | Edit existing message |
| `deleteMessage` | `mutation` | Delete message (soft delete) |
| `getThinktankDocuments` | `query` | Get all documents for group |
| `getThinktankDocument` | `query` | Get single document by ID |
| `createThinktankDocument` | `mutation` | Create new collaborative doc |
| `updateThinktankDocument` | `mutation` | Update document content |
| `deleteThinktankDocument` | `mutation` | Delete document (creator/owner) |

---

## ThinkShare Messaging

### Overview

ThinkShare provides direct 1-on-1 messaging between users, similar to Facebook Messenger or WhatsApp Direct Messages.

### Key Features

- **Direct Conversations**: 1-on-1 or 2-person chats only
- **Real-time**: WebSocket updates for instant delivery
- **Read Receipts**: Track when messages are read
- **Presence**: Online/offline status tracking
- **Rich Content**: Text, images, files, replies
- **Notifications**: Unified notification system integration

### Conversation Structure

```typescript
interface ThinkshareConversation {
  id: string;
  type: 'direct'; // Only direct conversations supported
  name?: string; // Optional conversation name
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
}

interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string; // User clerkUserId
  role: 'participant';
  isActive: boolean;
  lastReadAt?: Date;
  joinedAt: Date;
}
```

**Important**: Like ThinkTanks, ThinkShare uses **User.clerkUserId** directly (not ThinkpagesAccount).

### Message Structure

```typescript
interface ThinkshareMessage {
  id: string;
  conversationId: string;
  userId: string; // User clerkUserId
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  replyToId?: string;
  mentions?: string[]; // JSON array
  attachments?: Attachment[]; // JSON array
  reactions?: Record<string, number>; // JSON
  ixTimeTimestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
}

interface MessageReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  messageType: 'thinkshare' | 'thinktank';
  readAt: Date;
}
```

### Presence System

```typescript
interface UserPresence {
  id: string;
  userId: string; // User clerkUserId
  isOnline: boolean;
  status: 'available' | 'busy' | 'away' | 'invisible';
  customStatus?: string;
  lastSeen: Date;
  updatedAt: Date;
}
```

### ThinkShare Endpoints

| Endpoint | Type | Description |
|----------|------|-------------|
| `createConversation` | `mutation` | Create/find direct conversation |
| `createConversationByCountries` | `mutation` | Create diplomatic channel |
| `getConversations` | `query` | Get all user conversations |
| `getConversationMessages` | `query` | Get paginated messages |
| `sendMessage` | `mutation` | Send message to conversation |
| `markMessagesAsRead` | `mutation` | Update read receipts |
| `updatePresence` | `mutation` | Update online status |
| `getPresenceForUsers` | `query` | Get presence for multiple users |
| `addReactionToMessage` | `mutation` | React to message |
| `removeReactionFromMessage` | `mutation` | Remove reaction |
| `editMessage` | `mutation` | Edit existing message |
| `deleteMessage` | `mutation` | Delete message (soft delete) |

### WebSocket Events

```typescript
// Real-time message events
{
  type: 'message:new',
  conversationId: string,
  messageId: string,
  accountId: string,
  content: string,
  timestamp: number
}

// Typing indicators (planned)
{
  type: 'typing:start' | 'typing:stop',
  conversationId: string,
  userId: string
}
```

---

## Database Models

### Complete Schema Overview

```prisma
// ThinkPages Feed Models
model ThinkpagesAccount {
  id                String             @id @default(cuid())
  clerkUserId       String             // Owns up to 25 accounts
  countryId         String
  accountType       String             // government, media, citizen
  username          String             @unique
  displayName       String
  firstName         String
  lastName          String
  bio               String?
  verified          Boolean            @default(false)
  postingFrequency  String             @default("moderate")
  politicalLean     String             @default("center")
  personality       String             @default("casual")
  profileImageUrl   String?
  followerCount     Int                @default(0)
  postCount         Int                @default(0)
  isActive          Boolean            @default(true)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  country           Country            @relation(fields: [countryId], references: [id])
  posts             ThinkpagesPost[]
  reactions         PostReaction[]
  bookmarks         PostBookmark[]
  flags             PostFlag[]

  @@index([clerkUserId])
  @@index([countryId])
}

model ThinkpagesPost {
  id                String             @id @default(cuid())
  accountId         String
  content           String
  hashtags          String?            // JSON array
  visualizations    String?            // JSON array
  postType          String             @default("original")
  parentPostId      String?
  repostOfId        String?
  visibility        String             @default("public")
  pinned            Boolean            @default(false)
  trending          Boolean            @default(false)
  likeCount         Int                @default(0)
  replyCount        Int                @default(0)
  repostCount       Int                @default(0)
  reactionCounts    String?            // JSON object
  ixTimeTimestamp   DateTime           @default(now())
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  account           ThinkpagesAccount  @relation(fields: [accountId], references: [id])
  parentPost        ThinkpagesPost?    @relation("PostReplies", fields: [parentPostId], references: [id])
  replies           ThinkpagesPost[]   @relation("PostReplies")
  repostOf          ThinkpagesPost?    @relation("PostReposts", fields: [repostOfId], references: [id])
  reposts           ThinkpagesPost[]   @relation("PostReposts")
  reactions         PostReaction[]
  mentions          PostMention[]
  bookmarks         PostBookmark[]
  flags             PostFlag[]

  @@index([accountId])
  @@index([parentPostId])
  @@index([repostOfId])
  @@index([ixTimeTimestamp])
}

model PostReaction {
  id                String             @id @default(cuid())
  postId            String
  accountId         String
  reactionType      String             // like, laugh, angry, sad, fire, thumbsup, thumbsdown
  timestamp         DateTime           @default(now())

  post              ThinkpagesPost     @relation(fields: [postId], references: [id])
  account           ThinkpagesAccount  @relation(fields: [accountId], references: [id])

  @@unique([postId, accountId])
  @@index([postId])
}

model PostMention {
  id                    String             @id @default(cuid())
  postId                String
  mentionedAccountId    String
  position              Int                // Position in content
  timestamp             DateTime           @default(now())

  post                  ThinkpagesPost     @relation(fields: [postId], references: [id])

  @@index([postId])
  @@index([mentionedAccountId])
}

model TrendingTopic {
  id                String             @id @default(cuid())
  hashtag           String             @unique
  postCount         Int                @default(0)
  engagement        Int                @default(0)
  peakTimestamp     DateTime
  isActive          Boolean            @default(true)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
}

model PostBookmark {
  id                String             @id @default(cuid())
  userId            String             // User clerkUserId
  postId            String
  createdAt         DateTime           @default(now())

  post              ThinkpagesPost     @relation(fields: [postId], references: [id])

  @@unique([userId, postId])
}

model PostFlag {
  id                String             @id @default(cuid())
  userId            String             // User clerkUserId
  postId            String
  reason            String?
  createdAt         DateTime           @default(now())

  post              ThinkpagesPost     @relation(fields: [postId], references: [id])

  @@unique([userId, postId])
}

// ThinkTanks Group Models
model ThinktankGroup {
  id                String             @id @default(cuid())
  name              String
  description       String?
  avatar            String?
  type              String             @default("public")
  category          String?
  tags              String?            // JSON array
  createdBy         String             // User clerkUserId
  memberCount       Int                @default(0)
  isActive          Boolean            @default(true)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  members           ThinktankMember[]
  messages          ThinktankMessage[]
  documents         CollaborativeDoc[]
  invites           ThinktankInvite[]

  @@index([createdBy])
  @@index([type])
}

model ThinktankMember {
  id                String             @id @default(cuid())
  groupId           String
  userId            String             // User clerkUserId
  role              String             @default("member")
  isActive          Boolean            @default(true)
  joinedAt          DateTime           @default(now())
  lastReadAt        DateTime?

  group             ThinktankGroup     @relation(fields: [groupId], references: [id])

  @@unique([groupId, userId])
  @@index([userId])
}

model ThinktankMessage {
  id                String             @id @default(cuid())
  groupId           String
  userId            String             // User clerkUserId
  content           String
  messageType       String             @default("text")
  replyToId         String?
  mentions          String?            // JSON array
  attachments       String?            // JSON array
  reactions         String?            // JSON object
  ixTimeTimestamp   DateTime           @default(now())
  editedAt          DateTime?
  deletedAt         DateTime?

  group             ThinktankGroup     @relation(fields: [groupId], references: [id])
  replyTo           ThinktankMessage?  @relation("MessageReplies", fields: [replyToId], references: [id])
  replies           ThinktankMessage[] @relation("MessageReplies")
  readReceipts      MessageReadReceipt[]

  @@index([groupId])
  @@index([userId])
  @@index([ixTimeTimestamp])
}

model CollaborativeDoc {
  id                String             @id @default(cuid())
  groupId           String
  title             String
  content           String
  version           Int                @default(1)
  createdBy         String             // User clerkUserId
  lastEditBy        String
  isPublic          Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  group             ThinktankGroup     @relation(fields: [groupId], references: [id])

  @@index([groupId])
}

model ThinktankInvite {
  id                String             @id @default(cuid())
  groupId           String
  invitedUser       String             // User clerkUserId
  invitedBy         String             // User clerkUserId
  status            String             @default("pending")
  createdAt         DateTime           @default(now())
  expiresAt         DateTime?

  group             ThinktankGroup     @relation(fields: [groupId], references: [id])

  @@index([invitedUser])
}

// ThinkShare Messaging Models
model ThinkshareConversation {
  id                String                    @id @default(cuid())
  type              String                    @default("direct")
  name              String?
  isActive          Boolean                   @default(true)
  lastActivity      DateTime                  @default(now())
  createdAt         DateTime                  @default(now())

  participants      ConversationParticipant[]
  messages          ThinkshareMessage[]
}

model ConversationParticipant {
  id                String                    @id @default(cuid())
  conversationId    String
  userId            String                    // User clerkUserId
  role              String                    @default("participant")
  isActive          Boolean                   @default(true)
  lastReadAt        DateTime?
  joinedAt          DateTime                  @default(now())

  conversation      ThinkshareConversation    @relation(fields: [conversationId], references: [id])

  @@unique([conversationId, userId])
  @@index([userId])
}

model ThinkshareMessage {
  id                String                    @id @default(cuid())
  conversationId    String
  userId            String                    // User clerkUserId
  content           String
  messageType       String                    @default("text")
  replyToId         String?
  mentions          String?                   // JSON array
  attachments       String?                   // JSON array
  reactions         String?                   // JSON object
  ixTimeTimestamp   DateTime                  @default(now())
  editedAt          DateTime?
  deletedAt         DateTime?

  conversation      ThinkshareConversation    @relation(fields: [conversationId], references: [id])
  replyTo           ThinkshareMessage?        @relation("MessageReplies", fields: [replyToId], references: [id])
  replies           ThinkshareMessage[]       @relation("MessageReplies")
  readReceipts      MessageReadReceipt[]

  @@index([conversationId])
  @@index([userId])
  @@index([ixTimeTimestamp])
}

model MessageReadReceipt {
  id                String                    @id @default(cuid())
  messageId         String
  userId            String                    // User clerkUserId
  messageType       String                    // "thinkshare" | "thinktank"
  readAt            DateTime                  @default(now())

  thinkshareMessage ThinkshareMessage?        @relation(fields: [messageId], references: [id])
  thinktankMessage  ThinktankMessage?         @relation(fields: [messageId], references: [id])

  @@unique([messageId, userId, messageType])
  @@index([userId])
}

model UserPresence {
  id                String             @id @default(cuid())
  userId            String             @unique // User clerkUserId
  isOnline          Boolean            @default(false)
  status            String             @default("available")
  customStatus      String?
  lastSeen          DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
}
```

---

## API Endpoints

### Complete Endpoint Reference

#### ThinkPages Feed (22 endpoints)

```typescript
// Account Management
thinkpages.createAccount                    // Create ThinkPages account
thinkpages.updateAccount                    // Update account settings
thinkpages.checkUsernameAvailability        // Check username availability
thinkpages.getAccountsByCountry             // Get accounts by country
thinkpages.getAccountCountsByType           // Count accounts by type
thinkpages.searchUsers                      // Search users globally

// Post Operations
thinkpages.createPost                       // Create new post
thinkpages.updatePost                       // Edit existing post
thinkpages.deletePost                       // Delete post
thinkpages.pinPost                          // Pin/unpin post
thinkpages.getFeed                          // Get paginated feed
thinkpages.getPost                          // Get single post + replies

// Reactions & Engagement
thinkpages.addReaction                      // Add/change reaction
thinkpages.removeReaction                   // Remove reaction
thinkpages.getPostReactions                 // Get reaction details

// Discovery & Moderation
thinkpages.getTrendingTopics                // Get trending hashtags
thinkpages.bookmarkPost                     // Bookmark post
thinkpages.flagPost                         // Report inappropriate content

// Background Jobs
thinkpages.calculateTrendingTopics          // Recalculate trending (cron)
thinkpages.triggerCitizenReaction           // Generate AI response
thinkpages.calculateCountryMoodMetrics      // Sentiment analysis (cron)

// Utility
thinkpages.generateProfilePicture           // Generate placeholder avatar
```

#### ThinkTanks Groups (16 endpoints)

```typescript
// Group Management
thinkpages.createThinktank                  // Create new group
thinkpages.getThinktanks                    // Get groups (filtered)
thinkpages.updateThinktank                  // Update group settings
thinkpages.deleteThinktank                  // Delete group

// Membership
thinkpages.joinThinktank                    // Join group
thinkpages.leaveThinktank                   // Leave group
thinkpages.inviteToThinktank                // Invite users
thinkpages.updateMemberRole                 // Change member role
thinkpages.removeMemberFromThinktank        // Kick member

// Messaging
thinkpages.getThinktankMessages             // Get paginated messages
thinkpages.sendThinktankMessage             // Send message

// Collaborative Documents
thinkpages.getThinktankDocuments            // Get all documents
thinkpages.getThinktankDocument             // Get single document
thinkpages.createThinktankDocument          // Create new document
thinkpages.updateThinktankDocument          // Update document
thinkpages.deleteThinktankDocument          // Delete document
```

#### ThinkShare Messaging (12 endpoints)

```typescript
// Conversation Management
thinkpages.createConversation               // Create/find direct conversation
thinkpages.createConversationByCountries    // Create diplomatic channel
thinkpages.getConversations                 // Get all conversations

// Messaging
thinkpages.getConversationMessages          // Get paginated messages
thinkpages.sendMessage                      // Send message
thinkpages.markMessagesAsRead               // Update read receipts

// Reactions & Edits
thinkpages.addReactionToMessage             // React to message
thinkpages.removeReactionFromMessage        // Remove reaction
thinkpages.editMessage                      // Edit message
thinkpages.deleteMessage                    // Delete message

// Presence
thinkpages.updatePresence                   // Update online status
thinkpages.getPresenceForUsers              // Get presence for multiple users
```

#### Utility Endpoints (4 endpoints)

```typescript
// Media Search
thinkpages.searchUnsplashImages             // Search Unsplash for images
thinkpages.searchWikiCommonsImages          // Search Wikimedia Commons
thinkpages.searchWiki                       // Search IxWiki/IIWiki for content

// Discord Integration
thinkpages.getDiscordEmojis                 // Fetch Discord server emojis
```

---

## Component Hierarchy

### ThinkPages Feed Components

```
ThinkpagesSocialPlatform (pages/thinkpages/feed/page.tsx)
├── EnhancedAccountManager
│   ├── AccountCreationModal
│   ├── AccountSettingsModal
│   └── AccountIndicator
├── PostComposer
│   ├── RichTextEditor
│   ├── WikiImageSearch
│   ├── DiscordEmojiPicker
│   └── GlassCanvasComposer
├── LiveEventsFeed
│   ├── ThinkpagesPost
│   │   ├── PostActions
│   │   ├── ReactionsDialog
│   │   └── ReactionPopup
│   └── InfiniteScroll
└── TrendingTopics
```

### ThinkTanks Components

```
ThinktankGroups (pages/thinkpages/thinktanks/page.tsx)
├── GroupList
│   ├── GroupCard
│   └── CreateGroupModal
├── GroupView
│   ├── GroupHeader
│   ├── MemberList
│   ├── MessageList
│   │   └── ThinktankMessage
│   └── MessageComposer
└── DocumentsList
    ├── CollaborativeDocument
    │   ├── RichTextEditor
    │   ├── VersionHistory
    │   └── WikiTextImporter
    └── DocumentModal
```

### ThinkShare Components

```
ThinkShare (pages/thinkpages/thinkshare/page.tsx)
├── ConversationList
│   ├── ConversationCard
│   └── UserSearch
├── MessageView
│   ├── ConversationHeader
│   ├── MessageList
│   │   ├── ThinkshareMessage
│   │   ├── ReadReceipt
│   │   └── TypingIndicator
│   └── MessageComposer
└── PresenceIndicator
```

### Shared Primitives

```
/components/thinkpages/primitives/
├── AccountIndicator          // Account avatar + name
├── DiscordEmojiPicker        // Discord emoji selector
├── WikiTextImporter          // Import wiki content
├── CollaborativeDocument     // Real-time document editor
├── PostActions               // Post action buttons (like, reply, repost)
└── ReactionPopup             // Reaction selector popup
```

---

## WebSocket Integration

### Server Setup

```typescript
// src/server/websocket-server.ts
import { Server } from 'socket.io';

let thinkpagesServer: ThinkPagesWebSocket | null = null;

export function getThinkPagesServer() {
  return thinkpagesServer;
}

export function initializeThinkPagesServer(httpServer: any) {
  thinkpagesServer = new ThinkPagesWebSocket(httpServer);
  return thinkpagesServer;
}

class ThinkPagesWebSocket {
  private io: Server;

  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    this.io.on('connection', (socket) => {
      console.log('[ThinkPages WS] Client connected:', socket.id);

      socket.on('join:conversation', (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
      });

      socket.on('disconnect', () => {
        console.log('[ThinkPages WS] Client disconnected:', socket.id);
      });
    });
  }

  broadcastMessage(data: any) {
    this.io.to(`conversation:${data.conversationId}`).emit('message:new', data);
  }
}
```

### Client Integration

```typescript
// hooks/useThinkShareWebSocket.ts
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export function useThinkShareWebSocket(conversationId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000');
    setSocket(newSocket);

    newSocket.emit('join:conversation', conversationId);

    newSocket.on('message:new', (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      newSocket.close();
    };
  }, [conversationId]);

  return { socket, messages };
}
```

### Event Types

```typescript
// WebSocket event types
type WSEvent =
  | { type: 'message:new'; conversationId: string; messageId: string; content: string; }
  | { type: 'typing:start'; conversationId: string; userId: string; }
  | { type: 'typing:stop'; conversationId: string; userId: string; }
  | { type: 'presence:update'; userId: string; isOnline: boolean; }
  | { type: 'reaction:add'; messageId: string; userId: string; reaction: string; }
  | { type: 'message:edit'; messageId: string; content: string; }
  | { type: 'message:delete'; messageId: string; };
```

---

## Account System

### Dual Account Architecture

IxStats uses two distinct account systems:

#### 1. ThinkpagesAccount (Feed Only)

**Purpose**: In-universe roleplay accounts for ThinkPages feed posts
**Owner**: Clerk User (up to 25 accounts per user)
**Use Cases**: Feed posts, reactions, mentions, trending topics
**Key Fields**: username, displayName, accountType, personality

```typescript
// Creating a feed account
const account = await trpc.thinkpages.createAccount.mutate({
  countryId: 'country_123',
  accountType: 'citizen',
  username: 'john_doe',
  firstName: 'John',
  lastName: 'Doe',
  bio: 'Average citizen from Exampleland',
  verified: false,
  politicalLean: 'center',
  personality: 'casual'
});
```

#### 2. User (ThinkTanks + ThinkShare)

**Purpose**: Real user identity for groups and messaging
**Identifier**: User.clerkUserId
**Use Cases**: ThinkTanks membership, ThinkShare conversations, presence
**Display**: Shows country name/flag

```typescript
// Using User identity for messaging
const conversation = await trpc.thinkpages.createConversation.mutate({
  participantIds: [user.clerkUserId, otherUser.clerkUserId]
});
```

### Why Two Systems?

1. **Feed Flexibility**: Users can create multiple personas (up to 25) for diverse storytelling
2. **Identity Clarity**: ThinkTanks/ThinkShare use real user identity for accountability
3. **Country Representation**: User identity tied to owned country (flag, name)
4. **Security**: Direct messaging requires verified user identity
5. **Moderation**: Real user identity enables effective moderation in groups

### Account Conversion Table

| Feature | ThinkpagesAccount | User.clerkUserId |
|---------|-------------------|------------------|
| Feed Posts | ✅ Yes | ❌ No |
| Post Reactions | ✅ Yes | ❌ No |
| ThinkTanks | ❌ No | ✅ Yes |
| ThinkShare | ❌ No | ✅ Yes |
| Bookmarks | ❌ No | ✅ Yes |
| Post Flags | ❌ No | ✅ Yes |
| Presence | ❌ No | ✅ Yes |
| Multiple per user | ✅ Yes (25 max) | ❌ No (1 per user) |

---

## Development Guide

### Setting Up ThinkPages

1. **Database Setup**

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations
npm run db:setup
```

2. **Environment Variables**

```env
# .env.local
NEXT_PUBLIC_WS_URL=ws://localhost:3000
IXTIME_BOT_URL=http://localhost:3001
UNSPLASH_ACCESS_KEY=your_key_here
```

3. **Create First Account**

```typescript
// In your app
const { mutate: createAccount } = api.thinkpages.createAccount.useMutation();

createAccount({
  countryId: myCountry.id,
  accountType: 'citizen',
  username: 'test_citizen',
  firstName: 'Test',
  lastName: 'Citizen',
  bio: 'Just testing the platform'
});
```

### Testing ThinkTanks

1. **Create a Group**

```typescript
const { mutate: createGroup } = api.thinkpages.createThinktank.useMutation();

createGroup({
  name: 'Economic Policy Discussion',
  description: 'Discussing trade and fiscal policy',
  type: 'public',
  category: 'economics',
  createdBy: user.clerkUserId
});
```

2. **Join and Send Message**

```typescript
// Join group
await trpc.thinkpages.joinThinktank.mutate({
  groupId: 'group_123',
  userId: user.clerkUserId
});

// Send message
await trpc.thinkpages.sendThinktankMessage.mutate({
  groupId: 'group_123',
  userId: user.clerkUserId,
  content: 'Hello everyone!',
  messageType: 'text'
});
```

### Testing ThinkShare

1. **Create Conversation**

```typescript
const { mutate: createConv } = api.thinkpages.createConversation.useMutation();

createConv({
  participantIds: [user.clerkUserId, 'other_user_clerk_id']
});
```

2. **Send Message**

```typescript
const { mutate: sendMsg } = api.thinkpages.sendMessage.useMutation();

sendMsg({
  conversationId: 'conv_123',
  userId: user.clerkUserId,
  content: 'Hey, how are you?',
  messageType: 'text'
});
```

### Common Patterns

#### Pagination

```typescript
// Feed pagination
const { data, fetchNextPage, hasNextPage } = api.thinkpages.getFeed.useInfiniteQuery(
  { limit: 20, filter: 'recent' },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

#### Real-time Updates

```typescript
// Subscribe to conversation
const { socket, messages } = useThinkShareWebSocket(conversationId);

useEffect(() => {
  if (messages.length > 0) {
    // Refetch conversation messages
    refetch();
  }
}, [messages]);
```

#### Error Handling

```typescript
const { mutate, error, isError } = api.thinkpages.createPost.useMutation({
  onError: (error) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      toast.error('Please log in to post');
    } else if (error.data?.code === 'BAD_REQUEST') {
      toast.error(error.message);
    }
  }
});
```

### Performance Optimization

1. **Batch Queries**: Fetch multiple resources in parallel

```typescript
const [accounts, feed, trending] = await Promise.all([
  trpc.thinkpages.getAccountsByCountry.query({ countryId }),
  trpc.thinkpages.getFeed.query({ limit: 20 }),
  trpc.thinkpages.getTrendingTopics.query({ limit: 10 })
]);
```

2. **Optimistic Updates**: Update UI before server response

```typescript
const utils = api.useContext();

const { mutate } = api.thinkpages.addReaction.useMutation({
  onMutate: async (newReaction) => {
    await utils.thinkpages.getPost.cancel();
    const previousPost = utils.thinkpages.getPost.getData();

    utils.thinkpages.getPost.setData({ postId: newReaction.postId }, (old) => ({
      ...old,
      reactionCounts: {
        ...old.reactionCounts,
        [newReaction.reactionType]: (old.reactionCounts[newReaction.reactionType] || 0) + 1
      }
    }));

    return { previousPost };
  },
  onError: (err, newReaction, context) => {
    utils.thinkpages.getPost.setData({ postId: newReaction.postId }, context.previousPost);
  }
});
```

3. **Infinite Scroll**: Efficient feed loading

```typescript
const { data, fetchNextPage } = api.thinkpages.getFeed.useInfiniteQuery(
  { limit: 20 },
  { getNextPageParam: (lastPage) => lastPage.nextCursor }
);

const handleScroll = useCallback(() => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
    fetchNextPage();
  }
}, [fetchNextPage]);
```

### Security Best Practices

1. **Verify Account Ownership**

```typescript
// Server-side check
const account = await db.thinkpagesAccount.findUnique({
  where: { id: input.accountId }
});

if (account.clerkUserId !== ctx.auth.userId) {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

2. **Verify Group Membership**

```typescript
const member = await db.thinktankMember.findUnique({
  where: {
    groupId_userId: {
      groupId: input.groupId,
      userId: ctx.auth.userId
    }
  }
});

if (!member || !member.isActive) {
  throw new TRPCError({ code: 'FORBIDDEN' });
}
```

3. **Validate Input**

```typescript
import { z } from 'zod';

const CreatePostSchema = z.object({
  accountId: z.string(),
  content: z.string().min(1).max(280),
  hashtags: z.array(z.string()).max(5).optional(),
  visibility: z.enum(['public', 'private', 'unlisted'])
});
```

---

## Roadmap & Future Enhancements

### v1.2 (Next Release)

- [ ] Typing indicators for ThinkShare
- [ ] Voice/video call support
- [ ] Advanced search (posts, users, groups)
- [ ] Post scheduling
- [ ] Group roles (moderator, contributor)

### v1.3 (Planned)

- [ ] Live streaming support
- [ ] Poll creation in posts
- [ ] Group forums (threaded discussions)
- [ ] Analytics dashboard
- [ ] Report moderation queue

### v2.0 (Future Vision)

- [ ] Federation protocol (ActivityPub)
- [ ] Mobile apps (React Native)
- [ ] AI content moderation
- [ ] Blockchain verification
- [ ] Decentralized storage

---

## Troubleshooting

### Common Issues

**Problem**: "Username already taken"
**Solution**: Use `checkUsernameAvailability` before creating account

**Problem**: ThinkTanks not loading
**Solution**: Ensure `userId` is valid User.clerkUserId, not ThinkpagesAccount.id

**Problem**: WebSocket not connecting
**Solution**: Check `NEXT_PUBLIC_WS_URL` environment variable

**Problem**: Messages not sending
**Solution**: Verify user is conversation participant

**Problem**: Account limit reached
**Solution**: Users limited to 25 ThinkpagesAccounts per Clerk user

### Debug Mode

```typescript
// Enable debug logging
localStorage.setItem('debug_thinkpages', 'true');

// Check WebSocket connection
console.log('[ThinkPages] Socket connected:', socket?.connected);

// Verify account ownership
console.log('[ThinkPages] My accounts:', accounts.filter(a => a.clerkUserId === user.id));
```

---

## Conclusion

The IxStats Social Platform provides a comprehensive in-universe social networking experience with 54 endpoints, 14 database models, and real-time capabilities. The dual account system enables both creative roleplay (ThinkPages) and practical communication (ThinkTanks/ThinkShare).

For additional support, consult:
- **API Documentation**: `/docs/API_REFERENCE.md`
- **Database Schema**: `/prisma/schema.prisma`
- **tRPC Router**: `/src/server/api/routers/thinkpages.ts`
- **Component Examples**: `/src/components/thinkpages/`

**Version**: 1.1.0
**Last Updated**: October 2025
**Status**: Production-Ready (85% Feature Complete)
