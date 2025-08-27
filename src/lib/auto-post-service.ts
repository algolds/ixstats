import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { IxTime } from '~/lib/ixtime';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export async function generateAndPostCrisisEvent(crisisEventId: string) {
  const crisisEvent = await prisma.crisisEvent.findUnique({
    where: { id: crisisEventId },
  });

  if (!crisisEvent) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Crisis event not found',
    });
  }

  // Determine which account type should post based on crisis type or severity
  // For simplicity, let's say media accounts post about all crises for now.
  const accountTypeToPost = 'media'; 

  const mediaAccounts = await prisma.thinkpagesAccount.findMany({
    where: { accountType: accountTypeToPost, isActive: true },
    take: 1, // Just pick one for now
  });

  if (mediaAccounts.length === 0) {
    console.warn(`No active ${accountTypeToPost} accounts found for auto-posting crisis event ${crisisEvent.id}`);
    return null;
  }

  const postingAccount = mediaAccounts[0];
  if (!postingAccount) {
    console.warn('No posting account available');
    return null;
  }

  // Generate post content based on crisis event details
  let content = ``;
  switch (crisisEvent.type) {
    case 'natural_disaster':
      content = `BREAKING: A major natural disaster (${crisisEvent.title}) has struck, impacting ${crisisEvent.affectedCountries || 'several regions'}. Severity: ${crisisEvent.severity}.`;
      break;
    case 'political_unrest':
      content = `URGENT: Political unrest escalating in ${crisisEvent.affectedCountries || 'various nations'} following ${crisisEvent.title}. Severity: ${crisisEvent.severity}.`;
      break;
    case 'economic_crisis':
      content = `ECONOMIC ALERT: A new economic crisis (${crisisEvent.title}) is unfolding, with an estimated economic impact of ${crisisEvent.economicImpact?.toLocaleString()} affecting ${crisisEvent.affectedCountries || 'global markets'}.`;
      break;
    default:
      content = `NEWS ALERT: An event of type '${crisisEvent.type}' titled '${crisisEvent.title}' has occurred. Severity: ${crisisEvent.severity}.`;
  }

  // Ensure content is within 280 character limit
  content = content.substring(0, 280);

  // Create the post
  const newPost = await prisma.thinkpagesPost.create({
    data: {
      accountId: postingAccount.id,
      content: content,
      postType: 'original',
      visibility: 'public',
      ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
    },
  });

  // Increment post count for the account
  await prisma.thinkpagesAccount.update({
    where: { id: postingAccount.id },
    data: { postCount: { increment: 1 } },
  });

  console.log(`Auto-posted crisis event ${crisisEvent.id} from ${postingAccount.username}`);
  return newPost;
}

export async function detectEconomicMilestoneAndTriggerNarrative() {
  const currentIxTime = IxTime.getCurrentIxTime();
  const oneMonthAgo = new Date(currentIxTime).setMonth(new Date(currentIxTime).getMonth() - 1);

  // Find countries with significant GDP growth in the last month
  const countriesWithGrowth = await prisma.country.findMany({
    where: {
      updatedAt: {
        gte: new Date(oneMonthAgo),
      },
      adjustedGdpGrowth: {
        gte: 0.03, // 3% or more GDP growth
      },
    },
    select: {
      id: true,
      name: true,
      adjustedGdpGrowth: true,
    },
  });

  for (const country of countriesWithGrowth) {
    // Trigger government announcement
    const governmentAccounts = await prisma.thinkpagesAccount.findMany({
      where: { accountType: 'government', countryId: country.id, isActive: true },
      take: 1,
    });

    if (governmentAccounts.length > 0) {
      const governmentAccount = governmentAccounts[0];
      if (!governmentAccount) {
        console.warn(`Government account not found for country ${country.name}`);
        continue;
      }
      
      const content = `EXCELLENT NEWS: Our nation, ${country.name}, has achieved a remarkable ${(country.adjustedGdpGrowth * 100).toFixed(1)}% GDP growth! This reflects our strong economic policies and the hard work of our citizens. #EconomicGrowth #${country.name.replace(/\s/g, '')}`;

      const newGovernmentPost = await prisma.thinkpagesPost.create({
        data: {
          accountId: governmentAccount.id,
          content: content.substring(0, 280),
          postType: 'original',
          visibility: 'public',
          hashtags: JSON.stringify(['EconomicGrowth', country.name.replace(/\s/g, '')]),
          ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
        },
      });

      await prisma.thinkpagesAccount.update({
        where: { id: governmentAccount.id },
        data: { postCount: { increment: 1 } },
      });

      console.log(`Auto-posted government announcement for ${country.name}`);

      // Trigger media response after a short delay (simulating narrative weaving)
      setTimeout(() => {
        generateAndPostMediaResponse(newGovernmentPost.id, country.name);
      }, 5000); // 5 seconds delay
    }
  }
}

export async function generateAndPostMediaResponse(parentPostId: string, countryName: string) {
  const parentPost = await prisma.thinkpagesPost.findUnique({
    where: { id: parentPostId },
    include: { account: true },
  });

  if (!parentPost) {
    console.warn(`Parent post ${parentPostId} not found for media response.`);
    return null;
  }

  const mediaAccounts = await prisma.thinkpagesAccount.findMany({
    where: { accountType: 'media', isActive: true },
    take: 1,
  });

  if (mediaAccounts.length === 0) {
    console.warn(`No active media accounts found for auto-posting media response.`);
    return null;
  }

  const postingAccount = mediaAccounts[0];
  if (!postingAccount) {
    console.warn('No posting account available for media response');
    return null;
  }

  const content = `ANALYSIS: ${parentPost.account?.displayName || 'Government'}'s claim of ${countryName} GDP growth is significant. While positive, questions remain about long-term sustainability and equitable distribution. #Economy #${countryName.replace(/\s/g, '')}`;

  const newMediaPost = await prisma.thinkpagesPost.create({
    data: {
      accountId: postingAccount.id,
      content: content.substring(0, 280),
      postType: 'reply', // It's a reply to the government post
      parentPostId: parentPost.id,
      visibility: 'public',
      hashtags: JSON.stringify(['Economy', countryName.replace(/\s/g, '')]),
      ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()),
    },
  });

  await prisma.thinkpagesAccount.update({
    where: { id: postingAccount.id },
    data: { postCount: { increment: 1 } },
  });

  // Update parent post's reply count
  await prisma.thinkpagesPost.update({
    where: { id: parentPost.id },
    data: { replyCount: { increment: 1 } },
  });

  console.log(`Auto-posted media response to ${parentPost.id} from ${postingAccount.username}`);
  return newMediaPost;
}

export async function generateAndPostCitizenReaction(postId: string) {
  const postToReactTo = await prisma.thinkpagesPost.findUnique({
    where: { id: postId },
  });

  if (!postToReactTo) {
    console.warn(`Post ${postId} not found for citizen reaction.`);
    return null;
  }

  const citizenAccounts = await prisma.thinkpagesAccount.findMany({
    where: { accountType: 'citizen', isActive: true },
    take: 5, // Get a few citizen accounts
  });

  if (citizenAccounts.length === 0) {
    console.warn(`No active citizen accounts found for auto-posting reactions.`);
    return null;
  }

  const reactionTypes = ['like', 'laugh', 'angry', 'thumbsup', 'thumbsdown'];
  const randomReactionType = reactionTypes[crypto.randomInt(reactionTypes.length)];
  const randomCitizenAccount = citizenAccounts[crypto.randomInt(citizenAccounts.length)];
  
  if (!randomCitizenAccount || !randomReactionType) {
    console.warn('No random citizen account or reaction type available');
    return null;
  }

  // Check if this account already reacted to this post
  const existingReaction = await prisma.postReaction.findUnique({
    where: {
      postId_accountId: {
        postId: postId,
        accountId: randomCitizenAccount.id,
      },
    },
  });

  if (existingReaction) {
    // If already reacted, update the reaction type
    await prisma.postReaction.update({
      where: {
        postId_accountId: {
          postId: postId,
          accountId: randomCitizenAccount.id,
        },
      },
      data: { reactionType: randomReactionType },
    });
    console.log(`Citizen account ${randomCitizenAccount.username} updated reaction to ${randomReactionType} on post ${postId}`);
  } else {
    // Otherwise, create a new reaction
    await prisma.postReaction.create({
      data: {
        postId: postId,
        accountId: randomCitizenAccount.id,
        reactionType: randomReactionType,
        timestamp: new Date(IxTime.getCurrentIxTime()),
      },
    });
    console.log(`Citizen account ${randomCitizenAccount.username} reacted with ${randomReactionType} to post ${postId}`);
  }

  // Update reaction counts on the post
  const updatedPost = await prisma.thinkpagesPost.findUnique({
    where: { id: postId },
    select: { reactions: true },
  });

  if (updatedPost) {
    const reactionCounts: Record<string, number> = {};
    updatedPost.reactions.forEach(reaction => {
      reactionCounts[reaction.reactionType] = (reactionCounts[reaction.reactionType] || 0) + 1;
    });

    await prisma.thinkpagesPost.update({
      where: { id: postId },
      data: { reactionCounts: JSON.stringify(reactionCounts) },
    });
  }

  return { success: true };
}
