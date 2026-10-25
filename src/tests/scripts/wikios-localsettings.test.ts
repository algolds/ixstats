/** @jest-environment node */
// Workstream B1: the classic MediaWiki snippet that production loads at launch. There is no PHP on the dev box,
// so these guards read the snippet and the test wiki's files as text. Loading the snippet must never move classic
// (article path, canonical URL) unless WIKIOS_TAKEOVER is defined as true, and the sync webhook goes to the URL in the
// pool environment, never to a hard-coded address.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SNIPPET = "scripts/ops/mediawiki/wikios-localsettings.php";
// `define( 'WIKIOS_TAKEOVER', false )` must not turn the takeover on: only the constant set to true does.
const TAKEOVER_IF = "if ( defined( 'WIKIOS_TAKEOVER' ) && WIKIOS_TAKEOVER === true )";

const read = (file: string): string => readFileSync(file, "utf8");

/** The PHP with comments and string bodies blanked to spaces, so offsets stay valid and only code braces count. */
function codeOnly(php: string): string {
  return php.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, (match) =>
    match.replace(/[^\n]/g, " ")
  );
}

/** [start, end) of the brace block that opens at the first `{` at or after `from`. */
function blockFrom(code: string, from: number): [number, number] {
  const open = code.indexOf("{", from);
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    if (code[index] === "}") depth -= 1;
    if (depth === 0) return [open, index + 1];
  }
  throw new Error(`Unbalanced braces after offset ${from}`);
}

function offsetsOf(text: string, needle: string): number[] {
  const offsets: number[] = [];
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1))
    offsets.push(at);
  return offsets;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const php = read(SNIPPET);
const code = codeOnly(php);
/** Offsets of `needle` in the PHP where it starts in code, not in a comment (string bodies may follow). */
const codeOffsetsOf = (needle: string): number[] =>
  offsetsOf(php, needle).filter((at) => code[at] !== " ");

describe("wikios-localsettings.php", () => {
  it("posts to WIKIOS_WEBHOOK_URL and sends nothing without it", () => {
    expect(php).not.toContain("127.0.0.1:3560");

    const [hookAt = -1] = codeOffsetsOf("$wgHooks['PageSaveComplete']");
    expect(hookAt).toBeGreaterThan(-1);
    const [start, end] = blockFrom(code, hookAt);
    const hook = php.slice(start, end);
    const deferredAt = hook.indexOf("DeferredUpdates::addCallableUpdate");
    expect(deferredAt).toBeGreaterThan(-1);

    // Both values are read inside the hook, before the deferred update, and the hook returns when either is empty.
    const beforeDeferred = hook.slice(0, deferredAt);
    expect(beforeDeferred).toContain("$secret = (string)getenv( 'WIKIOS_WEBHOOK_SECRET' );");
    expect(beforeDeferred).toContain("$url = (string)getenv( 'WIKIOS_WEBHOOK_URL' );");
    const guard = /if \( \$secret === '' \|\| \$url === '' \) \{/.exec(beforeDeferred);
    expect(guard).not.toBeNull();
    const [guardStart, guardEnd] = blockFrom(codeOnly(beforeDeferred), guard?.index ?? 0);
    const guardBody = beforeDeferred.slice(guardStart, guardEnd);
    expect(guardBody).toMatch(/\n\t\treturn;\n\t\}$/);

    // The log names what is missing, once per request at most.
    expect(guardBody).toContain("static $logged = false;");
    expect(guardBody).toMatch(
      /if \( \$secret === '' \) \{\s*\$missing\[\] = 'WIKIOS_WEBHOOK_SECRET';/
    );
    expect(guardBody).toMatch(/if \( \$url === '' \) \{\s*\$missing\[\] = 'WIKIOS_WEBHOOK_URL';/);
    expect(guardBody).toMatch(/if \( !\$logged \) \{\s*\$logged = true;/);
    expect(guardBody).toContain(
      "wfDebugLog( 'wikios', 'sync-webhook not sent: ' . implode( ' and ', $missing )"
    );

    // The deferred update receives the URL with `use` and posts to it, with the old timeouts.
    const deferred = hook.slice(deferredAt);
    expect(deferred).toMatch(/static function \(\) use \([^)]*\$url[^)]*\)/);
    expect(deferred).toMatch(/\$requestFactory->create\(\s*\$url,/);
    expect(deferred).toContain("'timeout' => 3,");
    expect(deferred).toContain("'connectTimeout' => 3,");
  });

  it("changes the article path and the canonical URL only under WIKIOS_TAKEOVER", () => {
    const takeoverBlocks = codeOffsetsOf(TAKEOVER_IF).map((at) => blockFrom(code, at));
    expect(takeoverBlocks.length).toBeGreaterThan(0);
    const inTakeover = (at: number) =>
      takeoverBlocks.some(([start, end]) => at > start && at < end);

    const assignments = [...code.matchAll(/\$wgArticlePath\s*=/g)].map((match) => match.index);
    const canonical = codeOffsetsOf("setCanonicalUrl");
    const canonicalHook = codeOffsetsOf("$wgHooks['BeforePageDisplay']");
    expect(assignments.length).toBeGreaterThan(0);
    expect(canonical.length).toBeGreaterThan(0);
    for (const at of [...assignments, ...canonical, ...canonicalHook])
      expect(inTakeover(at)).toBe(true);
  });

  it("tests the takeover only as the constant defined and true, never as merely defined", () => {
    const checks = codeOffsetsOf("defined( 'WIKIOS_TAKEOVER' )");
    expect(checks.length).toBeGreaterThan(0);
    for (const at of checks) expect(php.startsWith(TAKEOVER_IF, at - "if ( ".length)).toBe(true);
  });

  it("no file names WIKIOS_KEEP_WIKI_ARTICLE_PATH", () => {
    const naming = filesUnder("scripts/ops").filter((file) =>
      read(file).includes("WIKIOS_KEEP_WIKI_ARTICLE_PATH")
    );
    expect(naming).toEqual([]);
  });
});

describe("the test MediaWiki", () => {
  it("passes the webhook URL through beside the secret and defines no takeover", () => {
    const compose = read("scripts/ops/wikios-test-mediawiki/docker-compose.yml");
    expect(compose).toContain("WIKIOS_WEBHOOK_SECRET: ${WIKIOS_WEBHOOK_SECRET:-}");
    expect(compose).toContain("WIKIOS_WEBHOOK_URL: ${WIKIOS_WEBHOOK_URL:-}");
    expect(read("scripts/ops/wikios-test-mediawiki/LocalSettings.php")).not.toMatch(
      /define\(\s*'WIKIOS_TAKEOVER'/
    );
  });
});
