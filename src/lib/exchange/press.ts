/**
 * Business press from ThinkPages (spec §11a). A story is a public, top-level #business post by a realm's media or
 * government account, or by a company's linked corporate account. Posts are read live, never copied, so a deleted,
 * hidden or warned post leaves the Exchange with ThinkPages moderation and nothing else.
 */
import { ExchangeError } from "~/lib/vault/exchange-service";
import { requireOwnedCompany } from "./companies";
import type { Db } from "./guards";
import type { NewsItem } from "./terminal";

const PRESS_TYPES = ["media", "government"];
const HEADLINE_MAX = 140;

export interface BusinessPostArgs {
  realmId: string;
  companyId?: string;
  countryId?: string;
  take?: number;
}

/** The post's text without its #tags, cut to a headline. */
function headlineOf(content: string): string {
  const text = content
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > HEADLINE_MAX ? `${text.slice(0, HEADLINE_MAX - 1).trimEnd()}…` : text;
}

const isBusiness = (hashtags: string | null) =>
  (JSON.parse(hashtags ?? "[]") as string[]).some((t) => t.toLowerCase() === "business");

/** Eligible accounts and how each is named: nation press by realm, companies by their linked account. */
async function pressAccounts(db: Db, args: BusinessPostArgs) {
  const companies = await db.company.findMany({
    where: {
      realmId: args.realmId,
      thinkpagesAccountId: { not: null },
      ...(args.companyId ? { id: args.companyId } : {}),
      ...(args.countryId ? { hqCountryId: args.countryId } : {}),
    },
    select: { id: true, name: true, thinkpagesAccountId: true },
  });
  const nations = args.companyId
    ? []
    : await db.country.findMany({
        where: { realmId: args.realmId, ...(args.countryId ? { id: args.countryId } : {}) },
        select: { id: true, name: true },
      });
  const accounts = await db.thinkpagesAccount.findMany({
    where: {
      isActive: true,
      OR: [
        { id: { in: companies.map((c) => c.thinkpagesAccountId!) } },
        { accountType: { in: PRESS_TYPES }, countryId: { in: nations.map((n) => n.id) } },
      ],
    },
    select: { id: true, accountType: true, countryId: true, displayName: true },
  });
  const nationName = new Map(nations.map((n) => [n.id, n.name]));
  const byAccount = new Map<
    string,
    Pick<NewsItem, "sourceName" | "companyId" | "countryId" | "sourceKind">
  >();
  for (const a of accounts) {
    const company = companies.find((c) => c.thinkpagesAccountId === a.id);
    if (company) {
      byAccount.set(a.id, {
        sourceName: company.name,
        companyId: company.id,
        countryId: null,
        sourceKind: "COMPANY",
      });
    } else if (PRESS_TYPES.includes(a.accountType) && a.countryId && nationName.has(a.countryId)) {
      const government = a.accountType === "government";
      byAccount.set(a.id, {
        sourceName: government ? nationName.get(a.countryId)! : a.displayName,
        companyId: null,
        countryId: a.countryId,
        sourceKind: government ? "NATION" : "PRESS",
      });
    }
  }
  return byAccount;
}

/** Live #business stories for a realm, a company or a nation, newest first. */
export async function listBusinessPosts(db: Db, args: BusinessPostArgs): Promise<NewsItem[]> {
  const take = Math.min(args.take ?? 10, 50);
  const accounts = await pressAccounts(db, args);
  if (accounts.size === 0) return [];
  const posts = await db.thinkpagesPost.findMany({
    where: {
      accountId: { in: [...accounts.keys()] },
      visibility: "public",
      parentPostId: null,
      repostOfId: null,
      contentWarning: null,
      hashtags: { contains: '"business"', mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, accountId: true, content: true, hashtags: true, createdAt: true },
  });
  // ponytail: re-checks in code because the fake test DB ignores orderBy and a substring match can't parse JSON
  return posts
    .filter((p) => isBusiness(p.hashtags))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take)
    .map((p) => {
      const source = accounts.get(p.accountId)!;
      return {
        id: `post:${p.id}`,
        realmId: args.realmId,
        kind: "press",
        prominence: "HEADLINE",
        sourceId: source.companyId ?? source.countryId,
        headline: headlineOf(p.content),
        body: p.content,
        bondId: null,
        contractId: null,
        movePct: null,
        createdAt: p.createdAt,
        href: `/dashboard/post/${p.id}`,
        ...source,
      };
    });
}

/** Stories merged by time, newest first. */
export function mergeNews(...lists: readonly NewsItem[][]): NewsItem[] {
  return lists.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** The founder links one of their own corporate ThinkPages accounts to their company. */
export async function linkCompanyAccount(
  db: Db,
  i: { userId: string; companyId: string; accountId: string }
): Promise<void> {
  await requireOwnedCompany(db, i.companyId, i.userId, true);
  const [user, account] = await Promise.all([
    db.user.findUnique({ where: { id: i.userId }, select: { clerkUserId: true } }),
    db.thinkpagesAccount.findUnique({
      where: { id: i.accountId },
      select: { clerkUserId: true, accountType: true },
    }),
  ]);
  if (!account || account.clerkUserId !== user?.clerkUserId) {
    throw new ExchangeError("FORBIDDEN", "That ThinkPages account isn't yours");
  }
  if (account.accountType !== "corporate") {
    throw new ExchangeError("CONFLICT", "Only a corporate account can speak for a company");
  }
  const taken = await db.company.findFirst({
    where: { thinkpagesAccountId: i.accountId, id: { not: i.companyId } },
    select: { id: true },
  });
  if (taken) throw new ExchangeError("CONFLICT", "That account already speaks for another company");
  await db.company.update({
    where: { id: i.companyId },
    data: { thinkpagesAccountId: i.accountId },
  });
}

export async function unlinkCompanyAccount(
  db: Db,
  i: { userId: string; companyId: string }
): Promise<void> {
  await requireOwnedCompany(db, i.companyId, i.userId, true);
  await db.company.update({ where: { id: i.companyId }, data: { thinkpagesAccountId: null } });
}
