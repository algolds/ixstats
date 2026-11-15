import { createPrismaClient } from "~/server/prisma-client";

const db = createPrismaClient();

async function resetEngagementData() {
  try {
    console.log("🧹 Resetting all fake engagement data to zero...");

    // Reset all engagement numbers to 0
    const result = await db.activityFeed.updateMany({
      data: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
      },
    });

    console.log(`✅ Successfully reset engagement data for ${result.count} activities`);

    // Show current state
    const activities = await db.activityFeed.findMany({
      select: {
        id: true,
        title: true,
        likes: true,
        comments: true,
        shares: true,
        views: true,
      },
    });

    console.log("\n📊 Current engagement state:");
    activities.forEach((activity) => {
      console.log(
        `  ${activity.title}: ${activity.likes} likes, ${activity.comments} comments, ${activity.shares} shares, ${activity.views} views`
      );
    });
  } catch (error) {
    console.error("❌ Error resetting engagement data:", error);
  } finally {
    await db.$disconnect();
  }
}

resetEngagementData();
