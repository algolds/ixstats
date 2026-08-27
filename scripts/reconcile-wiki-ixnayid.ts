import { MEDIAWIKI_MAPPING } from "../src/lib/wiki-os/adapters/ixstates/wiki-mappings";

async function main() {
  const isApply = process.argv.includes("--apply");
  const isSimulate = process.argv.includes("--simulate") || !isApply;

  console.log("==================================================================");
  console.log(
    `🧭 MEDIAWIKI ↔ IXNAYID RECONCILIATION ENGINE [Mode: ${isApply ? "🚀 APPLY" : "🔍 DRY RUN / SIMULATION"}]`
  );
  console.log("==================================================================");

  let users: any[] = [];
  let dbClient: any = null;

  if (isSimulate) {
    console.log("ℹ️  Running with canonical 82-nation roster simulation.");
    users = Object.values(MEDIAWIKI_MAPPING).map((m, idx) => ({
      id: `usr_sim_${idx}`,
      clerkUserId: `user_${m.primaryCountry.toLowerCase()}`,
      country: { id: `c_${idx}`, name: m.primaryCountry, slug: m.primaryCountry.toLowerCase() },
      wikiUsername: null,
    }));
  } else {
    try {
      const { db } = await import("../src/server/db");
      dbClient = db;
      users = await db.user.findMany({ include: { country: true } });
    } catch (e: any) {
      console.log("ℹ️  Database unavailable; falling back to simulation.");
      users = Object.values(MEDIAWIKI_MAPPING).map((m, idx) => ({
        id: `usr_sim_${idx}`,
        clerkUserId: `user_${m.primaryCountry.toLowerCase()}`,
        country: { id: `c_${idx}`, name: m.primaryCountry, slug: m.primaryCountry.toLowerCase() },
        wikiUsername: null,
      }));
    }
  }

  console.log(`Fetched ${users.length} users from database.\n`);

  const results: Array<{
    wikiAccount: string;
    targetCountry: string;
    matchedUser?: { id: string; clerkUserId: string; countryName?: string };
    status: "MATCHED" | "ALT_MERGED" | "UNMATCHED_USER" | "ALREADY_LINKED";
    notes?: string;
  }> = [];

  for (const [wikiName, mapping] of Object.entries(MEDIAWIKI_MAPPING)) {
    // Find candidate user whose country matches the mapping
    const matchedUser = users.find((u) => {
      if (!u.country) return false;
      const cName = (u.country.name || "").toLowerCase();
      const cSlug = (u.country.slug || "").toLowerCase();
      const target = mapping.primaryCountry.toLowerCase();
      return (
        cName === target || cSlug === target || cName.includes(target) || target.includes(cName)
      );
    });

    if (mapping.isAltFor) {
      results.push({
        wikiAccount: wikiName,
        targetCountry: mapping.primaryCountry,
        matchedUser: matchedUser
          ? {
              id: matchedUser.id,
              clerkUserId: matchedUser.clerkUserId,
              countryName: matchedUser.country?.name,
            }
          : undefined,
        status: "ALT_MERGED",
        notes: `Alt account merged into ${mapping.isAltFor} (${mapping.primaryCountry})`,
      });
      continue;
    }

    if (!matchedUser) {
      results.push({
        wikiAccount: wikiName,
        targetCountry: mapping.primaryCountry,
        status: "UNMATCHED_USER",
        notes: `No active user profile claimed for country "${mapping.primaryCountry}"`,
      });
      continue;
    }

    if (matchedUser.wikiUsername === wikiName) {
      results.push({
        wikiAccount: wikiName,
        targetCountry: mapping.primaryCountry,
        matchedUser: {
          id: matchedUser.id,
          clerkUserId: matchedUser.clerkUserId,
          countryName: matchedUser.country?.name,
        },
        status: "ALREADY_LINKED",
        notes: "Identity link already verified",
      });
      continue;
    }

    results.push({
      wikiAccount: wikiName,
      targetCountry: mapping.primaryCountry,
      matchedUser: {
        id: matchedUser.id,
        clerkUserId: matchedUser.clerkUserId,
        countryName: matchedUser.country?.name,
      },
      status: "MATCHED",
      notes: `Ready to link User ${matchedUser.clerkUserId} -> MediaWiki ${wikiName}`,
    });

    if (isApply && dbClient) {
      try {
        await dbClient.user.update({
          where: { id: matchedUser.id },
          data: {
            wikiUsername: wikiName,
            lastWikiSync: new Date(),
          },
        });
      } catch (e: any) {
        console.error(`Failed to apply link for ${wikiName}:`, e.message);
      }
    }
  }

  // Summary statistics
  const matched = results.filter((r) => r.status === "MATCHED");
  const alts = results.filter((r) => r.status === "ALT_MERGED");
  const already = results.filter((r) => r.status === "ALREADY_LINKED");
  const unmatched = results.filter((r) => r.status === "UNMATCHED_USER");

  console.log("------------------------------------------------------------------");
  console.log("📊 RECONCILIATION SUMMARY");
  console.log("------------------------------------------------------------------");
  console.log(`• Ready to Link (Matched):    ${matched.length}`);
  console.log(`• Alt Accounts Merged:        ${alts.length}`);
  console.log(`• Already Linked & Verified:  ${already.length}`);
  console.log(`• Awaiting User Registration: ${unmatched.length}`);
  console.log(`• Total Accounts Audited:     ${results.length}`);
  console.log("------------------------------------------------------------------\n");

  console.log("Sample Reconciled Mappings:");
  for (const r of results.slice(0, 15)) {
    console.log(`  [${r.status}] ${r.wikiAccount} -> ${r.targetCountry} (${r.notes})`);
  }
}

main().catch(console.error);
