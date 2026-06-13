/**
 * One-time AST splitter for the thinkpages mega-router (mirrors split-diplomatic-ast.ts).
 *
 * Strategy (behaviour-preserving): copy the whole router file once per group so every
 * import + module-level helper is retained, rename the exported router, then delete the
 * procedures that don't belong to the group. The groups are recombined with mergeRouters
 * in thinkpages/index.ts, so api.thinkpages.* paths are unchanged.
 *
 * Run from the project root:  bun run scripts/split-thinkpages-ast.ts
 */
import { Project, SyntaxKind, ObjectLiteralExpression, PropertyAssignment } from "ts-morph";
import * as fs from "fs";

// Lightweight: do NOT load tsconfig (pure syntactic edits → minimal memory).
const project = new Project({ skipAddingFilesFromTsConfig: true });

const routerFile = "src/server/api/routers/thinkpages.ts";
const outDir = "src/server/api/routers/thinkpages";
fs.mkdirSync(outDir, { recursive: true });

const groups: Record<string, string[]> = {
  accounts: [
    "createAccount",
    "updateAccount",
    "getMyAccounts",
    "getAccountsByCountry",
    "getThinkpagesAccountByUserId",
    "checkUsernameAvailability",
    "generateProfilePicture",
    "getAccountCountsByType",
  ],
  posts: [
    "createPost",
    "updatePost",
    "deletePost",
    "addReaction",
    "removeReaction",
    "getPostReactions",
    "pinPost",
    "getBookmarks",
    "isBookmarked",
    "bookmarkPost",
    "getFlaggedPosts",
    "isFlagged",
    "flagPost",
    "unflagPost",
  ],
  feed: [
    "getDiscordChannelTopic",
    "calculateTrendingTopics",
    "triggerCitizenReaction",
    "calculateCountryMoodMetrics",
    "getDiscordEmojis",
  ],
  thinktanks: [
    "createThinktank",
    "getThinktanks",
    "joinThinktank",
    "leaveThinktank",
    "getThinktankMessages",
    "sendThinktankMessage",
    "updateThinktank",
    "deleteThinktank",
    "updateMemberRole",
    "removeMemberFromThinktank",
    "inviteToThinktank",
    "getThinktankDocuments",
    "createThinktankDocument",
    "updateThinktankDocument",
    "deleteThinktankDocument",
    "getThinktankDocument",
    "addReactionToMessage",
    "removeReactionFromMessage",
    "editMessage",
    "deleteMessage",
  ],
  messaging: [
    "createConversation",
    "getConversations",
    "getConversationMessages",
    "sendMessage",
    "markMessagesAsRead",
    "updatePresence",
    "getPresenceForUsers",
    "createConversationByCountries",
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Guard: every procedure must be assigned to exactly one group.
const allNames = Object.values(groups).flat();
const dupes = allNames.filter((n, i) => allNames.indexOf(n) !== i);
if (dupes.length) throw new Error(`Duplicate procedure assignments: ${dupes.join(", ")}`);

for (const [groupName, names] of Object.entries(groups)) {
  const outPath = `${outDir}/${groupName}.ts`;
  fs.copyFileSync(routerFile, outPath);
  const sf = project.addSourceFileAtPath(outPath);

  const decl = sf.getVariableDeclarationOrThrow("thinkpagesRouter");
  decl.rename(`thinkpages${cap(groupName)}Router`);

  const call = decl.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const obj = call.getArguments()[0] as ObjectLiteralExpression;
  const props = obj
    .getProperties()
    .filter((p) => p.isKind(SyntaxKind.PropertyAssignment)) as PropertyAssignment[];

  const present = new Set(props.map((p) => p.getName()));
  for (const n of names) {
    if (!present.has(n)) throw new Error(`${groupName}: procedure '${n}' not found in router`);
  }

  let kept = 0;
  for (const p of props) {
    if (names.includes(p.getName())) kept++;
    else p.remove();
  }
  sf.saveSync();
  console.log(`${groupName}.ts: kept ${kept}/${names.length} procedures`);
}

console.log("Done. Now create thinkpages/index.ts (mergeRouters) and delete thinkpages.ts.");
