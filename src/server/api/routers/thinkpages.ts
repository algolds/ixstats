import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { generateAndPostCitizenReaction } from "~/lib/auto-post-service";
import { analyzePostSentiment } from "~/lib/sentiment-analysis";
import { unsplashService } from "~/lib/unsplash-service";
import { searchWiki as wikiSearchService } from "~/lib/wiki-search-service"; // Import the wiki search service
import fs from "fs/promises";
import path from "path";

const SearchUnsplashImagesSchema = z.object({
  query: z.string().min(1),
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(30).default(10),
  orientation: z.enum(['landscape', 'portrait', 'squarish']).optional(),
  color: z.string().optional(), // Unsplash API supports specific color names or hex codes
});

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
  accountId: z.string(),
  content: z.string().min(1).max(280),
  hashtags: z.array(z.string()).optional(),
  mentions: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private', 'unlisted']).default('public'),
  parentPostId: z.string().optional(), // For replies
  repostOfId: z.string().optional(), // For reposts
});

const AddReactionSchema = z.object({
  postId: z.string(),
  accountId: z.string(),
  reactionType: z.enum(['like', 'laugh', 'angry', 'sad', 'fire', 'thumbsup', 'thumbsdown']),
});

const GetFeedSchema = z.object({
  countryId: z.string().optional(),
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
      'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) Wikimedia-Commons-Search',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch image info for ${title}: ${response.statusText}`);
    return null;
  }

  const data = await response.json();
  const page = data.query?.pages?.[0];

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
            'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) Wikimedia-Commons-Search',
          },
        });

        if (!response.ok) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Wikimedia Commons API responded with status ${response.status}`,
          });
        }

        const data = await response.json();
        const searchResults = data.query?.search || [];

        const images = await Promise.all(searchResults.map(async (result: any) => {
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
    .input(z.object({ query: z.string(), wiki: z.enum(['iiwiki', 'ixwiki']) }))
    .mutation(async ({ input }) => {
      const { query, wiki } = input;
      try {
        const results = await wikiSearchService(query, wiki);
        return results;
      } catch (error) {
        console.error(`Failed to search wiki images for query "${query}" in ${wiki}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search ${wiki} images: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  // Search accounts
  searchAccounts: publicProcedure
    .input(z.object({
      query: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const accounts = await db.thinkpagesAccount.findMany({
        where: {
          OR: [
            {
              username: {
                contains: input.query,
              },
            },
            {
              displayName: {
                contains: input.query,
              },
            },
          ],
        },
        take: 5,
      });

      return accounts;
    }),

  // Update account
  updateAccount: publicProcedure
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
  // Check username availability
  checkUsernameAvailability: publicProcedure
    .input(z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { username: input.username },
      });
      return { isAvailable: !existingAccount };
    }),

  // Generate random profile picture
  generateProfilePicture: publicProcedure
    .mutation(async () => {
      const placeholderImages = [
        "https://via.placeholder.com/150/FF0000/FFFFFF?text=User1",
        "https://via.placeholder.com/150/0000FF/FFFFFF?text=User2",
        "https://via.placeholder.com/150/00FF00/FFFFFF?text=User3",
        "https://via.placeholder.com/150/FFFF00/000000?text=User4",
        "https://via.placeholder.com/150/FF00FF/FFFFFF?text=User5",
      ];
      const randomIndex = Math.floor(Math.random() * placeholderImages.length);
      return { imageUrl: placeholderImages[randomIndex] };
    }),

  // Account management
  createAccount: publicProcedure
    .input(CreateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Check if username is already taken
      const existingAccount = await db.thinkpagesAccount.findUnique({
        where: { username: input.username }
      });
      
      if (existingAccount) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username is already taken'
        });
      }
      
      // Check if country exists
      const country = await db.country.findUnique({
        where: { id: input.countryId }
      });
      
      if (!country) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Country not found'
        });
      }
      
      // Count existing accounts for this country
      const accountCount = await db.thinkpagesAccount.count({
        where: { countryId: input.countryId }
      });
      
      if (accountCount >= 25) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Maximum account limit (25) reached for this country'
        });
      }

      // Define max accounts per type
      const MAX_ACCOUNTS_PER_TYPE = {
        government: 5,
        media: 10,
        citizen: 17,
      };

      const currentAccountTypeCount = await db.thinkpagesAccount.count({
        where: {
          countryId: input.countryId,
          accountType: input.accountType,
        },
      });

      const maxForType = MAX_ACCOUNTS_PER_TYPE[input.accountType];

      if (currentAccountTypeCount >= maxForType) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum ${input.accountType} account limit (${maxForType}) reached for this country`,
        });
      }
      
      // Create the account
      const account = await db.thinkpagesAccount.create({
        data: {
          countryId: input.countryId,
          accountType: input.accountType,
          username: input.username,
          displayName: `${input.firstName} ${input.lastName}`,
          firstName: input.firstName,
          lastName: input.lastName,
          bio: input.bio,
          verified: input.verified,
          postingFrequency: input.postingFrequency,
          politicalLean: input.politicalLean,
          personality: input.personality,
          profileImageUrl: input.profileImageUrl
        }
      });
      
      return account;
    }),

  // Get accounts by country
  getAccountsByCountry: publicProcedure
    .input(z.object({ countryId: z.string().optional().default('') }).default({ countryId: '' }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Early return for invalid country ID
      if (!input || !input.countryId || input.countryId.trim() === '' || input.countryId === 'INVALID') {
        return [];
      }
      
      const accounts = await db.thinkpagesAccount.findMany({
        where: { 
          countryId: input.countryId,
          isActive: true
        },
        orderBy: [
          { accountType: 'asc' },
          { createdAt: 'desc' }
        ]
      });
      
      return accounts;
    }),

  // Get account counts by type for a country
  getAccountCountsByType: publicProcedure
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const counts = await db.thinkpagesAccount.groupBy({
        by: ['accountType'],
        where: {
          countryId: input.countryId,
          isActive: true,
        },
        _count: {
          id: true,
        },
      });

      const result: Record<string, number> = {};
      counts.forEach(c => {
        result[c.accountType] = c._count.id;
      });

      return result;
    }),

  // Post creation
  createPost: publicProcedure
    .input(CreatePostSchema)
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Verify account exists and is active
      const account = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId }
      });
      
      if (!account || !account.isActive) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Account not found or inactive'
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
          postType,
          parentPostId: input.parentPostId,
          repostOfId: input.repostOfId,
          visibility: input.visibility,
          ixTimeTimestamp: new Date() // Store real-world time for social media timestamps
        },
        include: {
          account: true,
          parentPost: {
            include: { account: true }
          },
          repostOf: {
            include: { account: true }
          }
        }
      });
      
      // Update account post count
      await db.thinkpagesAccount.update({
        where: { id: input.accountId },
        data: { postCount: { increment: 1 } }
      });
      
      // Create mentions if any
      if (input.mentions && input.mentions.length > 0) {
        const mentionedAccounts = await db.thinkpagesAccount.findMany({
          where: {
            username: {
              in: input.mentions.map(m => m.replace('@', '')) // Remove @ for lookup
            }
          },
          select: { id: true, username: true }
        });

        const mentionData = mentionedAccounts.map(account => ({
          postId: post.id,
          mentionedAccountId: account.id,
          position: input.content.indexOf(`@${account.username}`)
        }));

        if (mentionData.length > 0) {
          await db.postMention.createMany({
            data: mentionData
          });
        }
      }
      
      return post;
    }),

  // Add reaction to post
  addReaction: publicProcedure
    .input(AddReactionSchema)
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

        return reaction;
      }
    }),

  // Remove reaction
  removeReaction: publicProcedure
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
      if (input.countryId) {
        whereClause.account = {
          countryId: input.countryId
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
          account: true,
          parentPost: {
            include: { account: true }
          },
          repostOf: {
            include: { account: true }
          },
          reactions: true,
          _count: {
            select: {
              reactions: true,
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
        reactionCounts: post.reactions.reduce((acc, reaction) => {
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
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
      const account = await db.thinkpagesAccount.findUnique({
        where: { id: input.accountId },
        include: {
          country: true,
          _count: {
            select: {
              posts: true,
              reactions: true
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

      const account = await db.thinkpagesAccount.findFirst({
        where: { country: { user: { clerkUserId: input.clerkUserId } } },
        include: {
          country: true,
          _count: {
            select: {
              posts: true,
              reactions: true
            }
          }
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
          account: true,
          parentPost: {
            include: { account: true }
          },
          repostOf: {
            include: { account: true }
          },
          replies: {
            include: {
              account: true,
              reactions: true
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
        const citizenAccounts = await db.thinkpagesAccount.findMany({
          where: {
            countryId: country.id,
            accountType: 'citizen',
            isActive: true,
          },
          select: { id: true },
        });

        if (citizenAccounts.length === 0) {
          console.log(`No citizen accounts for ${country.name}, skipping mood metric calculation.`);
          continue;
        }

        const citizenAccountIds = citizenAccounts.map((acc) => acc.id);

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
  createThinktank: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      avatar: z.string().url().optional(),
      type: z.enum(['public', 'private', 'invite_only']).default('public'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      createdBy: z.string(), // accountId
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Verify the creator account exists
      const creatorAccount = await db.thinkpagesAccount.findUnique({
        where: { id: input.createdBy }
      });

      if (!creatorAccount) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Creator account not found'
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
          creator: true,
          members: {
            include: { account: true }
          }
        }
      });

      // Add creator as owner
      await db.thinktankMember.create({
        data: {
          groupId: group.id,
          accountId: input.createdBy,
          role: 'owner'
        }
      });

      return group;
    }),

  // Get ThinkTanks for a country
  getThinktanksByCountry: publicProcedure
    .input(z.object({
      countryId: z.string().optional().default(''),
      type: z.enum(['all', 'joined', 'created']).optional().default('all'),
      accountId: z.string().optional()
    }).optional().default(() => ({ countryId: '', type: 'all' as const })))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      try {
        // FAILSAFE: Handle ANY invalid input scenario
        if (!input) {
          console.log('getThinktanksByCountry: No input provided, returning empty array');
          return [];
        }
        
        if (!input.countryId || input.countryId.trim() === '' || input.countryId === 'INVALID') {
          console.log('getThinktanksByCountry: Invalid countryId, returning empty array');
          return [];
        }

        let whereClause: any = {
          isActive: true
        };

        if (input.type === 'joined' && input.accountId) {
          whereClause.members = {
            some: {
              accountId: input.accountId,
              isActive: true
            }
          };
        } else if (input.type === 'created' && input.accountId) {
          whereClause.createdBy = input.accountId;
        }

        const groups = await db.thinktankGroup.findMany({
          where: whereClause,
          include: {
            creator: true,
            members: {
              where: { isActive: true },
              include: { account: true }
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
          isJoined: input.accountId ? group.members.some(m => m.accountId === input.accountId) : false
        }));
      } catch (error) {
        console.error('Error in getThinktanksByCountry:', error);
        // FAILSAFE: Return empty array instead of throwing error
        return [];
      }
    }),

  // Join a ThinkTank group
  joinThinktank: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountId: z.string()
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

      // Check if user is already a member
      const existingMember = await db.thinktankMember.findUnique({
        where: {
          groupId_accountId: {
            groupId: input.groupId,
            accountId: input.accountId
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
            accountId: input.accountId,
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
  leaveThinktank: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const member = await db.thinktankMember.findUnique({
        where: {
          groupId_accountId: {
            groupId: input.groupId,
            accountId: input.accountId
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
            accountId: { not: input.accountId },
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
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const messages = await db.thinktankMessage.findMany({
        where: {
          groupId: input.groupId,
          deletedAt: null
        },
        include: {
          account: true,
          replyTo: {
            include: { account: true }
          },
          readReceipts: {
            include: { account: true }
          },
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
  sendThinktankMessage: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountId: z.string(),
      content: z.string().min(1),
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
          groupId_accountId: {
            groupId: input.groupId,
            accountId: input.accountId
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
          accountId: input.accountId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date() // Store real-world time for social media timestamps // Keep IxTime for reference
        },
        include: {
          account: true,
          replyTo: {
            include: { account: true }
          }
        }
      });

      return message;
    }),

  // Update a ThinkTank group
  updateThinktank: publicProcedure
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

  deleteThinktank: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      // Add logic to check if user is owner/admin
      await db.thinktankGroup.delete({
        where: { id: input.groupId },
      });
      return { success: true };
    }),

  updateMemberRole: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountId: z.string(),
      role: z.enum(['admin', 'member']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.thinktankMember.update({
        where: {
          groupId_accountId: {
            groupId: input.groupId,
            accountId: input.accountId,
          },
        },
        data: { role: input.role },
      });
      return { success: true };
    }),

  removeMemberFromThinktank: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      await db.thinktankMember.delete({
        where: {
          groupId_accountId: {
            groupId: input.groupId,
            accountId: input.accountId,
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
  inviteToThinktank: publicProcedure
    .input(z.object({
      groupId: z.string(),
      accountIds: z.array(z.string()),
      invitedBy: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const invites = await db.thinktankInvite.createMany({
        data: input.accountIds.map(accountId => ({
          groupId: input.groupId,
          invitedUser: accountId,
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
      const documents = await db.collaborativeDoc.findMany({
        where: { groupId: input.groupId },
        include: { creator: true, lastEditor: true },
        orderBy: { updatedAt: 'desc' },
      });
      return documents;
    }),

  // Create a collaborative document
  createThinktankDocument: publicProcedure
    .input(z.object({
      groupId: z.string(),
      title: z.string().min(1),
      createdBy: z.string(), // accountId
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const document = await db.collaborativeDoc.create({
        data: {
          groupId: input.groupId,
          title: input.title,
          createdBy: input.createdBy,
          lastEditBy: input.createdBy,
        },
      });
      return document;
    }),

  // Add reaction to a Thinkshare message
  addReactionToMessage: publicProcedure
    .input(z.object({
      messageId: z.string(),
      accountId: z.string(),
      reaction: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      const { messageId, accountId, reaction } = input;

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
  removeReactionFromMessage: publicProcedure
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
  editMessage: publicProcedure
    .input(z.object({
      messageId: z.string(),
      content: z.string().min(1),
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
  deleteMessage: publicProcedure
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
  createConversation: publicProcedure
    .input(z.object({
      participantIds: z.array(z.string().min(1))
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
      
      // Verify all participants exist
      const accounts = await db.thinkpagesAccount.findMany({
        where: { id: { in: uniqueParticipantIds } }
      });

      if (accounts.length !== uniqueParticipantIds.length) {
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
                accountId: participantId,
                isActive: true
              }
            }
          })),
          participants: {
            none: {
              accountId: {
                notIn: uniqueParticipantIds
              },
              isActive: true
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true },
            include: { account: true }
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
              data: uniqueParticipantIds.map(accountId => ({
                accountId,
                role: 'participant'
              }))
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true },
            include: { account: true }
          }
        }
      });

      return conversation;
    }),

  // Get conversations for an account
  getConversations: publicProcedure
    .input(z.object({
      accountId: z.string().optional().default(''),
      limit: z.number().min(1).max(50).optional().default(20),
      cursor: z.string().optional()
    }).optional().default(() => ({ accountId: '', limit: 20 })))
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
        
        if (!input.accountId || input.accountId.trim() === '' || input.accountId === 'INVALID') {
          console.log('getConversations: Invalid accountId, returning empty result');
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
              accountId: input.accountId,
              isActive: true
            }
          }
        },
        include: {
          participants: {
            where: { isActive: true },
            include: { account: true }
          },
          messages: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 1,
            include: { account: true }
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

      return {
        conversations: conversations.map(conv => {
          const otherParticipants = conv.participants.filter(p => p.accountId !== input.accountId);
          const lastMessage = conv.messages[0];
          
          // Calculate unread count
          const participant = conv.participants.find(p => p.accountId === input.accountId);
          
          return {
            ...conv,
            otherParticipants,
            lastMessage,
            lastReadAt: participant?.lastReadAt,
            unreadCount: 0 // Will be calculated based on lastReadAt vs message timestamps
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
      conversationId: z.string().default(''),
      accountId: z.string().default(''),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional()
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      // Early return for invalid IDs
      if (!input.conversationId || input.conversationId.trim() === '' || input.conversationId === 'INVALID' ||
          !input.accountId || input.accountId.trim() === '' || input.accountId === 'INVALID') {
        return {
          messages: [],
          nextCursor: null
        };
      }

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_accountId: {
            conversationId: input.conversationId,
            accountId: input.accountId
          }
        }
      });

      if (!participant || !participant.isActive) {
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
          account: true,
          replyTo: {
            include: { account: true }
          },
          readReceipts: {
            include: { account: true }
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

  // Send message to conversation
  sendMessage: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      accountId: z.string(),
      content: z.string().min(1),
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

      // Verify user is participant
      const participant = await db.conversationParticipant.findUnique({
        where: {
          conversationId_accountId: {
            conversationId: input.conversationId,
            accountId: input.accountId
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
          accountId: input.accountId,
          content: input.content,
          messageType: input.messageType,
          replyToId: input.replyToId,
          mentions: input.mentions ? JSON.stringify(input.mentions) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          ixTimeTimestamp: new Date() // Store real-world time for social media timestamps // Keep IxTime for reference
        },
        include: {
          account: true,
          conversation: true,
          replyTo: {
            include: { account: true }
          }
        }
      });

      // Update conversation last activity
      await db.thinkshareConversation.update({
        where: { id: input.conversationId },
        data: { lastActivity: new Date() }
      });

      return message;
    }),

  // Mark messages as read
  markMessagesAsRead: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      accountId: z.string(),
      messageIds: z.array(z.string()).optional() // If not provided, mark all as read
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      // Update participant lastReadAt
      await db.conversationParticipant.update({
        where: {
          conversationId_accountId: {
            conversationId: input.conversationId,
            accountId: input.accountId
          }
        },
        data: { lastReadAt: new Date() }
      });

      // If specific message IDs provided, create read receipts
      if (input.messageIds && input.messageIds.length > 0) {
        await db.messageReadReceipt.createMany({
          data: input.messageIds.map(messageId => ({
            messageId,
            accountId: input.accountId,
            messageType: 'thinkshare'
          })),
        });
      }

      return { success: true };
    }),

  // Update account presence/online status
  updatePresence: publicProcedure
    .input(z.object({
      accountId: z.string(),
      isOnline: z.boolean(),
      status: z.enum(['available', 'busy', 'away', 'invisible']).optional(),
      customStatus: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      await db.accountPresence.upsert({
        where: { accountId: input.accountId },
        create: {
          accountId: input.accountId,
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

  // Get presence for multiple accounts
  getPresenceForAccounts: publicProcedure
    .input(z.object({
      accountIds: z.array(z.string())
    }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const presence = await db.accountPresence.findMany({
        where: {
          accountId: { in: input.accountIds }
        },
        include: { account: true }
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

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch Discord emojis');
        }

        return {
          success: true,
          emojis: data.emojis.map((emoji: any) => ({
            id: emoji.id,
            name: emoji.name,
            url: emoji.url,
            animated: emoji.animated,
            guild: emoji.guild
          })),
          count: data.count
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
  updatePost: publicProcedure
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
          account: true,
          reactions: true
        }
      });
      
      return updatedPost;
    }),

  // Delete a post
  deletePost: publicProcedure
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
  pinPost: publicProcedure
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
  bookmarkPost: publicProcedure
    .input(z.object({
      postId: z.string(),
      accountId: z.string(),
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
              userId: input.accountId
            }
          },
          update: {},
          create: {
            postId: input.postId,
            userId: input.accountId
          }
        });
      } else {
        // Remove bookmark
        await db.postBookmark.deleteMany({
          where: {
            postId: input.postId,
            userId: input.accountId
          }
        });
      }
      
      return { success: true };
    }),

  // Flag a post
  flagPost: publicProcedure
    .input(z.object({
      postId: z.string(),
      accountId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;
      
      // Check if already flagged by this user
      const existingFlag = await db.postFlag.findUnique({
        where: {
          userId_postId: {
            postId: input.postId,
            userId: input.accountId
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
          userId: input.accountId,
          reason: input.reason
        }
      });
      
      return { success: true };
    })
});