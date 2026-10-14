/** @jest-environment node */
/** The Vault tint is defined once in tokens.css, with the values of APP_TINTS.vault. */
import fs from "fs";
import path from "path";
import { APP_TINTS } from "~/lib/design/tokens";

const css = fs.readFileSync(path.resolve(__dirname, "../../styles/facet/tokens.css"), "utf-8");
const rules = [...css.matchAll(/\[data-app="vault"\]\s*\{([^}]*)\}/g)].map((match) => match[1]!);

function declared(block: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

describe("vault tint tokens", () => {
  it("has exactly one [data-app=vault] rule", () => {
    expect(rules).toHaveLength(1);
  });

  it("matches APP_TINTS.vault in both schemes", () => {
    const [rule] = rules;
    const { light, dark } = APP_TINTS.vault;
    expect(declared(rule!, "tint-light")).toBe(light.tint);
    expect(declared(rule!, "tint-light-strong")).toBe(light.strong);
    expect(declared(rule!, "on-tint-light")).toBe(light.onTint);
    expect(declared(rule!, "tint-dark")).toBe(dark.tint);
    expect(declared(rule!, "tint-dark-strong")).toBe(dark.strong);
    expect(declared(rule!, "on-tint-dark")).toBe(dark.onTint);
  });
});
