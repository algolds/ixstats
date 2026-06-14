import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
// Import the wiki search service
import { validateNoXSS } from "~/lib/sanitize-html";
import { globalCache } from "~/lib/advanced-cache-system";

// eslint-disable-next-line unused-imports/no-unused-vars
const invalidateFeeds = async () => {
  try {
    await Promise.all([
      globalCache.deleteByPattern("thinkpages_feed:*"),
      globalCache.deleteByPattern("global_activity_feed:*"),
      globalCache.deleteByPattern("user_following_feed:*"),
    ]);
  } catch (error) {
    console.error("Failed to invalidate feeds:", error);
  }
};

// eslint-disable-next-line unused-imports/no-unused-vars
const hydratePostDates = (post: any) => {
  if (!post) return post;
  return {
    ...post,
    createdAt: post.createdAt ? new Date(post.createdAt) : undefined,
    ixTimeTimestamp: post.ixTimeTimestamp ? new Date(post.ixTimeTimestamp) : undefined,
    parentPost: post.parentPost
      ? {
          ...post.parentPost,
          createdAt: post.parentPost.createdAt ? new Date(post.parentPost.createdAt) : undefined,
          ixTimeTimestamp: post.parentPost.ixTimeTimestamp
            ? new Date(post.parentPost.ixTimeTimestamp)
            : undefined,
        }
      : undefined,
    repostOf: post.repostOf
      ? {
          ...post.repostOf,
          createdAt: post.repostOf.createdAt ? new Date(post.repostOf.createdAt) : undefined,
          ixTimeTimestamp: post.repostOf.ixTimeTimestamp
            ? new Date(post.repostOf.ixTimeTimestamp)
            : undefined,
        }
      : undefined,
    reactions: post.reactions
      ? post.reactions.map((r: any) => ({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        }))
      : undefined,
  };
};

// eslint-disable-next-line unused-imports/no-unused-vars
const SearchUnsplashImagesSchema = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(30).default(10),
  orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
  color: z.string().optional(), // Unsplash API supports specific color names or hex codes
});

// Base schema for ThinkPages accounts
const thinkpagesAccountBaseSchema = z.object({
  countryId: z.string(),
  accountType: z.enum(["government", "media", "citizen"]),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().max(50).optional().default(""),
  bio: z.string().max(500).optional().default(""),
  verified: z.boolean().default(false),
  postingFrequency: z.enum(["active", "moderate", "low"]).default("moderate"),
  politicalLean: z.enum(["left", "center", "right"]).default("center"),
  personality: z.enum(["serious", "casual", "satirical"]).default("casual"),
  profileImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

// eslint-disable-next-line unused-imports/no-unused-vars
function formatPollForClient(poll: any) {
  if (!poll) return null;
  const votes: Record<string, number> = {};
  let totalVotes = 0;
  poll.options.forEach((opt: any) => {
    const count = opt._count?.votes ?? 0;
    votes[opt.id] = count;
    totalVotes += count;
  });

  return {
    id: poll.id,
    question: poll.question,
    description: poll.description,
    pollType: poll.pollType,
    multiple: poll.multiple,
    isActive: poll.isActive,
    endDate: poll.endDate,
    countryId: poll.countryId,
    options: poll.options.map((opt: any) => ({
      id: opt.id,
      label: opt.label,
      description: opt.description,
    })),
    votes,
    totalVotes,
    hasVoted: false,
    userVotedOptionIds: [],
  };
}

// eslint-disable-next-line unused-imports/no-unused-vars
const pollInclude = {
  poll: {
    include: {
      options: {
        include: {
          _count: {
            select: { votes: true },
          },
        },
      },
    },
  },
};

// Create schema - all required fields with defaults
// eslint-disable-next-line unused-imports/no-unused-vars
const CreateAccountSchema = thinkpagesAccountBaseSchema;

// Update schema - all fields optional
// eslint-disable-next-line unused-imports/no-unused-vars
const UpdateAccountSchema = thinkpagesAccountBaseSchema.partial();

// eslint-disable-next-line unused-imports/no-unused-vars
const CreatePostSchema = z.object({
  accountId: z.string(), // ThinkpagesAccount ID for feed posts
  content: z
    .string()
    .max(10000)
    .optional()
    .default("")
    .refine(
      (content) => {
        if (!content) return true;
        const validation = validateNoXSS(content);
        return validation.valid;
      },
      {
        message:
          "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers.",
      }
    ),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  visibility: z.enum(["public", "private", "unlisted"]).default("public"),
  parentPostId: z.string().optional(), // For replies
  repostOfId: z.string().optional(), // For reposts
  visualizations: z
    .array(
      z.object({
        type: z.enum([
          "economic_chart",
          "diplomatic_map",
          "trade_flow",
          "gdp_growth",
          "demographics",
          "budget_debt",
          "labor_market",
          "national_vitality",
        ]),
        title: z.string(),
        config: z
          .object({
            chartType: z.string().optional(),
            dataSource: z.string().optional(),
            timeRange: z
              .union([
                z.string(),
                z.object({
                  start: z.string().optional(),
                  end: z.string().optional(),
                }),
              ])
              .optional(),
            metrics: z.array(z.string()).optional(),
            countries: z.array(z.string()).optional(),
            colors: z.array(z.string()).optional(),
            displayOptions: z
              .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
          })
          .passthrough(), // Allow additional custom properties
      })
    )
    .optional(), // Data visualizations embedded in post
  mediaUrls: z.array(z.string()).max(4).optional(), // Up to 4 images per post
  postToDiscord: z.boolean().optional().default(true),
  poll: z
    .object({
      question: z.string().min(1).max(500),
      description: z.string().max(2000).optional(),
      pollType: z.enum(["choice", "feature-poll"]).default("choice"),
      multiple: z.boolean().default(false),
      options: z.array(z.string().min(1).max(200)).min(2, "At least 2 options are required"),
    })
    .optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.union([
    z.enum(["like", "laugh", "angry", "sad", "fire", "thumbsup", "thumbsdown"]),
    z.string().startsWith("discord:"), // Support Discord emoji reactions like "discord:ixnay"
  ]),
});

// eslint-disable-next-line unused-imports/no-unused-vars
const GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(["recent", "trending", "hot"]).default("recent"),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

// eslint-disable-next-line unused-imports/no-unused-vars
async function getWikiCommonsImageInfo(
  title: string
): Promise<{ url: string; description: string; photographer: string } | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    format: "json",
    formatversion: "2",
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: {
      "User-Agent": "IxStats-Builder",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch image info for ${title}: ${response.statusText}`);
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;
  const page = (data.query as any)?.pages?.[0];

  if (!page || page.missing || !page.imageinfo?.[0]) {
    return null;
  }

  const imageInfo = page.imageinfo[0];
  const extMetadata = imageInfo.extmetadata;

  return {
    url: imageInfo.url,
    description: extMetadata?.ImageDescription?.value || page.title,
    photographer: extMetadata?.Artist?.value || "Unknown",
  };
}

export const thinkpagesPostsReactionsQueriesRouter = createTRPCRouter({
  // Search Unsplash images

  // Fetch Discord Channel Topic (Easter Egg)

  // Search Wiki Commons images

  // Calculate trending topics

  // Search users globally for ThinkTanks/ThinkShare

  // Update ThinkPages Feed Account
  // Username availability check for ThinkPages Feed Accounts

  // Generate random profile picture

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)

  // Get ThinkPages Feed Accounts by Country - For Feed only

  // Get current user's ThinkPages accounts

  // Get Account Counts by Type - For Feed only

  // Post creation

  // Update post content (edit post)

  // Delete post (soft delete)

  // Add reaction to post

  // Remove reaction

  // Get feed

  // Get trending topics

  // Get account details

  // Get Thinkpages account by Clerk User ID

  // Get post details with replies

  // Get posts by Clerk User ID - shows all posts from all accounts owned by this user

  // Trigger citizen reaction to a post

  // Calculate and store country mood metrics

  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Create a new ThinkTank group

  // Get ThinkTanks globally (no country restriction)

  // Join a ThinkTank group

  // Leave a ThinkTank group

  // Get ThinkTank messages

  // Send message to ThinkTank

  // Update a ThinkTank group

  // Invite users to a ThinkTank group

  // Get collaborative documents for a ThinkTank

  // Create a collaborative document

  // Update a collaborative document

  // Delete a collaborative document

  // Get a single document

  // Add reaction to a Thinkshare message

  // Remove reaction from a Thinkshare message

  // Edit a Thinkshare message

  // Delete a Thinkshare message

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Create a new conversation

  // Get conversations for a user

  // Get messages for a conversation

  // Send message to conversation

  // Mark messages as read

  // Update user presence/online status

  // Get presence for multiple users

  // Get Discord server emojis

  // Pin/unpin a post

  // Bookmark/unbookmark a post
  // Get user's bookmarked posts

  // Check if a post is bookmarked by user

  // Bookmark or unbookmark a post

  // Get all flagged posts (admin only)

  // Check if a post is flagged by user

  // Flag a post for moderation

  // Remove a flag (unflag post)

  // Create a conversation between two countries' official accounts

  // Get post reactions with account details
  getPostReactions: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        reactionType: z.string().optional(), // Filter by specific reaction type
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const whereClause: any = {
        postId: input.postId,
      };

      if (input.reactionType) {
        whereClause.reactionType = input.reactionType;
      }

      const localReactions = await db.postReaction.findMany({
        where: whereClause,
        include: {
          account: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
              accountType: true,
              verified: true,
            },
          },
        },
        orderBy: {
          timestamp: "desc",
        },
      });

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          content: true,
          isAutoGenerated: true,
          reactionCounts: true,
          createdAt: true,
        },
      });

      const discordReactions: any[] = [];
      if (post) {
        const match = post.content.match(/\[DiscordMsg:(\d+)\]/);
        const discordMsgId = match ? match[1] : null;

        let counts: Record<string, number> = {};
        try {
          if (post.reactionCounts) {
            counts = JSON.parse(post.reactionCounts);
          }
        } catch (e) {
          console.warn("Failed to parse reactionCounts in getPostReactions:", e);
        }

        if (discordMsgId) {
          const discordBotToken = process.env.DISCORD_BOT_TOKEN;
          const channelId = process.env.DISCORD_IXTWITTER_CHANNEL_ID || "557223534418722818";

          if (discordBotToken) {
            try {
              const activeTypes = input.reactionType ? [input.reactionType] : Object.keys(counts);

              // Fetch reactors for all active emoji types in parallel
              const fetchPromises = activeTypes.map(async (type) => {
                const count = counts[type] || 0;
                if (count <= 0) return [];

                // Map reaction type to Discord emoji format
                let emojiStr = type;
                if (type.startsWith("discord:")) {
                  const parts = type.split(":");
                  const name = parts[1] || "";
                  const id = parts[2] || "";
                  emojiStr = id ? `${name}:${id}` : name;
                } else {
                  switch (type) {
                    case "like":
                      emojiStr = "❤️";
                      break;
                    case "laugh":
                      emojiStr = "😂";
                      break;
                    case "angry":
                      emojiStr = "😡";
                      break;
                    case "sad":
                      emojiStr = "😢";
                      break;
                    case "fire":
                      emojiStr = "🔥";
                      break;
                    case "thumbsup":
                      emojiStr = "👍";
                      break;
                    case "thumbsdown":
                      emojiStr = "👎";
                      break;
                  }
                }

                const encodedEmoji = encodeURIComponent(emojiStr);
                const res = await fetch(
                  `https://discord.com/api/v10/channels/${channelId}/messages/${discordMsgId}/reactions/${encodedEmoji}?limit=100`,
                  {
                    method: "GET",
                    headers: {
                      Authorization: `Bot ${discordBotToken}`,
                      "User-Agent": "IxStats/1.0",
                    },
                    signal: AbortSignal.timeout(5000),
                  }
                );

                if (res.ok) {
                  const users = (await res.json()) as any[];
                  return users.map((u) => ({ ...u, type }));
                }
                return [];
              });

              const fetchedResults = await Promise.all(fetchPromises);
              const allFetchedReactors = fetchedResults.flat();

              // Fetch guild member nicknames and map accounts in parallel
              const memberPromises = allFetchedReactors.map(async (u) => {
                if (u.bot) return null;

                const discordAvatarUrl = u.avatar
                  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
                  : null;

                let serverNickname = u.global_name || u.username;

                try {
                  const memberRes = await fetch(
                    `https://discord.com/api/v10/guilds/552179975769161729/members/${u.id}`,
                    {
                      method: "GET",
                      headers: {
                        Authorization: `Bot ${discordBotToken}`,
                        "User-Agent": "IxStats/1.0",
                      },
                      signal: AbortSignal.timeout(3000),
                    }
                  );
                  if (memberRes.ok) {
                    const memberData = (await memberRes.json()) as { nick?: string | null };
                    if (memberData.nick) {
                      serverNickname = memberData.nick;
                    }
                  }
                } catch (err) {
                  console.warn(`Failed to fetch guild member nickname for ${u.id}:`, err);
                }

                let localAcc = null;

                // 1. Look up User by Discord ID or Username (IxnayID auth sync)
                const linkedUser = await db.user.findFirst({
                  where: {
                    OR: [{ discordUserId: u.id }, { discordUsername: u.username }],
                  },
                  select: {
                    clerkUserId: true,
                  },
                });

                // 2. If User found, look up their ThinkpagesAccount
                if (linkedUser) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      clerkUserId: linkedUser.clerkUserId,
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                // 3. Fallback to direct username or bio lookup
                if (!localAcc) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      OR: [
                        { username: u.username },
                        { bio: { contains: `discord:${u.username}` } },
                      ],
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                if (localAcc) {
                  return {
                    id: `discord_react_${u.id}_${u.type}`,
                    postId: input.postId,
                    reactionType: u.type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      ...localAcc,
                      displayName: serverNickname || localAcc.displayName,
                      profileImageUrl: discordAvatarUrl || localAcc.profileImageUrl,
                    },
                  };
                } else {
                  return {
                    id: `discord_react_${u.id}_${u.type}`,
                    postId: input.postId,
                    reactionType: u.type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      id: `discord_user_${u.id}`,
                      username: serverNickname,
                      displayName: serverNickname,
                      profileImageUrl: discordAvatarUrl,
                      accountType: "citizen",
                      verified: false,
                      isDiscordUser: true,
                    },
                  };
                }
              });

              const processedReactions = await Promise.all(memberPromises);
              discordReactions.push(...processedReactions.filter(Boolean));
            } catch (e) {
              console.error("Failed to fetch reactions from Discord API:", e);
            }
          }

          // Fallback to deterministic mock reactions if bot token is missing or if fetch returned nothing
          if (discordReactions.length === 0) {
            const MOCK_DISCORD_USERS = [
              { username: "bourgondie", displayName: "Burgundie", avatarSeed: "bourgondie" },
              { username: "urcea", displayName: "Urcea", avatarSeed: "urcea" },
              { username: "radamancio", displayName: "Pelaxia", avatarSeed: "radamancio" },
              { username: "masinstante", displayName: "Kiravia", avatarSeed: "masinstante" },
              { username: "keaor", displayName: "Faneria", avatarSeed: "keaor" },
              { username: "youngheroes", displayName: "Argyrea", avatarSeed: "youngheroes" },
              { username: "bobbo3", displayName: "Daxia", avatarSeed: "bobbo3" },
              {
                username: "potatolover9566",
                displayName: "Canespa",
                avatarSeed: "potatolover9566",
              },
              { username: "jaded_outcast", displayName: "Kabasa", avatarSeed: "jaded_outcast" },
              { username: "helvianir", displayName: "Maresteyn", avatarSeed: "helvianir" },
              { username: "samuel_pw", displayName: "Olmeria", avatarSeed: "samuel_pw" },
              { username: "extrudi", displayName: "Caphiria", avatarSeed: "extrudi" },
              { username: "grisblanco", displayName: "Cartadania", avatarSeed: "grisblanco" },
              {
                username: "thatvillagerguy",
                displayName: "Kostava",
                avatarSeed: "thatvillagerguy",
              },
              { username: "iander", displayName: "Yonderre", avatarSeed: "iander" },
              { username: "stealie_2", displayName: "Thervala", avatarSeed: "stealie_2" },
              { username: "fabong1722", displayName: "Metzetta", avatarSeed: "fabong1722" },
              { username: "glubert2004", displayName: "Nasastan", avatarSeed: "glubert2004" },
              { username: "cdr_mustang", displayName: "Alstin", avatarSeed: "cdr_mustang" },
              { username: "nelly", displayName: "Nelly", avatarSeed: "nelly" },
              { username: "wumpus", displayName: "Wumpus", avatarSeed: "wumpus" },
            ];

            const activeTypes = input.reactionType ? [input.reactionType] : Object.keys(counts);
            for (const type of activeTypes) {
              const count = counts[type] || 0;
              if (count <= 0) continue;

              for (let i = 0; i < count; i++) {
                const index =
                  (input.postId.charCodeAt(0) + type.charCodeAt(0) + i) % MOCK_DISCORD_USERS.length;
                const mockUser = MOCK_DISCORD_USERS[index]!;

                let localAcc = null;

                // 1. Look up User by Discord Username (IxnayID auth sync)
                const linkedUser = await db.user.findFirst({
                  where: {
                    discordUsername: mockUser.username,
                  },
                  select: {
                    clerkUserId: true,
                  },
                });

                if (linkedUser) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      clerkUserId: linkedUser.clerkUserId,
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                // 2. Fallback to direct username or bio lookup
                if (!localAcc) {
                  localAcc = await db.thinkpagesAccount.findFirst({
                    where: {
                      OR: [
                        { username: mockUser.username },
                        { bio: { contains: `discord:${mockUser.username}` } },
                      ],
                    },
                    select: {
                      id: true,
                      username: true,
                      displayName: true,
                      profileImageUrl: true,
                      accountType: true,
                      verified: true,
                    },
                  });
                }

                if (localAcc) {
                  discordReactions.push({
                    id: `mock_discord_react_${input.postId}_${type}_${i}`,
                    postId: input.postId,
                    reactionType: type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      ...localAcc,
                      profileImageUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUser.avatarSeed}`,
                    },
                  });
                } else {
                  discordReactions.push({
                    id: `mock_discord_react_${input.postId}_${type}_${i}`,
                    postId: input.postId,
                    reactionType: type,
                    timestamp: new Date(post.createdAt),
                    account: {
                      id: `mock_discord_user_${mockUser.username}`,
                      username: mockUser.displayName,
                      displayName: mockUser.displayName,
                      profileImageUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUser.avatarSeed}`,
                      accountType: "citizen",
                      verified: mockUser.username !== "nelly" && mockUser.username !== "wumpus",
                      isDiscordUser: true,
                    },
                  });
                }
              }
            }
          }
        }
      }

      return [...localReactions, ...discordReactions];
    }),
});
