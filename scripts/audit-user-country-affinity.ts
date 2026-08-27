import fs from "fs";

const DEFAULT_USER_AGENT = "IxStats-Builder";
const MEDIAWIKI_URL = "https://ixwiki.com";
const API_URL = `${MEDIAWIKI_URL}/api.php`;
const REPORT_FILE = "scripts/user_country_affinity_report.md";

interface MWUser {
  userid: number;
  name: string;
  editcount: number;
  registration?: string;
  groups?: string[];
}

interface UserAffinity {
  user: MWUser;
  totalContributionsFetched: number;
  topPages: Array<{ title: string; count: number }>;
  primaryNation?: string;
  candidateNations: Array<{ name: string; score: number; evidence: string[] }>;
  subjectDomains: string[];
}

async function fetchWithRetry(url: string, retries = 4, baseDelay = 1200): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429 || res.status >= 500) {
        const wait = baseDelay * Math.pow(1.5, attempt);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      if (attempt === retries) return null;
      await new Promise((r) => setTimeout(r, baseDelay * attempt));
    }
  }
  return null;
}

// Fetch all registered users with edit count > 0
async function fetchActiveUsers(): Promise<MWUser[]> {
  console.log("📦 1/3 Discovering registered MediaWiki users...");
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
      if (Number(u.editcount || 0) > 0) {
        allUsers.push({
          userid: Number(u.userid),
          name: String(u.name || "").trim(),
          editcount: Number(u.editcount || 0),
          registration: u.registration,
          groups: u.groups || [],
        });
      }
    }

    if (data?.["continue"]?.aufrom) {
      aufrom = data["continue"].aufrom;
    } else {
      break;
    }
  }

  // Sort by edit count descending
  allUsers.sort((a, b) => b.editcount - a.editcount);
  return allUsers;
}

// Fetch list of known countries / major geopolities from IxWiki Category:Countries or all pages
async function fetchKnownCountries(): Promise<Set<string>> {
  console.log("📦 2/3 Fetching known country entities on IxWiki...");
  const countries = new Set<string>();

  // Add explicit known IxStates nations & IxWiki states
  const seedNations = [
    "Urcea",
    "Caphiria",
    "Burgundie",
    "Cartadania",
    "Castadilla",
    "Corumm",
    "Daxia",
    "Tierrador",
    "Pelaxia",
    "Valcenia",
    "Galata",
    "Metzetta",
    "Caldera",
    "Alstin",
    "Carthinova",
    "Hendalarsk",
    "Eldmora",
    "Puertego",
    "Diamavya",
    "Nolis",
    "Aciria",
    "Ralkern",
    "Drasenia",
    "Olmeria",
    "Fiannria",
    "Akcelis",
    "Argyrea",
    "Farmandie",
    "Asteria",
    "Grajnidar",
    "Helvianir",
    "Syliria",
    "Terazta",
    "Ogonkai",
    "Asteklion",
    "Qubuj",
    "Patraja",
    "Almadaria",
    "Sakartvelos",
    "Enserlano",
    "Yueguo",
    "Kloistan",
    "Dectroia",
    "Aleajayib",
    "Unintra",
    "Azikoria",
    "Ghebeek",
    "Orecula",
    "Insulam",
    "Sassain",
    "Vesta",
    "Grussland",
    "Dhayavastan",
    "Thalaia",
    "Yytuskia-Helvana",
    "Etzil",
    "Neutropic",
    "Solgavden",
    "Tashidaypa",
    "Vellara",
    "Ekelos",
    "Locrya",
    "Ishonga",
    "Rylivian",
    "The Alesian Empire",
    "Daito",
    "Pukhtunkhwa",
    "Qustantistan",
    "Vallorania",
    "Kistan",
    "Yonderre",
    "Nasastan",
    "Kirvia",
    "Tirghal",
    "Odoninia",
    "Levantia",
    "Sarpedon",
    "Audonia",
    "Crona",
    "Thalassa",
    "Isles of Caphiria",
    "New Burgundie",
    "Aharon",
    "Great Levantia",
    "Marchenia",
    "Vayan",
    "Varina",
    "Zendavia",
    "Arcerion",
    "Soropia",
    "Lariana",
    "Norgsveldet",
    "Morwall",
    "Ulanya",
    "Vinya",
    "Bontopia",
  ];

  for (const n of seedNations) {
    countries.add(n);
  }

  // Also query Category:Countries and Category:Nations from MediaWiki
  for (const cat of ["Countries", "Nations", "Sovereign states", "Member states"]) {
    const url = new URL(API_URL);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "categorymembers");
    url.searchParams.set("cmtitle", `Category:${cat}`);
    url.searchParams.set("cmlimit", "500");
    url.searchParams.set("format", "json");

    const data = await fetchWithRetry(url.toString());
    const members = data?.query?.categorymembers || [];
    for (const m of members) {
      if (m.title && m.ns === 0) {
        countries.add(m.title.replace(/^Category:/, ""));
      }
    }
  }

  return countries;
}

// Fetch user contributions and calculate country affinity
async function analyzeUserContributions(
  user: MWUser,
  knownCountries: Set<string>
): Promise<UserAffinity> {
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "usercontribs");
  url.searchParams.set("ucuser", user.name);
  url.searchParams.set("uclimit", "500"); // Sample up to 500 recent edits
  url.searchParams.set("ucprop", "title|timestamp|comment");
  url.searchParams.set("format", "json");

  const data = await fetchWithRetry(url.toString());
  const contribs = data?.query?.usercontribs || [];

  const pageCounts = new Map<string, number>();
  const nationScores = new Map<string, { score: number; evidence: Set<string> }>();

  for (const c of contribs) {
    const title = String(c.title || "").trim();
    if (
      !title ||
      title.startsWith("User:") ||
      title.startsWith("User talk:") ||
      title.startsWith("Template:")
    ) {
      continue;
    }

    pageCounts.set(title, (pageCounts.get(title) || 0) + 1);

    // Check for country name directly or as a word/prefix in the title or comment
    const fullText = `${title} ${c.comment || ""}`;

    for (const country of knownCountries) {
      // Word boundary match
      const regex = new RegExp(`\\b${country.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regex.test(fullText)) {
        if (!nationScores.has(country)) {
          nationScores.set(country, { score: 0, evidence: new Set() });
        }
        const record = nationScores.get(country)!;
        record.score += title.toLowerCase() === country.toLowerCase() ? 5 : 1;
        record.evidence.add(title);
      }
    }
  }

  // If the user's name is itself a known country, give that highest base affinity
  for (const country of knownCountries) {
    if (country.toLowerCase() === user.name.toLowerCase()) {
      if (!nationScores.has(country)) {
        nationScores.set(country, {
          score: 10,
          evidence: new Set([`User name is "${user.name}"`]),
        });
      } else {
        const record = nationScores.get(country)!;
        record.score += 20;
        record.evidence.add(`User name is "${user.name}"`);
      }
    }
  }

  const sortedPages = Array.from(pageCounts.entries())
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const candidateNations = Array.from(nationScores.entries())
    .map(([name, val]) => ({
      name,
      score: val.score,
      evidence: Array.from(val.evidence).slice(0, 5),
    }))
    .sort((a, b) => b.score - a.score);

  const primaryNation = candidateNations.length > 0 ? candidateNations[0].name : undefined;

  return {
    user,
    totalContributionsFetched: contribs.length,
    topPages: sortedPages,
    primaryNation,
    candidateNations: candidateNations.slice(0, 4),
    subjectDomains: sortedPages.map((p) => p.title).slice(0, 4),
  };
}

async function main() {
  console.log("==================================================================");
  console.log("🧭 MEDIAWIKI AUTHOR ↔ COUNTRY / NATION AFFINITY AUDIT");
  console.log("==================================================================");

  const users = await fetchActiveUsers();
  console.log(`Found ${users.length} active MediaWiki users with >0 edits.`);

  const knownCountries = await fetchKnownCountries();
  console.log(`Compiled index of ${knownCountries.size} known geopolitical entities / nations.`);

  console.log(
    "\n📦 3/3 Analyzing contribution patterns and nation affinities (this may take ~20s)..."
  );
  const affinities: UserAffinity[] = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    process.stdout.write(`   [${i + 1}/${users.length}] Analyzing ${u.name}... \r`);
    const aff = await analyzeUserContributions(u, knownCountries);
    affinities.push(aff);
    // Small delay to be polite to MediaWiki API
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log("\n\nGenerating audit report...");

  let md = `# MediaWiki Author ↔ Nation & IxnayID Affinity Audit\n\n`;
  md += `**Target System**: \`https://ixwiki.com\`\n`;
  md += `**Analysis Sample**: Up to 500 recent edits per user across all \`${users.length}\` active contributors.\n`;
  md += `**Audit Timestamp**: \`${new Date().toISOString()}\`\n\n`;

  md += `## 1. Executive Summary\n\n`;
  md += `This audit inspects the full contribution logs of all MediaWiki accounts to identify their **primary country subjects**, **geographic focus areas**, and **canonical IxStates nation affiliations**.\n\n`;

  md += `## 2. Power Authors & Core Geo-Affinities (>= 50 Edits)\n\n`;
  md += `| User ID | MediaWiki Username | Total Edits | Deduced Nation(s) | Top Edited Pages / Evidence | Confidence |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const aff of affinities.filter((a) => a.user.editcount >= 50)) {
    const nations =
      aff.candidateNations.map((n) => `**${n.name}** (${n.score} pts)`).join("<br/>") ||
      "*General / Multi-regional*";
    const topPagesList =
      aff.topPages
        .slice(0, 4)
        .map((p) => `${p.title} (${p.count})`)
        .join("<br/>") || "*None recorded*";

    let confidence = "HIGH";
    if (aff.candidateNations.length === 0) confidence = "LOW";
    else if (aff.candidateNations[0].score < 5) confidence = "MEDIUM";

    md += `| \`${aff.user.userid}\` | **${aff.user.name}** | **${aff.user.editcount.toLocaleString()}** | ${nations} | ${topPagesList} | \`${confidence}\` |\n`;
  }

  md += `\n## 3. Moderate & Persona Contributors (10 to 49 Edits)\n\n`;
  md += `| User ID | MediaWiki Username | Total Edits | Deduced Nation(s) | Top Edited Pages | Confidence |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const aff of affinities.filter((a) => a.user.editcount >= 10 && a.user.editcount < 50)) {
    const nations =
      aff.candidateNations
        .slice(0, 2)
        .map((n) => `**${n.name}**`)
        .join(", ") || "*Unspecified*";
    const topPagesList =
      aff.topPages
        .slice(0, 3)
        .map((p) => `${p.title} (${p.count})`)
        .join(", ") || "*None*";
    const confidence =
      aff.candidateNations.length > 0 && aff.candidateNations[0].score >= 3 ? "HIGH" : "MEDIUM";
    md += `| \`${aff.user.userid}\` | **${aff.user.name}** | ${aff.user.editcount} | ${nations} | ${topPagesList} | \`${confidence}\` |\n`;
  }

  md += `\n## 4. Minor Contributors & Legacy Accounts (1 to 9 Edits)\n\n`;
  md += `| User ID | MediaWiki Username | Edits | Deduced Nation(s) | Top Pages |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;

  for (const aff of affinities.filter((a) => a.user.editcount < 10)) {
    const nations =
      aff.candidateNations
        .slice(0, 2)
        .map((n) => n.name)
        .join(", ") || "—";
    const topPagesList =
      aff.topPages
        .slice(0, 2)
        .map((p) => p.title)
        .join(", ") || "—";
    md += `| \`${aff.user.userid}\` | ${aff.user.name} | ${aff.user.editcount} | ${nations} | ${topPagesList} |\n`;
  }

  fs.writeFileSync(REPORT_FILE, md);
  console.log(`\n✅ Detailed Affinity Audit written to ${REPORT_FILE}`);
}

main().catch(console.error);
