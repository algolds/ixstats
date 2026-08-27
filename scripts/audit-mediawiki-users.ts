import fs from "fs";

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL}/api.php`;
const REPORT_FILE = "scripts/mediawiki_users_report.md";

interface MWUser {
  userid: number;
  name: string;
  editcount: number;
  registration?: string;
  groups?: string[];
  recentactivity?: boolean;
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

async function fetchAllUsers(): Promise<MWUser[]> {
  const allUsers: MWUser[] = [];
  let aufrom: string | undefined = undefined;

  while (true) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "allusers");
    url.searchParams.set("auprop", "editcount|registration|groups");
    url.searchParams.set("aulimit", "500");
    url.searchParams.set("format", "json");
    if (aufrom) {
      url.searchParams.set("aufrom", aufrom);
    }

    const data = await fetchWithRetry(url.toString());
    if (!data) break;

    const users = data?.query?.allusers || [];
    if (users.length === 0) break;

    for (const u of users) {
      allUsers.push({
        userid: Number(u.userid),
        name: String(u.name || "").trim(),
        editcount: Number(u.editcount || 0),
        registration: u.registration,
        groups: u.groups || [],
      });
    }

    if (data?.["continue"]?.aufrom) {
      aufrom = data["continue"].aufrom;
    } else {
      break;
    }
  }

  return allUsers;
}

async function fetchRecentActiveUsers(): Promise<Set<string>> {
  const active = new Set<string>();
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "recentchanges");
  url.searchParams.set("rclimit", "500");
  url.searchParams.set("format", "json");

  const data = await fetchWithRetry(url.toString());
  const rcs = data?.query?.recentchanges || [];
  for (const rc of rcs) {
    if (rc.user) {
      active.add(rc.user.toLowerCase());
    }
  }
  return active;
}

async function main() {
  const users = await fetchAllUsers();
  const activeRecent = await fetchRecentActiveUsers();

  const total = users.length;
  const withEdits = users.filter((u) => u.editcount > 0);
  const zeroEdits = users.filter((u) => u.editcount === 0);
  const sysops = users.filter(
    (u) =>
      u.groups?.includes("sysop") || u.groups?.includes("bureaucrat") || u.groups?.includes("admin")
  );
  const botAccounts = users.filter(
    (u) => u.groups?.includes("bot") || u.name.toLowerCase().includes("bot")
  );

  const sortedByEdits = [...withEdits].sort((a, b) => b.editcount - a.editcount);

  let md = `# MediaWiki Account Audit & IxnayID Matching Strategy\n\n`;
  md += `**Target MediaWiki**: \`${MEDIAWIKI_URL}\`\n`;
  md += `**Audit Timestamp**: \`${new Date().toISOString()}\`\n\n`;

  md += `## 1. Executive Summary\n\n`;
  md += `| Category | Count | Percentage |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Total Registered MediaWiki Accounts** | **${total}** | 100.0% |\n`;
  md += `| **Active Contributors (Edit Count > 0)** | **${withEdits.length}** | ${((withEdits.length / total) * 100).toFixed(1)}% |\n`;
  md += `| **Dormant / 0-Edit Accounts** | **${zeroEdits.length}** | ${((zeroEdits.length / total) * 100).toFixed(1)}% |\n`;
  md += `| **Sysops / Bureaucrats / Admins** | **${sysops.length}** | ${((sysops.length / total) * 100).toFixed(1)}% |\n`;
  md += `| **Automated / Bot Accounts** | **${botAccounts.length}** | ${((botAccounts.length / total) * 100).toFixed(1)}% |\n\n`;

  md += `## 2. Top Tier Historical Authors (Edit Count >= 50)\n\n`;
  md += `| User ID | Username | Edit Count | Registration | Privileged Groups |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const u of sortedByEdits.filter((u) => u.editcount >= 50)) {
    const isRecent = activeRecent.has(u.name.toLowerCase()) ? "🔥 Active" : "";
    md += `| \`${u.userid}\` | **${u.name}** ${isRecent} | **${u.editcount.toLocaleString()}** | ${u.registration ? u.registration.substring(0, 10) : "Legacy"} | \`${u.groups?.filter((g) => g !== "*").join(", ") || "user"}\` |\n`;
  }

  md += `\n## 3. Moderate Contributors (10 <= Edit Count < 50)\n\n`;
  md += `| User ID | Username | Edit Count | Registration | Groups |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  for (const u of sortedByEdits.filter((u) => u.editcount >= 10 && u.editcount < 50)) {
    md += `| \`${u.userid}\` | **${u.name}** | ${u.editcount} | ${u.registration ? u.registration.substring(0, 10) : "Legacy"} | \`${u.groups?.filter((g) => g !== "*").join(", ") || "user"}\` |\n`;
  }

  md += `\n## 4. Minor / Occasional Contributors (1 <= Edit Count < 10)\n\n`;
  md += `| User ID | Username | Edit Count | Registration |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  for (const u of sortedByEdits.filter((u) => u.editcount >= 1 && u.editcount < 10)) {
    md += `| \`${u.userid}\` | ${u.name} | ${u.editcount} | ${u.registration ? u.registration.substring(0, 10) : "Legacy"} |\n`;
  }

  md += `\n## 5. Dormant Accounts (Edit Count = 0, Sample)\n\n`;
  md += `Total dormant registered accounts: **${zeroEdits.length}**.\n\n`;
  md += `\`\`\`text\n`;
  md += zeroEdits.map((u) => u.name).join(", ");
  md += `\n\`\`\`\n\n`;

  fs.writeFileSync(REPORT_FILE, md);
  console.log(`✅ Audit complete. Saved report to ${REPORT_FILE}`);
}

main().catch(console.error);
