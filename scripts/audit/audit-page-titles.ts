#!/usr/bin/env tsx
/**
 * Audit and update page titles across the application
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PageInfo {
  path: string;
  relativePath: string;
  hasMetadata: boolean;
  hasTitle: boolean;
  currentTitle: string | null;
  suggestedTitle: string;
  needsUpdate: boolean;
}

const TITLE_MAPPINGS: Record<string, string> = {
  "/page.tsx": "IxStats - Global Economic Simulation Platform",
  "/dashboard/page.tsx": "Dashboard - IxStats",
  "/dashboard/new/page.tsx": "New Dashboard - IxStats",
  "/mycountry/page.tsx": "MyCountry - Executive Dashboard",
  "/mycountry/editor/page.tsx": "Country Editor - MyCountry",
  "/mycountry/intelligence/page.tsx": "Intelligence Briefing - MyCountry",
  "/mycountry/defense/page.tsx": "Defense & Security - MyCountry",
  "/countries/page.tsx": "Countries - IxStats",
  "/countries/new/page.tsx": "Create Country - IxStats",
  "/countries/[slug]/page.tsx": "Country Profile - IxStats",
  "/countries/[slug]/profile/page.tsx": "Country Profile - IxStats",
  "/countries/[slug]/modeling/page.tsx": "Economic Modeling - IxStats",
  "/builder/page.tsx": "Country Builder - IxStats",
  "/builder/import/page.tsx": "Import from IxWiki - Country Builder",
  "/eci/page.tsx": "Executive Command Interface - IxStats",
  "/eci/focus/page.tsx": "Focus Areas - ECI",
  "/sdi/page.tsx": "Strategic Defense Interface - IxStats",
  "/sdi/intelligence/page.tsx": "Intelligence - SDI",
  "/sdi/economic/page.tsx": "Economic Intelligence - SDI",
  "/sdi/diplomatic/page.tsx": "Diplomatic Intelligence - SDI",
  "/sdi/crisis/page.tsx": "Crisis Management - SDI",
  "/sdi/communications/page.tsx": "Communications - SDI",
  "/thinkpages/page.tsx": "ThinkPages - Social Platform",
  "/thinkpages/feed/page.tsx": "Feed - ThinkPages",
  "/thinkpages/thinkshare/page.tsx": "ThinkShare - Messaging",
  "/thinkpages/thinktanks/page.tsx": "ThinkTanks - Collaboration",
  "/explore/page.tsx": "Explore - IxStats",
  "/profile/page.tsx": "User Profile - IxStats",
  "/achievements/page.tsx": "Achievements - IxStats",
  "/leaderboards/page.tsx": "Leaderboards - IxStats",
  "/admin/page.tsx": "Admin Dashboard - IxStats",
  "/admin/membership/page.tsx": "Membership Management - Admin",
  "/dm-dashboard/page.tsx": "DM Dashboard - IxStats",
  "/setup/page.tsx": "Setup - IxStats",
  "/sign-in/[[...rest]]/page.tsx": "Sign In - IxStats",
  "/sign-up/[[...rest]]/page.tsx": "Sign Up - IxStats",
  "/wiki/page.tsx": "Wiki Integration - IxStats",
  "/help/page.tsx": "Help Center - IxStats",
  "/help/getting-started/welcome/page.tsx": "Welcome - Help Center",
  "/help/getting-started/ixtime/page.tsx": "IxTime System - Help Center",
  "/help/defense/overview/page.tsx": "Defense Overview - Help Center",
  "/help/economy/tiers/page.tsx": "Economic Tiers - Help Center",
  "/hashtags/[tag]/page.tsx": "Tag - ThinkPages",
  "/test-user-creation/page.tsx": "Test User Creation - Dev",
  "/test-favorites/page.tsx": "Test Favorites - Dev",
};

function extractMetadata(content: string): {
  hasMetadata: boolean;
  hasTitle: boolean;
  currentTitle: string | null;
} {
  // Check for metadata export
  const metadataRegex = /export\s+const\s+metadata\s*[:=]\s*\{([^}]+)\}/s;
  const metadataMatch = content.match(metadataRegex);

  if (metadataMatch) {
    const titleRegex = /title\s*:\s*['"`]([^'"`]+)['"`]/;
    const titleMatch = metadataMatch[1].match(titleRegex);
    return {
      hasMetadata: true,
      hasTitle: !!titleMatch,
      currentTitle: titleMatch ? titleMatch[1] : null,
    };
  }

  // Check for generateMetadata function
  const generateMetadataRegex = /export\s+async\s+function\s+generateMetadata/;
  if (generateMetadataRegex.test(content)) {
    return {
      hasMetadata: true,
      hasTitle: true,
      currentTitle: "(dynamic)",
    };
  }

  return {
    hasMetadata: false,
    hasTitle: false,
    currentTitle: null,
  };
}

function auditPages(): PageInfo[] {
  const results: PageInfo[] = [];
  const rootDir = join(__dirname, "..", "src", "app");

  function scanDirectory(dir: string) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry === "page.tsx") {
        const content = readFileSync(fullPath, "utf-8");
        const relativePath = relative(join(__dirname, "..", "src", "app"), fullPath);
        const routePath = "/" + relativePath.replace(/\\/g, "/").replace("/page.tsx", "");

        const metadata = extractMetadata(content);
        const suggestedTitle =
          TITLE_MAPPINGS[routePath] || `${entry.replace(".tsx", "")} - IxStats`;

        results.push({
          path: fullPath,
          relativePath: routePath,
          ...metadata,
          suggestedTitle,
          needsUpdate:
            !metadata.hasTitle ||
            (metadata.currentTitle !== suggestedTitle && metadata.currentTitle !== "(dynamic)"),
        });
      }
    }
  }

  scanDirectory(rootDir);
  return results;
}

function generateReport(pages: PageInfo[]) {
  console.log("\n=== Page Title Audit ===\n");

  const withTitle = pages.filter((p) => p.hasTitle);
  const withoutTitle = pages.filter((p) => !p.hasTitle);
  const needsUpdate = pages.filter((p) => p.needsUpdate);

  console.log(`Total pages: ${pages.length}`);
  console.log(
    `With titles: ${withTitle.length} (${Math.round((withTitle.length / pages.length) * 100)}%)`
  );
  console.log(`Without titles: ${withoutTitle.length}`);
  console.log(`Need updates: ${needsUpdate.length}\n`);

  if (withoutTitle.length > 0) {
    console.log("❌ Pages missing titles:\n");
    for (const page of withoutTitle) {
      console.log(`   ${page.relativePath}`);
      console.log(`   Suggested: "${page.suggestedTitle}"\n`);
    }
  }

  if (needsUpdate.length > 0 && needsUpdate.length !== withoutTitle.length) {
    console.log("\n⚠️  Pages with incorrect titles:\n");
    for (const page of needsUpdate.filter((p) => p.hasTitle && p.currentTitle !== "(dynamic)")) {
      console.log(`   ${page.relativePath}`);
      console.log(`   Current: "${page.currentTitle}"`);
      console.log(`   Suggested: "${page.suggestedTitle}"\n`);
    }
  }

  console.log("\n=== Summary ===");
  if (needsUpdate.length === 0) {
    console.log("✅ All pages have correct titles!");
  } else {
    console.log(`⚠️  ${needsUpdate.length} pages need title updates`);
  }
}

// Run audit
const pages = auditPages();
generateReport(pages);
