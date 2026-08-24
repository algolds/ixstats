import { VAULT_BONUS_DEFAULTS as B, achievementBonus, nsImportBonus } from "~/lib/vault/vault-bonus";

describe("vault-bonus", () => {
  test("achievement bonus scales by rarity, case-insensitive", () => {
    expect(achievementBonus(B, "Common")).toBe(100);
    expect(achievementBonus(B, "legendary")).toBe(2500);
    expect(achievementBonus(B, "EPIC")).toBe(1000);
    expect(achievementBonus(B, "???")).toBe(100); // unknown → common floor
  });

  test("NS import bonus is per-card and capped", () => {
    expect(nsImportBonus(B, 10)).toBe(500); // 10 * 50
    expect(nsImportBonus(B, 1000)).toBe(B.nsCap); // capped at 5000
    expect(nsImportBonus(B, 0)).toBe(0);
  });
});
