import { clerkClient } from "@clerk/nextjs/server";

async function main() {
  const clerkUserId = process.argv[2];
  const role = process.argv[3] || "owner";

  if (!clerkUserId) {
    console.error("Usage: bun scripts/set-clerk-role.ts <clerkUserId> [role]");
    process.exit(1);
  }

  try {
    const client = await clerkClient();
    console.log(`Setting Clerk user metadata role to "${role}" for user "${clerkUserId}"...`);
    
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        role,
      },
    });

    console.log("✅ Clerk user metadata updated successfully!");
  } catch (error) {
    console.error("❌ Failed to update Clerk metadata:", error);
    process.exit(1);
  }
}

main();
