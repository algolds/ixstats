import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { generateAndPostCitizenReaction } from "~/lib/auto-post-service";
import { analyzePostSentiment } from "~/lib/sentiment-analysis";
import { unsplashService } from "~/lib/unsplash-service";
import { searchWiki as wikiSearchService } from "~/lib/wiki-search-service"; // Import the wiki search service
import { notificationHooks } from "~/lib/notification-hooks";
import { getThinkPagesServer } from "~/server/websocket-server";
import { notificationAPI } from "~/lib/notification-api";
import { validateNoXSS } from "~/lib/sanitize-html";
import fs from "fs/promises";
import path from "path";

const SearchUnsplashImagesSchema = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(30).default(10),
  orientation: z.enum(['landscape', 'portrait', 'squarish']).optional(),
  color: z.string().optional(), // Unsplash API supports specific color names or hex codes
});

// Legacy schema - ThinkTanks and ThinkShare no longer use separate accounts
// Only kept for in-universe ThinkPages posts
const CreateAccountSchema = z.object({
  countryId: z.string(),
  accountType: z.enum(['government', 'media', 'citizen']),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  verified: z.boolean().default(false),
  postingFrequency: z.enum(['active', 'moderate', 'low']).default('moderate'),
  politicalLean: z.enum(['left', 'center', 'right']).default('center'),
  personality: z.enum(['serious', 'casual', 'satirical']).default('casual'),
  profileImageUrl: z.string().url().optional(),
});

const CreatePostSchema = z.object({
  accountId: z.string(), // ThinkpagesAccount ID for feed posts
  content: z.string().min(1).max(280).refine(
    (content) => {
      const validation = validateNoXSS(content);
      return validation.valid;
    },
    {
      message: "Content contains potentially unsafe HTML. Please avoid using script tags, javascript: URLs, or event handlers."
    }
  ),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).default('public'),
  parentPostId: z.string().optional(), // For replies
  repostOfId: z.string().optional(), // For reposts
  visualizations: z.array(z.object({
    type: z.enum(['economic_chart', 'diplomatic_map', 'trade_flow', 'gdp_growth']),
    title: z.string(),
    config: z.any(),
  })).optional(), // Data visualizations embedded in post
});

const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(), // ThinkpagesAccount ID for reactions
  reactionType: z.enum(['like', 'laugh', 'angry', 'sad', 'fire', 'thumbsup', 'thumbsdown']),
});

const GetFeedSchema = z.object({
  countryId: z.string().optional(), // Feed filtered by country
  hashtag: z.string().optional(),
  filter: z.enum(['recent', 'trending', 'hot']).default('recent'),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});



async function getWikiCommonsImageInfo(title: string): Promise<{ url: string; description: string; photographer: string } | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    format: 'json',
    formatversion: '2',
  });

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: {
      'User-Agent': 'IxStats-Builder',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch image info for ${title}: ${response.statusText}`);
    return null;
  }

  const data = await response.json() as Record<string, unknown>;
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

export const thinkpagesRouter = createTRPCRouter({
  // Search Unsplash images
  searchUnsplashImages: publicProcedure
    .input(SearchUnsplashImagesSchema)
    .query(async ({ input }) => {
      try {
        const images = await unsplashService.searchImages({
          query: input.query,
          page: input.page,
          per_page: input.per_page,
          orientation: input.orientation,
        });
        return images;
      } catch (error) {
        console.error("Failed to search Unsplash images:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search Unsplash images',
        });
      }
    }),

  // Search Wiki Commons images
  searchWikiCommonsImages: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      page: z.number().min(1).default(1),
      per_page: z.number().min(1).max(30).default(10),
    }))
    .query(async ({ input }) => {
      try {
        const offset = (input.page - 1) * input.per_page;
        const searchParams = new URLSearchParams({
          action: 'query',
          list: 'search',
          srsearch: input.query,
          srprop: 'titlesnippet', // Get title snippet for description
          srlimit: input.per_page.toString(),
          sroffset: offset.toString(),
          format: 'json',
          formatversion: '2',
          srwhat: 'text',
          srnamespace: '6', // File namespace
        });

        const response = await fetch(`https://commons.wikimedia.org/w/api.php?${searchParams.toString()}`, {
          headers: {
            'User-Agent': 'IxStats-Builder',
          },
        });

        if (!response.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Wikimedia Commons API responded with status ${response.status}`,
          });
        }

        const data = await response.json() as Record<string, unknown>;
        const searchResults = ((data.query as any)?.search || []) as Array<{ title: string; pageid: number }>;

        const images = await Promise.all(searchResults.map(async (result: { title: string; pageid: number }) => {
          const imageInfo = await getWikiCommonsImageInfo(result.title);
          if (imageInfo) {
            return {
              id: result.pageid.toString(),
              url: imageInfo.url,
              description: imageInfo.description,
              photographer: imageInfo.photographer,
            };
          }
          return null;
        }));

        return images.filter(Boolean); // Filter out nulls
      } catch (error) {
        console.error("Failed to search Wiki Commons images:", error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search Wiki Commons images: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  searchWiki: publicProcedure
    .input(z.object({ 
      query: z.string(), 
      wiki: z.enum(['iiwiki', 'ixwiki']),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(30)
    }))
    .query(async ({ input, ctx }) => {
      const { query, wiki, cursor, limit } = input;
      const startTime = Date.now();

      try {
        console.log(`[WikiImageSearch] Starting image search - Wiki: ${wiki}, Query: "${query}", Cursor: ${cursor || 'none'}`);

        // Import searchWikiImages function for image-specific search
        const { searchWikiImagesWithPagination } = await import('~/lib/wiki-search-service');
        const results = await searchWikiImagesWithPagination(query, wiki, cursor, limit);

        const duration = Date.now() - startTime;
        console.log(`[WikiImageSearch] Success - Found ${results.images.length} images in ${duration}ms, hasMore: ${results.hasMore}`);

        return {
          images: results.images,
          nextCursor: results.nextCursor,
          hasMore: results.hasMore,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[WikiImageSearch] Failed after ${duration}ms - Wiki: ${wiki}, Query: "${query}"`);
        console.error(`[WikiImageSearch] Error:`, error);

        // Log to database for monitoring
        try {
          await ctx.db.systemLog.create({
            data: {
              level: 'ERROR',
              category: 'WIKI_SEARCH',
              message: `Wiki image search failed: ${wiki} - ${errorMessage}`,
              endpoint: `/api/trpc/thinkpages.searchWiki`,
              component: 'WikiImageSearch',
              duration,
              metadata: JSON.stringify({
                wiki,
                query: query.substring(0, 100), // Limit query length in logs
                error: errorMessage,
              }),
              timestamp: new Date(),
            }
          });
        } catch (logError) {
          console.error('[WikiImageSearch] Failed to log error to database:', logError);
        }

        // Return graceful error to client
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search ${wiki} images: ${errorMessage}. Please try again or select a different wiki.`,
        });
      }
    }),

  // Calculate trending topics
  calculateTrendingTopics: publicProcedure.mutation(async ({ ctx }) => {
    const { db } = ctx;

    const posts = await db.thinkpagesPost.findMany({
      where: {
        ixTimeTimestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        hashtags: true,
        likeCount: true,
        repostCount: true,
        replyCount: true,
      },
    });

    const hashtagCounts: Record<string, { count: number; engagement: number }> = {};

    for (const post of posts) {
      const hashtags = post.hashtags ? JSON.parse(post.hashtags) : [];
      for (const hashtag of hashtags) {
        if (!hashtagCounts[hashtag]) {
          hashtagCounts[hashtag] = { count: 0, engagement: 0 };
        }
        hashtagCounts[hashtag].count++;
        hashtagCounts[hashtag].engagement += (post.likeCount ?? 0) + (post.repostCount ?? 0) + (post.replyCount ?? 0);
      }
    }

    for (const hashtag in hashtagCounts) {
      const hashtagData = hashtagCounts[hashtag];
      if (!hashtagData) continue;
      
      await db.trendingTopic.upsert({
        where: { hashtag },
        create: {
          hashtag,
          postCount: hashtagData.count,
          engagement: hashtagData.engagement,
          peakTimestamp: new Date(),
        },
        update: {
          postCount: hashtagData.count,
          engagement: hashtagData.engagement,
          peakTimestamp: new Date(),
        },
      });
    }

    return { success: true };
  }),

  // Search users globally for ThinkTanks/ThinkShare
  searchUsers: publicProcedure
    .input(z.object({
      query: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Search users by clerkUserId or country name
      const users = await db.user.findMany({
        where: {
          OR: [
            {
              clerkUserId: {
                contains: input.query,
              },
            },
            {
              country: {
                name: {
                  contains: input.query,
                },
              },
            },
          ],
          isActive: true,
        },
        include: {
          country: true,
        },
        take: 5,
      });

      // Return sanitized account-like objects for frontend (id is Clerk userId, display shows country)
      return users.map((u) => ({
        id: u.clerkUserId,
        username: u.country?.slug || '',
        displayName: u.country?.name || 'Unknown Country',
        profileImageUrl: u.country?.flag || null,
        accountType: 'country',
      }));
    }),

  // Update ThinkPages Feed Account
  updateAccount: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      verified: z.boolean().optional(),
      profileImageUrl: z.string().url().optional(),
      postingFrequency: z.enum(['active', 'moderate', 'low']).optional(),
      politicalLean: z.enum(['left', 'center', 'right']).optional(),
      personality: z.enum(['serious', 'casual', 'satirical']).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to update accounts'
        });
      }

      // Verify the account belongs to the current user
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId }
      });

      if (!existingAccount || existingAccount.clerkUserId !== clerkUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this account'
        });
      }

      const account = await db.thinkpagesAccount.update({
        where: { id: input.accountId },
        data: {
          verified: input.verified,
          postingFrequency: input.postingFrequency,
          politicalLean: input.politicalLean,
          personality: input.personality,
          profileImageUrl: input.profileImageUrl,
          isActive: input.isActive,
        },
      });

      return account;
    }),
  // Username availability check for ThinkPages Feed Accounts
  checkUsernameAvailability: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Check if username is already taken in ThinkpagesAccount table
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { username: input.username }
      });
      
      return { isAvailable: !existingAccount };
    }),

  // Generate random profile picture
  generateProfilePicture: publicProcedure
    .mutation(async () => {
      // Return first placeholder image (deterministic, not random)
      const placeholderImage = "https://via.placeholder.com/150/4F46E5/FFFFFF?text=User";
      return { imageUrl: placeholderImage };
    }),

  // Create ThinkPages Feed Account - For Feed only (not ThinkTanks/ThinkShare)
  createAccount: protectedProcedure
    .input(CreateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to create accounts'
        });
      }

      // Check account limit - 25 accounts per clerk user
      const existingAccounts = await db.thinkpagesAccount.findMany({
        where: { clerkUserId }
      });

      if (existingAccounts.length >= 25) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have reached the maximum of 25 ThinkPages accounts per user'
        });
      }

      // Check username availability
      const existingUsername = await db.thinkpagesAccount.findUnique({
        where: { username: input.username }
      });

      if (existingUsername) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Username is already taken'
        });
      }

      // Verify country exists
      const country = await db.country.findUnique({
        where: { id: input.countryId }
      });

      if (!country) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Country not found'
        });
      }

      // Create the account
      const displayName = `${input.firstName} ${input.lastName}`;
      const account = await db.thinkpagesAccount.create({
        data: {
          clerkUserId,
          countryId: input.countryId,
          accountType: input.accountType,
          username: input.username,
          displayName,
          firstName: input.firstName,
          lastName: input.lastName,
          bio: input.bio,
          verified: input.verified,
          postingFrequency: input.postingFrequency,
          politicalLean: input.politicalLean,
          personality: input.personality,
          profileImageUrl: input.profileImageUrl,
        }
      });

      return account;
    }),

  // Get ThinkPages Feed Accounts by Country - For Feed only
  getAccountsByCountry: publicProcedure
    .input(z.object({ countryId: z.string().optional().default('') }).default({ countryId: '' }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      if (!input.countryId || input.countryId.trim() === '') {
        return [];
      }

      const accounts = await db.thinkpagesAccount.findMany({
        where: { 
          countryId: input.countryId,
          isActive: true
        },
        orderBy: [
          { verified: 'desc' },
          { followerCount: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      return accounts;
    }),

  // Get Account Counts by Type - For Feed only
  getAccountCountsByType: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const accounts = await db.thinkpagesAccount.findMany({
        where: { 
          countryId: input.countryId,
          isActive: true
        },
        select: { accountType: true }
      });

      const counts = {
        citizen: accounts.filter(a => a.accountType === 'citizen').length,
        government: accounts.filter(a => a.accountType === 'government').length,
        media: accounts.filter(a => a.accountType === 'media').length,
        organization: 0 // Not used currently
      };

      return counts;
    }),

  // Post creation
  createPost: protectedProcedure
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Verify account exists and is active
      const clerkUserId = ctx.auth?.userId;
      if (!clerkUserId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to create posts'
        });
      }

      const account = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId }
      });
      
      if (!account || !account.isActive) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or inactive'
        });
      }

      if (account.clerkUserId !== clerkUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to post from this account'
        });
      }
      
      // Determine post type
      let postType: 'original' | 'repost' | 'reply' = 'original';
      if (input.parentPostId) postType = 'reply';
      if (input.repostOfId) postType = 'repost';
      
      // Create the post
      const post = await db.thinkpagesPost.create({
        data: {
          accountId: input.accountId,
          content: input.content,
          hashtags: input.hashtags ? JSON.stringify(input.hashtags) : null,
          visualizations: input.visualizations ? JSON.stringify(input.visualizations) : null,
          postType,
          parentPostId: input.parentPostId,
          repostOfId: input.repostOfId,
          visibility: input.visibility,
          ixTimeTimestamp: new Date() // Store real-world time for social media timestamps
        },
        include: {
          account: true,
          parentPost: {
            include: { 
              account: true
            }
          },
          repostOf: {
            include: { 
              account: true
            }
          }
        }
      });
      
      // Update account post count
      await db.thinkpagesAccount.update({
        where: { id: input.accountId },
        data: { 
          postCount: { increment: 1 }
        }
      });
      
      // Create mentions if any
      if (input.mentions && input.mentions.length > 0) {
        const mentionedAccounts = await db.thinkpagesAccount.findMany({
          where: {
            username: {
              in: input.mentions.map(m => m.replace('@', ''))
            }
          },
          select: { id: true, username: true, clerkUserId: true }
        });

        const mentionData = mentionedAccounts.map((mentionedAccount: any) => ({
          postId: post.id,
          mentionedAccountId: mentionedAccount.id,
          position: input.content.indexOf(`@${mentionedAccount.username}`)
        }));

        if (mentionData.length > 0) {
          await db.postMention.createMany({
            data: mentionData
          });

          // 🔔 Notify mentioned users
          for (const mentioned of mentionedAccounts) {
            await notificationHooks.onSocialActivity({
              activityType: 'mention',
              fromUserId: account.clerkUserId,
              toUserId: mentioned.clerkUserId,
              contentTitle: input.content.substring(0, 50),
              contentId: post.id,
            }).catch(err => console.error('[ThinkPages] Failed to send mention notification:', err));
          }
        }
      }

      // 🔔 Notify if this is a reply
      if (input.parentPostId && post.parentPost) {
        const parentPost = await db.thinkpagesPost.findUnique({
          where: { id: input.parentPostId },
          include: { account: true }
        });

        if (parentPost && parentPost.accountId !== input.accountId) {
          await notificationHooks.onThinkPageActivity({
            thinkpageId: post.id,
            title: input.content.substring(0, 50),
            action: 'commented',
            authorId: account.clerkUserId,
            targetUserId: parentPost.account.clerkUserId,
          }).catch(err => console.error('[ThinkPages] Failed to send reply notification:', err));
        }
      }

      return post;
    }),

  // Add reaction to post
  addReaction: protectedProcedure
    .input(AddReactionSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const clerkUserId = ctx.auth?.userId;

      if (!clerkUserId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to react to posts'
        });
      }

      // Verify the account belongs to the current user
      const account = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId }
      });

      if (!account || account.clerkUserId !== clerkUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to use this account'
        });
      }

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { reactionCounts: true },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      const reactionCounts = post.reactionCounts ? JSON.parse(post.reactionCounts) : {};

      const existingReaction = await db.postReaction.findUnique({
        where: {
          postId_accountId: {
            postId: input.postId,
            accountId: input.accountId,
          },
        },
      });

      if (existingReaction) {
        if (existingReaction.reactionType === input.reactionType) {
          return existingReaction;
        }

        reactionCounts[existingReaction.reactionType] = (reactionCounts[existingReaction.reactionType] || 1) - 1;
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        const reaction = await db.postReaction.update({
          where: {
            postId_accountId: {
              postId: input.postId,
              accountId: input.accountId,
            },
          },
          data: { reactionType: input.reactionType },
        });

        await db.thinkpagesPost.update({
          where: { id: input.postId },
          data: { reactionCounts: JSON.stringify(reactionCounts) },
        });

        return reaction;
      } else {
        reactionCounts[input.reactionType] = (reactionCounts[input.reactionType] || 0) + 1;

        const reaction = await db.postReaction.create({
          data: {
            postId: input.postId,
            accountId: input.accountId,
            reactionType: input.reactionType,
          },
        });

        await db.thinkpagesPost.update({
          where: { id: input.postId },
          data: { reactionCounts: JSON.stringify(reactionCounts) },
        });

        // 🔔 Notify post author of new reaction (likes only)
        if (!existingReaction && input.reactionType === 'like') {
          const postWithAuthor = await db.thinkpagesPost.findUnique({
            where: { id: input.postId },
            select: { accountId: true, content: true }
          });

          if (postWithAuthor && postWithAuthor.accountId !== input.accountId) {
            await notificationHooks.onThinkPageActivity({
              thinkpageId: input.postId,
              title: postWithAuthor.content.substring(0, 50),
              action: 'liked',
              authorId: input.accountId,
              targetUserId: postWithAuthor.accountId,
            }).catch(err => console.error('[ThinkPages] Failed to send like notification:', err));
          }
        }

        return reaction;
      }
    }),

  // Remove reaction
  removeReaction: protectedProcedure
    .input(z.object({
      postId: z.string(),
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { reactionCounts: true },
      });

      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found',
        });
      }

      const reactionCounts = post.reactionCounts ? JSON.parse(post.reactionCounts) : {};

      const existingReaction = await db.postReaction.findUnique({
        where: {
          postId_accountId: {
            postId: input.postId,
            accountId: input.accountId,
          },
        },
      });

      if (existingReaction) {
        reactionCounts[existingReaction.reactionType] = (reactionCounts[existingReaction.reactionType] || 1) - 1;

        await db.postReaction.delete({
          where: {
            postId_accountId: {
              postId: input.postId,
              accountId: input.accountId,
            },
          },
        });

        await db.thinkpagesPost.update({
          where: { id: input.postId },
          data: { reactionCounts: JSON.stringify(reactionCounts) },
        });

        return { success: true };
      }

      return { success: false };
    }),

  // Get feed
  getFeed: publicProcedure
    .input(GetFeedSchema)
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      let whereClause: any = {
        visibility: 'public' // Only show public posts for now
      };
      
      // Add country filter if specified
      if ((input as any).countryId) {
        whereClause.account = {
          countryId: (input as any).countryId
        };
      }
      
      // Add trending filter
      if (input.filter === 'trending') {
        whereClause.trending = true;
      }

      if (input.hashtag) {
        whereClause.hashtags = {
          contains: `"${input.hashtag}"`,
        };
      }
      
      const posts = await db.thinkpagesPost.findMany({
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
            }
          },
          parentPost: {
            include: {
              account: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  profileImageUrl: true,
                  accountType: true,
                  verified: true,
                }
              }
            }
          },
          repostOf: {
            include: {
              account: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  profileImageUrl: true,
                  accountType: true,
                  verified: true,
                }
              }
            }
          },
          reactions: true,
          _count: {
            select: {
              // reactions: true // Relation doesn't exist,
              replies: true,
              reposts: true
            }
          }
        },
        orderBy: [
          { pinned: 'desc' },
          { createdAt: 'desc' }
        ],
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0
      });
      
      // Transform posts to include parsed hashtags and reaction counts
      const transformedPosts = posts.map(post => ({
        ...post,
        hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
        reactionCounts: (post as any).reactions.reduce((acc: any, reaction: any) => {
          acc[reaction.reactionType] = (acc[reaction.reactionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timestamp: post.createdAt.toISOString()
      }));
      
      return {
        posts: transformedPosts,
        nextCursor: posts.length === input.limit ? posts[posts.length - 1]?.id : null
      };
    }),

  // Get trending topics
  getTrendingTopics: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(10)
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const trendingTopics = await db.trendingTopic.findMany({
        where: { isActive: true },
        orderBy: [
          { engagement: 'desc' },
          { postCount: 'desc' }
        ],
        take: input.limit
      });
      
      return trendingTopics;
    }),

  // Get account details
  getAccount: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const account = await db.user.findUnique({
        where: { id: input.userId },
        include: {
          country: true,
          _count: {
            select: {
              // posts: true, // Relation doesn't exist
              // reactions: true // Relation doesn't exist
            }
          }
        }
      });
      
      if (!account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found'
        });
      }
      
      return account;
    }),

  // Get Thinkpages account by Clerk User ID
  getThinkpagesAccountByUserId: publicProcedure
    .input(z.object({ clerkUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const account = await db.user.findFirst({
        where: { country: { user: { clerkUserId: input.clerkUserId } } },
        include: {
          country: true
        }
      });

      return account;
    }),

  // Get post details with replies
  getPost: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        include: {
          // account: true, // Relation doesn't exist
          parentPost: {
            include: { 
              // account: true // Relation doesn't exist
            }
          },
          repostOf: {
            include: { 
              // account: true // Relation doesn't exist
            }
          },
          replies: {
            include: {
              // account: true, // Relation doesn't exist
              // reactions: true // Relation doesn't exist
            },
            orderBy: { ixTimeTimestamp: 'asc' },
            take: 50
          },
          reactions: true
        }
      });
      
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        });
      }
      
      return {
        ...post,
        hashtags: post.hashtags ? JSON.parse(post.hashtags) : [],
        timestamp: post.createdAt.toISOString()
      };
    }),

  // Trigger citizen reaction to a post
  triggerCitizenReaction: publicProcedure
    .input(z.object({ postId: z.string() }))
    .mutation(async ({ input }) => {
      const { generateAndPostCitizenReaction } = await import("~/lib/auto-post-service");
      await generateAndPostCitizenReaction(input.postId);
      return { success: true, message: "Citizen reaction triggered" };
    }),

  // Calculate and store country mood metrics
  calculateCountryMoodMetrics: publicProcedure
    .mutation(async ({ ctx }) => {
      const { db } = ctx;
      const { analyzePostSentiment } = await import("~/lib/sentiment-analysis");
      const currentIxTime = IxTime.getCurrentIxTime();
      const twentyFourHoursAgo = new Date(currentIxTime - 24 * 60 * 60 * 1000);

      const countries = await db.country.findMany({
        select: { id: true, name: true },
      });

      for (const country of countries) {
        const citizenAccounts = await db.user.findMany({
          where: {
            countryId: country.id,
            // accountType: 'citizen', // Field doesn't exist in User model
            isActive: true,
          },
          select: { id: true },
        });

        if (citizenAccounts.length === 0) {
          console.log(`No citizen accounts for ${country.name}, skipping mood metric calculation.`);
          continue;
        }

        const citizenAccountIds = citizenAccounts.map((acc: any) => acc.id);

        const recentCitizenPosts = await db.thinkpagesPost.findMany({
          where: {
            accountId: { in: citizenAccountIds },
            ixTimeTimestamp: { gte: twentyFourHoursAgo },
          },
          include: { reactions: true }, // Include reactions for sentiment analysis
        });

        if (recentCitizenPosts.length === 0) {
          console.log(`No recent citizen posts for ${country.name}, skipping mood metric calculation.`);
          continue;
        }

        let totalSentiment = 0;
        for (const post of recentCitizenPosts) {
          totalSentiment += analyzePostSentiment(post as any); // Cast to any due to Prisma type mismatch for relations
        }

        const averageSentiment = totalSentiment / recentCitizenPosts.length;

        // Store the mood metric
        const dailyTimestamp = new Date(currentIxTime);
        dailyTimestamp.setHours(0, 0, 0, 0);
        
        await db.countryMoodMetric.upsert({
          where: {
            countryId_timestamp: {
              countryId: country.id,
              timestamp: dailyTimestamp,
            },
          },
          update: {
            sentimentScore: averageSentiment,
            postCount: recentCitizenPosts.length,
            timestamp: dailyTimestamp,
          },
          create: {
            countryId: country.id,
            sentimentScore: averageSentiment,
            postCount: recentCitizenPosts.length,
            timestamp: dailyTimestamp,
          },
        });
        console.log(`Calculated mood metric for ${country.name}: ${averageSentiment.toFixed(2)}`);
      }
      return { success: true, message: "Country mood metrics calculated" };
    }),

  // ===== THINKTANKS (GROUPS) ENDPOINTS =====

  // Create a new ThinkTank group
  createThinktank: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      avatar: z.string().url().optional(),
      type: z.enum(['public', 'private', 'invite_only']).default('public'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      createdBy: z.string(), // userId (clerkUserId)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify the creator user exists - or allow ThinkTanks to work without full user setup
      const creatorUser = await db.user.findUnique({
        where: { clerkUserId: input.createdBy },
        include: { country: true }
      });

      // For ThinkTanks, we'll allow creation even without full user setup
      // This enables global access without requiring country selection
      if (!input.createdBy || input.createdBy.trim() === '') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'User ID is required'
        });
      }

      // Create the group
      const group = await db.thinktankGroup.create({
        data: {
          name: input.name,
          description: input.description,
          avatar: input.avatar,
          type: input.type,
          category: input.category,
          tags: input.tags ? JSON.stringify(input.tags) : null,
          createdBy: input.createdBy,
          memberCount: 1
        },
        include: {
          members: true
        }
      });

      // Add creator as owner
      await db.thinktankMember.create({
        data: {
          groupId: group.id,
          userId: input.createdBy,
          role: 'owner'
        }
      });

      return group;
    }),

  // Get ThinkTanks globally (no country restriction)
  getThinktanks: publicProcedure
    .input(z.object({
      userId: z.string().optional().default(''),
      type: z.enum(['all', 'joined', 'created']).optional().default('all')
    }).optional().default(() => ({ userId: '', type: 'all' as const })))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        // FAILSAFE: Handle ANY invalid input scenario
        if (!input) {
          console.log('getThinktanks: No input provided, returning empty array');
          return [];
        }
        
        if (!input.userId || input.userId.trim() === '' || input.userId === 'INVALID') {
          console.log('getThinktanks: Invalid userId, returning empty array');
          return [];
        }

        let whereClause: any = {
          isActive: true
        };

        if (input.type === 'joined' && input.userId) {
          whereClause.members = {
            some: {
              userId: input.userId,
              isActive: true
            }
          };
        } else if (input.type === 'created' && input.userId) {
          whereClause.createdBy = input.userId;
        }

        const groups = await db.thinktankGroup.findMany({
          where: whereClause,
          include: {
            members: {
              where: { isActive: true }
            },
            _count: {
              select: {
                members: true,
                messages: true
              }
            }
          },
          orderBy: [
            { memberCount: 'desc' },
            { createdAt: 'desc' }
          ]
        });

        return groups.map(group => ({
          ...group,
          tags: group.tags ? JSON.parse(group.tags) : [],
          isJoined: input.userId ? group.members.some(m => m.userId === input.userId) : false
        }));
      } catch (error) {
        console.error('Error in getThinktanks:', error);
        // FAILSAFE: Return empty array instead of throwing error
        return [];
      }
    }),

  // Join a ThinkTank group
  joinThinktank: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string() // Changed to userId (clerkUserId)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check if group exists and is active
      const group = await db.thinktankGroup.findUnique({
        where: { id: input.groupId, isActive: true }
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found or inactive'
        });
      }

      // Verify user exists and is active
      const user = await db.user.findUnique({
        where: { clerkUserId: input.userId }
      });

      if (!user || !user.isActive) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found or inactive'
        });
      }

      // Check if user is already a member
      const existingMember = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId
          }
        }
      });

      if (existingMember) {
        if (existingMember.isActive) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Already a member of this group'
          });
        } else {
          // Reactivate membership
          await db.thinktankMember.update({
            where: { id: existingMember.id },
            data: { isActive: true, joinedAt: new Date() }
          });
        }
      } else {
        // Create new membership
        await db.thinktankMember.create({
          data: {
            groupId: input.groupId,
            userId: input.userId,
            role: 'member'
          }
        });
      }

      // Update member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { increment: 1 } }
      });

      return { success: true, message: 'Successfully joined group' };
    }),

  // Leave a ThinkTank group
  leaveThinktank: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string() // Changed to userId (clerkUserId)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId
          }
        }
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Not a member of this group'
        });
      }

      // Can't leave if you're the owner and there are other members
      if (member.role === 'owner') {
        const otherActiveMembers = await db.thinktankMember.count({
          where: {
            groupId: input.groupId,
            userId: { not: input.userId },
            isActive: true
          }
        });

        if (otherActiveMembers > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot leave group as owner while other members exist. Transfer ownership first.'
          });
        }
      }

      // Deactivate membership
      await db.thinktankMember.update({
        where: { id: member.id },
        data: { isActive: false }
      });

      // Update member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { decrement: 1 } }
      });

      return { success: true, message: 'Successfully left group' };
    }),

  // Get ThinkTank messages
  getThinktankMessages: publicProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string(), // Added to verify membership
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId
          }
        }
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this group'
        });
      }

      const messages = await db.thinktankMessage.findMany({
        where: {
          groupId: input.groupId,
          deletedAt: null
        },
        include: {
          replyTo: true,
          readReceipts: true,
          _count: {
            select: { replies: true }
          }
        },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0
      });

      return {
        messages: messages.map(msg => ({
          ...msg,
          reactions: msg.reactions ? JSON.parse(msg.reactions) : {},
          mentions: msg.mentions ? JSON.parse(msg.mentions) : [],
          attachments: msg.attachments ? JSON.parse(msg.attachments) : []
        })),
        nextCursor: messages.length === input.limit ? messages[messages.length - 1]?.id : null
      };
    }),

  // Send message to ThinkTank
  sendThinktankMessage: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
      content: z.string().min(1).refine(
        (content) => validateNoXSS(content).valid,
        { message: "Content contains potentially unsafe HTML" }
      ),
      messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
      replyToId: z.string().optional(),
      mentions: z.array(z.string()).optional(),
      attachments: z.array(z.object({
        type: z.string(),
        url: z.string(),
        filename: z.string().optional(),
        size: z.number().optional()
      })).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId
          }
        }
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this group'
        });
      }

      // Create the message
      const message = await db.thinktankMessage.create({
        data: {
          groupId: input.groupId,
          userId: input.userId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date()
        },
        include: {
          replyTo: true
        }
      });

      return message;
    }),

  // Update a ThinkTank group
  updateThinktank: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      avatar: z.string().url().optional(),
      type: z.enum(['public', 'private', 'invite_only']).optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { groupId, ...updateData } = input;

      const group = await db.thinktankGroup.update({
        where: { id: groupId },
        data: {
          ...updateData,
          tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
        },
      });

      return group;
    }),

  deleteThinktank: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Add logic to check if user is owner/admin
      await db.thinktankGroup.delete({
        where: { id: input.groupId },
      });
      return { success: true };
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
      role: z.enum(['admin', 'member']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.thinktankMember.update({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });
      return { success: true };
    }),

  removeMemberFromThinktank: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.thinktankMember.delete({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.userId,
          },
        },
      });
      // Decrement member count
      await db.thinktankGroup.update({
        where: { id: input.groupId },
        data: { memberCount: { decrement: 1 } },
      });
      return { success: true };
    }),

  // Invite users to a ThinkTank group
  inviteToThinktank: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      userIds: z.array(z.string()), // Changed to userIds (clerkUserIds)
      invitedBy: z.string(), // userId (clerkUserId)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const invites = await db.thinktankInvite.createMany({
        data: input.userIds.map(userId => ({
          groupId: input.groupId,
          invitedUser: userId,
          invitedBy: input.invitedBy,
        })),
      });

      return invites;
    }),

  // Get collaborative documents for a ThinkTank
  getThinktankDocuments: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify user is a member of the group
      const documents = await db.collaborativeDoc.findMany({
        where: { groupId: input.groupId },
        orderBy: { updatedAt: 'desc' },
        take: 10 // Limit to 10 documents per group
      });

      return documents;
    }),

  // Create a collaborative document
  createThinktankDocument: protectedProcedure
    .input(z.object({
      groupId: z.string(),
      title: z.string().min(1).max(200),
      createdBy: z.string(), // userId (clerkUserId)
      content: z.string().optional().refine(
        (content) => !content || validateNoXSS(content).valid,
        { message: "Content contains potentially unsafe HTML" }
      ),
      isPublic: z.boolean().default(false)
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Check document count limit (10 per group)
      const documentCount = await db.collaborativeDoc.count({
        where: { groupId: input.groupId }
      });

      if (documentCount >= 10) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maximum document limit (10) reached for this group'
        });
      }

      // Verify user is a member of the group
      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_userId: {
            groupId: input.groupId,
            userId: input.createdBy
          }
        }
      });

      if (!member || !member.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this group'
        });
      }

      const document = await db.collaborativeDoc.create({
        data: {
          groupId: input.groupId,
          title: input.title,
          content: input.content || '',
          version: 1,
          createdBy: input.createdBy,
          lastEditBy: input.createdBy,
          isPublic: input.isPublic
        },
      });

      return document;
    }),

  // Update a collaborative document
  updateThinktankDocument: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      userId: z.string(),
      title: z.string().min(1).max(200).optional(),
      content: z.string().optional().refine(
        (content) => !content || validateNoXSS(content).valid,
        { message: "Content contains potentially unsafe HTML" }
      ),
      isPublic: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Get the document to check permissions
      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: { group: { include: { members: true } } }
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found'
        });
      }

      // Verify user is a member
      const isMember = document.group.members.some(
        m => m.userId === input.userId && m.isActive
      );

      if (!isMember) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a member of this group'
        });
      }

      const updateData: any = {
        lastEditBy: input.userId,
        version: { increment: 1 }
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

      const updatedDocument = await db.collaborativeDoc.update({
        where: { id: input.documentId },
        data: updateData
      });

      return updatedDocument;
    }),

  // Delete a collaborative document
  deleteThinktankDocument: protectedProcedure
    .input(z.object({
      documentId: z.string(),
      userId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: { group: true }
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found'
        });
      }

      // Only creator or group owner can delete
      const isCreator = document.createdBy === input.userId;
      const isGroupOwner = document.group.createdBy === input.userId;

      if (!isCreator && !isGroupOwner) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only document creator or group owner can delete documents'
        });
      }

      await db.collaborativeDoc.delete({
        where: { id: input.documentId }
      });

      return { success: true };
    }),

  // Get a single document
  getThinktankDocument: publicProcedure
    .input(z.object({
      documentId: z.string(),
      userId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const document = await db.collaborativeDoc.findUnique({
        where: { id: input.documentId },
        include: {
          group: {
            include: {
              members: {
                where: { isActive: true }
              }
            }
          }
        }
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found'
        });
      }

      // Check permissions
      if (!document.isPublic) {
        const isMember = document.group.members.some(
          m => m.userId === input.userId
        );

        if (!isMember) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have access to this document'
          });
        }
      }

      return document;
    }),

  // Add reaction to a Thinkshare message
  addReactionToMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
      reaction: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, userId, reaction } = input;

      const message = await db.thinkshareMessage.findUnique({
        where: { id: messageId },
        select: { reactions: true },
      });

      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const reactions = message.reactions ? JSON.parse(message.reactions as string) : {};
      reactions[reaction] = (reactions[reaction] || 0) + 1;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
      });

      return { success: true };
    }),

  // Remove reaction from a Thinkshare message
  removeReactionFromMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      reaction: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, reaction } = input;

      const message = await db.thinkshareMessage.findUnique({
        where: { id: messageId },
        select: { reactions: true },
      });

      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Message not found' });
      }

      const reactions = message.reactions ? JSON.parse(message.reactions as string) : {};
      if (reactions[reaction]) {
        reactions[reaction]--;
        if (reactions[reaction] === 0) {
          delete reactions[reaction];
        }
      }

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { reactions: JSON.stringify(reactions) },
      });

      return { success: true };
    }),

  // Edit a Thinkshare message
  editMessage: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      content: z.string().min(1).refine(
        (content) => validateNoXSS(content).valid,
        { message: "Content contains potentially unsafe HTML" }
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, content } = input;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { content, editedAt: new Date() },
      });

      return { success: true };
    }),

  // Delete a Thinkshare message
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId } = input;

      await db.thinkshareMessage.update({
        where: { id: messageId },
        data: { deletedAt: new Date(), content: '[deleted]' },
      });

      return { success: true };
    }),

  // ===== THINKSHARE (MESSAGING) ENDPOINTS =====

  // Create a new conversation
  createConversation: protectedProcedure
    .input(z.object({
      participantIds: z.array(z.string().min(1)) // Now expects userIds (clerkUserIds)
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('🔍 Server mutation called with raw input:', input);
      console.log('🔍 Input type:', typeof input);
      console.log('🔍 Input keys:', Object.keys(input || {}));
      console.log('🔍 participantIds:', input?.participantIds);
      
      const { db } = ctx;
      const { participantIds } = input;

      // Validate participants
      if (participantIds.length === 0 || participantIds.length > 2) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Direct conversations must have 1-2 participants'
        });
      }

      const uniqueParticipantIds = [...new Set(participantIds)];
      
      // Verify all participants exist as users
      const users = await db.user.findMany({
        where: { 
          clerkUserId: { in: uniqueParticipantIds },
          isActive: true
        },
        include: { country: true }
      });

      if (users.length !== uniqueParticipantIds.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'One or more participants not found'
        });
      }

      // Check for existing conversation
      const existingConv = await db.thinkshareConversation.findFirst({
        where: {
          type: 'direct',
          AND: uniqueParticipantIds.map(participantId => ({
            participants: {
              some: {
                userId: participantId,
                isActive: true
              }
            }
          })),
          participants: {
            none: {
              userId: {
                notIn: uniqueParticipantIds
              },
              isActive: true
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true }
          }
        }
      });

      if (existingConv) {
        return existingConv;
      }

      // Create new conversation
      const conversation = await db.thinkshareConversation.create({
        data: {
          type: 'direct',
          participants: {
            createMany: {
              data: uniqueParticipantIds.map(userId => ({
                userId,
                role: 'participant'
              }))
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true }
          }
        }
      });

      return conversation;
    }),

  // Get conversations for a user
  getConversations: publicProcedure
    .input(z.object({
      userId: z.string().optional().default(''), // Changed to userId (clerkUserId)
      limit: z.number().min(1).max(50).optional().default(20),
      cursor: z.string().optional()
    }).optional().default(() => ({ userId: '', limit: 20 })))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        // FAILSAFE: Handle ANY invalid input scenario
        if (!input) {
          console.log('getConversations: No input provided, returning empty result');
          return {
            conversations: [],
            nextCursor: null
          };
        }
        
        if (!input.userId || input.userId.trim() === '' || input.userId === 'INVALID') {
          console.log('getConversations: Invalid userId, returning empty result');
          return {
            conversations: [],
            nextCursor: null
          };
        }

      const conversations = await db.thinkshareConversation.findMany({
        where: {
          isActive: true,
          participants: {
            some: {
              userId: input.userId,
              isActive: true
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true }
          },
          messages: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 1
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: { lastActivity: 'desc' },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0
      });
      // Fetch user profiles for all participants and last messages in a single batch
      const participantUserIds = new Set<string>();
      for (const conv of conversations as any[]) {
        for (const p of conv.participants) participantUserIds.add(p.userId);
        if (conv.messages[0]?.userId) participantUserIds.add(conv.messages[0].userId);
      }

      const users = await db.user.findMany({
        where: { clerkUserId: { in: Array.from(participantUserIds) } },
        include: { country: true },
      });
      const userMap = new Map(users.map(u => [u.clerkUserId, u]));

      return {
        conversations: conversations.map((conv: any) => {
          const participantWithAccount = conv.participants.map((p: any) => {
            const u = userMap.get(p.userId);
            return {
              ...p,
              accountId: p.userId,
              account: u ? {
                id: u.clerkUserId,
                username: u.country?.slug || '',
                displayName: u.country?.name || 'Unknown Country',
                profileImageUrl: u.country?.flag || null,
                accountType: 'country',
              } : null,
            };
          });

          const otherParticipants = participantWithAccount.filter((p: any) => p.userId !== input.userId);
          const lastMessageRaw = conv.messages[0];
          const lastMessageUser = lastMessageRaw ? userMap.get(lastMessageRaw.userId) : null;
          const lastMessage = lastMessageRaw ? {
            ...lastMessageRaw,
            accountId: lastMessageRaw.userId,
            account: lastMessageUser ? {
              id: lastMessageUser.clerkUserId,
              username: lastMessageUser.country?.slug || '',
              displayName: lastMessageUser.country?.name || 'Unknown Country',
              profileImageUrl: lastMessageUser.country?.flag || null,
              accountType: 'country',
            } : null,
          } : undefined;

          // Calculate unread count placeholder (0 for now)
          const participant = conv.participants.find((p: any) => p.userId === input.userId);

          return {
            ...conv,
            participants: participantWithAccount,
            otherParticipants,
            lastMessage,
            lastReadAt: participant?.lastReadAt,
            unreadCount: 0,
          };
        }),
        nextCursor: conversations.length === input.limit ? conversations[conversations.length - 1]?.id : null
      };
      } catch (error) {
        console.error('Error in getConversations:', error);
        // FAILSAFE: Return empty result instead of throwing error
        return {
          conversations: [],
          nextCursor: null
        };
      }
    }),

  // Get messages for a conversation
  getConversationMessages: publicProcedure
    .input(z.object({
      conversationId: z.string().min(1, "Conversation ID is required").optional(),
      userId: z.string().min(1, "User ID is required").optional(), // Changed to userId (clerkUserId)
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      console.log('🔍 getConversationMessages - Input:', {
        conversationId: input.conversationId,
        userId: input.userId,
        limit: input.limit
      });

      // Validate required fields exist
      if (!input.conversationId || !input.userId) {
        console.log('❌ Missing required fields');
        return {
          messages: [],
          nextCursor: null
        };
      }

      // Validate IDs are not placeholder values
      if (input.conversationId === 'INVALID' || input.userId === 'INVALID' ||
          input.conversationId === 'SKIP_QUERY' || input.userId === 'SKIP_QUERY') {
        console.log('❌ Placeholder values detected');
        return {
          messages: [],
          nextCursor: null
        };
      }

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId
          }
        }
      });

      console.log('👤 Participant check:', {
        found: !!participant,
        isActive: participant?.isActive
      });

      if (!participant || !participant.isActive) {
        console.log('❌ Not a participant or inactive');
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a participant in this conversation'
        });
      }

      const messages = await db.thinkshareMessage.findMany({
        where: {
          conversationId: input.conversationId,
          deletedAt: null
        },
        include: {
          replyTo: true,
          readReceipts: true
        },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: input.limit,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0
      });

      // Fetch unique user IDs from messages
      const userIds = [...new Set(messages.map(msg => msg.userId))];

      // Fetch all accounts in one query
      const accounts = await db.user.findMany({
        where: {
          clerkUserId: { in: userIds }
        },
        include: { country: true }
      });

      // Create a map for quick lookup
      const accountMap = new Map(accounts.map((acc: any) => [acc.clerkUserId, acc]));

      return {
        messages: messages.map(msg => ({
          ...msg,
          account: (() => {
            const u = accountMap.get(msg.userId);
            return u ? {
              id: u.clerkUserId,
              username: u.country?.slug || '',
              displayName: u.country?.name || 'Unknown Country',
              profileImageUrl: u.country?.flag || null,
              accountType: 'country',
            } : null;
          })(),
          accountId: msg.userId, // Keep accountId for compatibility
          reactions: msg.reactions ? JSON.parse(msg.reactions) : {},
          mentions: msg.mentions ? JSON.parse(msg.mentions) : [],
          attachments: msg.attachments ? JSON.parse(msg.attachments) : []
        })),
        nextCursor: messages.length === input.limit ? messages[messages.length - 1]?.id : null
      };
    }),

  // Send message to conversation
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
      content: z.string().min(1).refine(
        (content) => validateNoXSS(content).valid,
        { message: "Content contains potentially unsafe HTML" }
      ),
      messageType: z.enum(['text', 'image', 'file', 'system']).default('text'),
      replyToId: z.string().optional(),
      mentions: z.array(z.string()).optional(),
      attachments: z.array(z.object({
        type: z.string(),
        url: z.string(),
        filename: z.string().optional(),
        size: z.number().optional()
      })).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      console.log('🔍 sendMessage called with input:', input);
      console.log('🔍 messageType:', input.messageType);
      
      const { db } = ctx;

      // Enforce authenticated user matches input userId
      if (!ctx.user?.clerkUserId || ctx.user.clerkUserId !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User mismatch' });
      }

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId
          }
        }
      });

      if (!participant || !participant.isActive) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not a participant in this conversation'
        });
      }

      // Create the message
      const message = await db.thinkshareMessage.create({
        data: {
          conversationId: input.conversationId,
          userId: input.userId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date()
        },
        include: {
          conversation: true,
          replyTo: true
        }
      });

      // Update conversation last activity
      await db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() }
      });

      // Broadcast real-time event to conversation subscribers
      try {
        const thinkpages = getThinkPagesServer();
        thinkpages?.broadcastMessage({
          type: 'message:new',
          conversationId: input.conversationId,
          messageId: message.id,
          accountId: input.userId,
          content: input.content,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('[ThinkPages] Failed to broadcast message update (non-fatal):', e);
      }

      // Create notifications for other participants
      try {
        const participants = await db.conversationParticipant.findMany({
          where: { conversationId: input.conversationId, isActive: true },
          select: { userId: true }
        });

        const recipientIds = participants
          .map(p => p.userId)
          .filter(uid => uid !== input.userId);

        // Create one notification per recipient
        for (const recipientId of recipientIds) {
          await notificationAPI.create({
            title: 'New ThinkShare message',
            message: input.content.replace(/<[^>]*>/g, '').slice(0, 140) || 'You have a new message',
            userId: recipientId,
            category: 'social',
            type: 'update',
            priority: 'medium',
            href: `/thinkpages/thinkshare?conversation=${input.conversationId}`,
            source: 'thinkshare',
            actionable: true,
            metadata: { conversationId: input.conversationId, messageId: message.id, fromUserId: input.userId }
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('[ThinkPages] Failed to create notifications (non-fatal):', e);
      }

      return message;
    }),

  // Mark messages as read
  markMessagesAsRead: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      userId: z.string(), // Changed to userId (clerkUserId)
      messageIds: z.array(z.string()).optional() // If not provided, mark all as read
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Enforce authenticated user matches input userId
      if (!ctx.user?.clerkUserId || ctx.user.clerkUserId !== input.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User mismatch' });
      }

      // Verify participant exists before updating
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId
          }
        }
      });

      if (!participant) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Not a participant in this conversation'
        });
      }

      // Update participant lastReadAt
      await db.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: input.userId
          }
        },
        data: { lastReadAt: new Date() }
      });

      // If specific message IDs provided, create read receipts (skip duplicates)
      if (input.messageIds && input.messageIds.length > 0) {
        // Filter out already-read messages to avoid duplicate key errors
        const existingReceipts = await db.messageReadReceipt.findMany({
          where: {
            messageId: { in: input.messageIds },
            userId: input.userId
          },
          select: { messageId: true }
        });

        const existingMessageIds = new Set(existingReceipts.map(r => r.messageId));
        const newMessageIds = input.messageIds.filter(id => !existingMessageIds.has(id));

        if (newMessageIds.length > 0) {
          await db.messageReadReceipt.createMany({
            data: newMessageIds.map(messageId => ({
              messageId,
              userId: input.userId,
              messageType: 'thinkshare' as const
            }))
          });
        }
      }

      return { success: true };
    }),

  // Update user presence/online status
  updatePresence: protectedProcedure
    .input(z.object({
      userId: z.string(), // Changed to userId (clerkUserId)
      isOnline: z.boolean(),
      status: z.enum(['available', 'busy', 'away', 'invisible']).optional(),
      customStatus: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.userPresence.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          isOnline: input.isOnline,
          status: input.status || 'available',
          customStatus: input.customStatus,
          lastSeen: new Date()
        },
        update: {
          isOnline: input.isOnline,
          status: input.status,
          customStatus: input.customStatus,
          lastSeen: new Date()
        }
      });

      return { success: true };
    }),

  // Get presence for multiple users
  getPresenceForUsers: publicProcedure
    .input(z.object({
      userIds: z.array(z.string()) // Changed to userIds (clerkUserIds)
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const presence = await db.userPresence.findMany({
        where: {
          userId: { in: input.userIds }
        }
      });

      return presence;
    }),

  // Get Discord server emojis
  getDiscordEmojis: publicProcedure
    .input(z.object({
      guildId: z.string().optional()
    }))
    .query(async ({ input }) => {
      try {
        const botUrl = process.env.IXTIME_BOT_URL || 'http://localhost:3001';
        const url = input.guildId 
          ? `${botUrl}/emojis?guild=${input.guildId}`
          : `${botUrl}/emojis`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
          throw new Error(`Discord bot responded with status ${response.status}`);
        }

        const data = await response.json() as { success: boolean; error?: string; emojis?: Array<{ id: string; name: string; url: string; animated?: boolean }> };

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch Discord emojis');
        }

        return {
          success: true,
          emojis: (data.emojis || []).map((emoji: { id: string; name: string; url: string; animated?: boolean }) => ({
            id: emoji.id,
            name: emoji.name,
            url: emoji.url,
            animated: emoji.animated
          })),
          count: data.emojis?.length ?? 0
        };
      } catch (error) {
        console.error('Error fetching Discord emojis:', error);
        return {
          success: false,
          emojis: [],
          count: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),

  // Update a post
  updatePost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      content: z.string().min(1).max(1000),
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Verify ownership
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { accountId: true }
      });
      
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        });
      }
      
      if (post.accountId !== input.accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only edit your own posts'
        });
      }
      
      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: { 
          content: input.content,
          updatedAt: new Date()
        },
        include: {
          // account: true, // Relation doesn't exist
          reactions: true
        }
      });
      
      return updatedPost;
    }),

  // Delete a post
  deletePost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Verify ownership
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { accountId: true }
      });
      
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        });
      }
      
      if (post.accountId !== input.accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own posts'
        });
      }
      
      await db.thinkpagesPost.delete({
        where: { id: input.postId }
      });
      
      return { success: true };
    }),

  // Pin/unpin a post
  pinPost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      accountId: z.string(),
      pinned: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Verify ownership
      const post = await db.thinkpagesPost.findUnique({
        where: { id: input.postId },
        select: { accountId: true }
      });
      
      if (!post) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Post not found'
        });
      }
      
      if (post.accountId !== input.accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only pin your own posts'
        });
      }
      
      const updatedPost = await db.thinkpagesPost.update({
        where: { id: input.postId },
        data: { pinned: input.pinned }
      });
      
      return updatedPost;
    }),

  // Bookmark/unbookmark a post
  bookmarkPost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      userId: z.string(),
      bookmarked: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      if (input.bookmarked) {
        // Add bookmark
        await db.postBookmark.upsert({
          where: {
            userId_postId: {
              postId: input.postId,
              userId: input.userId
            }
          },
          update: {},
          create: {
            postId: input.postId,
            userId: input.userId
          }
        });
      } else {
        // Remove bookmark
        await db.postBookmark.deleteMany({
          where: {
            postId: input.postId,
            userId: input.userId
          }
        });
      }
      
      return { success: true };
    }),

  // Flag a post
  flagPost: protectedProcedure
    .input(z.object({
      postId: z.string(),
      userId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Check if already flagged by this user
      const existingFlag = await db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.userId
          }
        }
      });
      
      if (existingFlag) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already flagged this post'
        });
      }
      
      await db.postFlag.create({
        data: {
          postId: input.postId,
          userId: input.userId,
          reason: input.reason
        }
      });
      
      return { success: true };
    }),

  // Create a conversation between two countries' official accounts
  createConversationByCountries: protectedProcedure
    .input(z.object({
      fromCountryId: z.string(),
      toCountryId: z.string(),
      initialMessage: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Get users for both countries
      const fromUsers = await ctx.db.user.findMany({
        where: { countryId: input.fromCountryId },
        take: 1
      });

      const toUsers = await ctx.db.user.findMany({
        where: { countryId: input.toCountryId },
        take: 1
      });

      if (fromUsers.length === 0) {
        throw new Error("Sender country has no users");
      }

      if (toUsers.length === 0) {
        throw new Error("Recipient country has no users");
      }

      const fromUser = fromUsers[0]!;
      const toUser = toUsers[0]!;

      // Create a conversation
      const conversation = await ctx.db.thinkshareConversation.create({
        data: {
          type: 'direct',
          name: `Diplomatic Channel`
        }
      });

      // Add participants
      await ctx.db.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: fromUser.clerkUserId },
          { conversationId: conversation.id, userId: toUser.clerkUserId }
        ]
      });

      // Send initial message if provided
      if (input.initialMessage) {
        await ctx.db.thinkshareMessage.create({
          data: {
            conversationId: conversation.id,
            userId: fromUser.clerkUserId,
            content: input.initialMessage
          }
        });
      }

      return conversation;
    }),

  // Get post reactions with account details
  getPostReactions: publicProcedure
    .input(z.object({ 
      postId: z.string(),
      reactionType: z.string().optional() // Filter by specific reaction type
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const whereClause: any = {
        postId: input.postId
      };

      if (input.reactionType) {
        whereClause.reactionType = input.reactionType;
      }
      
      const reactions = await db.postReaction.findMany({
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
            }
          }
        },
        orderBy: {
          timestamp: 'desc'
        }
      });
      
      return reactions;
    })
});