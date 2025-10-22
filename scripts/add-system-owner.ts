#!/usr/bin/env tsx

/**
 * Script to add a new user ID to the system owner list
 * This will update the centralized system owner constants
 * 
 * ⚠️  DEPRECATED: This script is no longer needed since we use centralized constants.
 * Use the centralized system-owner-constants.ts file instead.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log("⚠️  DEPRECATED: This script is no longer needed!");
console.log("   All system owner IDs are now centralized in src/lib/system-owner-constants.ts");
console.log("   To add a new system owner, edit that file directly.");
console.log("");

const SYSTEM_OWNER_FILES = [
  'src/lib/system-owner-constants.ts' // Only file that needs updating now
];

async function addSystemOwner() {
  try {
    console.log("🔐 Adding User ID to System Owner List");
    console.log("=====================================");
    
    // Get user ID from command line argument
    const userId = process.argv[2];
    
    if (!userId) {
      console.log("❌ Error: Please provide a user ID");
      console.log("");
      console.log("Usage: npx tsx scripts/add-system-owner.ts <user_id>");
      console.log("");
      console.log("Example: npx tsx scripts/add-system-owner.ts user_2zqmDdZvhpNQWGLdAIj2YwH8MLo");
      console.log("");
      console.log("💡 To get your user ID:");
      console.log("1. Start the dev server: npm run dev");
      console.log("2. Sign in at http://localhost:3000");
      console.log("3. Open browser console (F12)");
      console.log("4. Type: window.Clerk.user.id");
      console.log("5. Copy the user ID that appears");
      process.exit(1);
    }

    // Validate user ID format
    if (!userId.startsWith('user_')) {
      console.log("❌ Error: User ID should start with 'user_'");
      console.log(`   Received: ${userId}`);
      process.exit(1);
    }

    console.log(`📝 Adding user ID: ${userId}`);
    console.log("");

    let filesUpdated = 0;

    // Update each file
    for (const filePath of SYSTEM_OWNER_FILES) {
      const fullPath = join(process.cwd(), filePath);
      
      try {
        let content = readFileSync(fullPath, 'utf8');
        let updated = false;

        // Look for SYSTEM_OWNERS array and add the user ID
        const systemOwnersRegex = /(const\s+SYSTEM_OWNERS?\s*=\s*\[)([\s\S]*?)(\];)/;
        const match = content.match(systemOwnersRegex);

        if (match) {
          const [, prefix, existingIds, suffix] = match;
          
          // Check if user ID already exists
          if (existingIds.includes(userId)) {
            console.log(`✅ ${filePath}: User ID already exists`);
            continue;
          }

          // Add the new user ID
          const newContent = content.replace(
            systemOwnersRegex,
            `${prefix}${existingIds.trim()}\n    '${userId}', // Added by script\n  ${suffix}`
          );

          writeFileSync(fullPath, newContent, 'utf8');
          console.log(`✅ ${filePath}: Updated`);
          updated = true;
          filesUpdated++;
        } else {
          console.log(`⚠️  ${filePath}: SYSTEM_OWNERS array not found`);
        }

      } catch (error) {
        console.log(`❌ ${filePath}: Error updating file - ${error}`);
      }
    }

    console.log("");
    console.log(`📊 Summary: Updated ${filesUpdated} files`);
    
    if (filesUpdated > 0) {
      console.log("");
      console.log("✅ System owner setup complete!");
      console.log("");
      console.log("🔄 Next steps:");
      console.log("1. Restart the development server: npm run dev");
      console.log("2. Sign in with your account");
      console.log("3. You should now have system owner access");
      console.log("");
      console.log("🔍 To verify access:");
      console.log("- Go to /admin - you should have full access");
      console.log("- Check that you can access all admin features");
    } else {
      console.log("");
      console.log("⚠️  No files were updated. Please check the file paths and try again.");
    }

  } catch (error) {
    console.error("❌ Error adding system owner:", error);
    process.exit(1);
  }
}

addSystemOwner();
