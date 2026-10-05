import fs from "fs";
import path from "path";
import { SYSTEM_COLORS } from "~/lib/design/tokens";

const CSS = fs.readFileSync(path.resolve(__dirname, "../../styles/utilities.css"), "utf8");
const ROLES = ["red", "yellow", "green", "blue", "indigo"] as const;

describe("facet-on-dark", () => {
  const block = /@utility facet-on-dark \{([^}]*)\}/.exec(CSS)?.[1] ?? "";

  it("exists in utilities.css", () => {
    expect(block).not.toBe("");
  });

  it.each(ROLES)("binds %s to its dark-theme value in tokens.ts", (role) => {
    const match = new RegExp(`--color-${role}:\\s*(#[0-9a-fA-F]{6});`).exec(block);
    expect(match?.[1]?.toLowerCase()).toBe(SYSTEM_COLORS[role].dark.toLowerCase());
  });

  it("rebinds only those five roles", () => {
    expect((block.match(/--color-[a-z]+:/g) ?? []).sort()).toEqual(
      ROLES.map((r) => `--color-${r}:`).sort()
    );
  });
});
