import fs from "fs";

const fullArticles = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/category_politics_full_audit.json", "utf8")
);

const countryGov = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/category_countries_government_audit.json", "utf8")
);

const countryProfiles = JSON.parse(
  fs.readFileSync("/home/jxsig/projects/ixstats/data/political-audit/country_governance_profiles.json", "utf8")
);

console.log("=== POLITICAL THEORIST STRESS-TEST & SELF-CRITIQUE ===");

// 1. Check for pure secularist / anti-clerical regimes
const secularArticles = fullArticles.articles.filter((a: any) => 
  /secular|anti-cleric|atheis|laic|state secularism/i.test(a.snippet)
);
console.log(`Articles mentioning secularism/anti-clericalism: ${secularArticles.length}`);
console.log("Samples:", secularArticles.slice(0, 5).map((a: any) => a.title));

// 2. Check for pure unitary states (contradicting Trend 4 Subsidiarity)
const unitaryArticles = countryGov.articles.filter((a: any) =>
  /unitary/i.test(a.infoboxCountry?.government_type || "") || /unitary/i.test(a.snippet)
);
console.log(`Articles with explicit unitary government: ${unitaryArticles.length}`);
console.log("Samples:", unitaryArticles.slice(0, 5).map((a: any) => ({ title: a.title, gov: a.infoboxCountry?.government_type })));

// 3. Check for pure mass suffrage / liberal democratic institutions (contradicting Trend 1 Estates)
const massDemocracyArticles = fullArticles.articles.filter((a: any) =>
  /universal suffrage|popular vote|direct democracy|mass democracy|one person one vote/i.test(a.snippet)
);
console.log(`Articles mentioning universal suffrage/popular vote: ${massDemocracyArticles.length}`);
console.log("Samples:", massDemocracyArticles.slice(0, 5).map((a: any) => a.title));

// 4. Check for state security / paramilitary / surveillance governance (extending Power dimension)
const securityOrgArticles = fullArticles.articles.filter((a: any) =>
  /secret police|intelligence agency|paramilitary|security service|gendarmerie|state security/i.test(a.snippet)
);
console.log(`Articles mentioning state security/paramilitary/intelligence: ${securityOrgArticles.length}`);
console.log("Samples:", securityOrgArticles.slice(0, 5).map((a: any) => a.title));

// 5. Check for guided democracy / sham elections / managed pluralism
const guidedDemocracyArticles = fullArticles.articles.filter((a: any) =>
  /guided democracy|managed democracy|managed pluralism|dominant party|one-party state|hegemonic/i.test(a.snippet)
);
console.log(`Articles mentioning guided democracy/managed pluralism: ${guidedDemocracyArticles.length}`);
console.log("Samples:", guidedDemocracyArticles.slice(0, 5).map((a: any) => a.title));
