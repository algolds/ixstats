/** @jest-environment node */
/**
 * SL-6: the admin notification registry lists only notifications that can actually fire.
 * Every `on*` registry entry is a hook in `notificationHooks`, and every hook has a caller
 * outside the notifications library (the 12 never-called hooks were removed).
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { NOTIFICATION_EVENTS } from "~/lib/notifications/events-registry";

const SRC = join(process.cwd(), "src");
const HOOKS_FILE = join(SRC, "lib/notifications/hooks.ts");

function hookNames(): string[] {
  const source = readFileSync(HOOKS_FILE, "utf8");
  const body = /export const notificationHooks = \{([^}]*)\}/.exec(source)?.[1] ?? "";
  return body
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "tests" || entry === "node_modules") continue;
      sourceFiles(path, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

describe("notification events registry", () => {
  const hooks = hookNames();

  it("parses the hook map", () => {
    expect(hooks.length).toBeGreaterThan(0);
  });

  it("lists only hooks that exist", () => {
    const registryHooks = NOTIFICATION_EVENTS.map((e) => e.eventKey).filter((k) =>
      /^on[A-Z]/.test(k)
    );
    expect(registryHooks.filter((k) => !hooks.includes(k))).toEqual([]);
  });

  it("has a caller for every hook", () => {
    const callers = sourceFiles(SRC)
      .filter((f) => !f.startsWith(join(SRC, "lib/notifications")))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    expect(hooks.filter((h) => !new RegExp(`\\.${h}\\b`).test(callers))).toEqual([]);
  });
});
