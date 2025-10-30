// Script to set admin role for system owners
import { db } from "../src/server/db";
import { SYSTEM_OWNER_IDS } from "../src/lib/system-owner-constants";

async function setAdminRole() {
  try {
    // Use centralized system owner IDs
    const SYSTEM_OWNERS = SYSTEM_OWNER_IDS;

    // First, ensure the owner role exists with level 0
    let ownerRole = await db.role.findFirst({
      where: { name: "owner" },
    });

    if (!ownerRole) {
      console.log("Owner role not found, creating...");
      ownerRole = await db.role.create({
        data: {
          name: "owner",
          displayName: "System Owner",
          description: "System owner with unrestricted access to all functions",
          level: 0,
          isSystem: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Created owner role with ID: ${ownerRole.id}, level: 0`);
    } else {
      // Ensure owner role has level 0
      if (ownerRole.level !== 0) {
        ownerRole = await db.role.update({
          where: { id: ownerRole.id },
          data: { level: 0, isSystem: true },
        });
        console.log(`✅ Updated owner role to level 0`);
      } else {
        console.log(`✅ Found owner role with ID: ${ownerRole.id}, level: ${ownerRole.level}`);
      }
    }

    // Update all system owner users to have owner role
    for (const clerkUserId of SYSTEM_OWNERS) {
      const user = await db.user.findUnique({
        where: { clerkUserId },
        include: { role: true },
      });

      if (!user) {
        console.log(`⚠️  User ${clerkUserId} not found in database (may not have logged in yet)`);
        continue;
      }

      if (user.roleId === ownerRole.id) {
        console.log(`✅ User ${clerkUserId} already has owner role (level 0)`);
        continue;
      }

      await db.user.update({
        where: { clerkUserId },
        data: { roleId: ownerRole.id },
      });

      console.log(
        `✅ Updated user ${clerkUserId} from role "${user.role?.name || "none"}" (level ${user.role?.level ?? "N/A"}) to "owner" (level 0)`
      );
    }

    console.log("\n✅ System owner role setup complete!");
  } catch (error) {
    console.error("❌ Error setting owner role:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

setAdminRole();
