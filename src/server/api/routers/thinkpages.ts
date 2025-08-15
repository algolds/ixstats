import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { IxTime } from "~/lib/ixtime";
import { generateAndPostCitizenReaction } from "~/lib/auto-post-service";
import { analyzePostSentiment } from "~/lib/sentiment-analysis";
import { unsplashService } from "~/lib/unsplash-service";
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
  reactionType: z.enum(['like', 'love', 'laugh', 'angry', 'sad']),
});

const GetFeedSchema = z.object({
  countryId: z.string().optional(),
  hashtag: z.string().optional(),
  filter: z.enum(['recent', 'trending', 'hot']).default('recent'),
  limit: z.number().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

async function searchFiles(dir: string, query: string): Promise<{ path: string; name: string; }[]> {
  let results: { path: string; name: string; }[] = [];
  const list = await fs.readdir(dir, { withFileTypes: true });

  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(await searchFiles(fullPath, query));
    } else if (dirent.name.includes(query)) {
      results.push({ path: fullPath, name: dirent.name });
    }
  }

  return results;
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

  searchWiki: publicProcedure
    .input(z.object({ query: z.string(), wiki: z.enum(['iiwiki', 'ixwiki']) }))
    .mutation(async ({ input }) => {
      const { query, wiki } = input;
      // For now, we only search in the current project (ixwiki)
      // The 'iiwiki' option is a placeholder for future functionality
      const searchRoot = process.cwd(); // The root of the project

      try {
        const results = await searchFiles(path.join(searchRoot, 'public'), query);
        return results.map(file => ({ ...file, path: file.path.replace(searchRoot, '') }));
      } catch (error) {
        console.error(`Failed to search files for query "${query}" in ${wiki}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search files.',
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
    .input(z.object({ countryId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      
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
          ixTimeTimestamp: new Date(IxTime.getCurrentIxTime())
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
          { ixTimeTimestamp: 'desc' }
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
        timestamp: post.ixTimeTimestamp.toISOString()
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
        timestamp: post.ixTimeTimestamp.toISOString()
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
    })
});