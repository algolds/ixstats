import { clerkPublicProfile } from "~/server/shared/clerk-public-profile";

describe("clerkPublicProfile", () => {
  it("returns the picture and Clerk role, and remembers them for a while", async () => {
    const read = jest.fn().mockResolvedValue({
      imageUrl: "https://img.clerk.example/kir.png",
      publicMetadata: { role: "admin" },
    });
    const first = await clerkPublicProfile("user_kir", read, 1_000);
    const again = await clerkPublicProfile("user_kir", read, 2_000);
    expect(first).toEqual({ imageUrl: "https://img.clerk.example/kir.png", role: "admin" });
    expect(again).toEqual(first);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads again once the remembered profile is stale", async () => {
    const read = jest.fn().mockResolvedValue({ imageUrl: "a", publicMetadata: {} });
    await clerkPublicProfile("user_stale", read, 0);
    await clerkPublicProfile("user_stale", read, 11 * 60 * 1000);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("gives nulls for a missing or non-Clerk id, an unknown role or a Clerk failure", async () => {
    const read = jest.fn().mockRejectedValue(new Error("down"));
    await expect(clerkPublicProfile(null, read)).resolves.toEqual({ imageUrl: null, role: null });
    await expect(clerkPublicProfile("legacy_1", read)).resolves.toEqual({ imageUrl: null, role: null });
    await expect(clerkPublicProfile("user_down", read)).resolves.toEqual({ imageUrl: null, role: null });
    const noRole = jest.fn().mockResolvedValue({ imageUrl: "", publicMetadata: { role: 7 } });
    await expect(clerkPublicProfile("user_odd", noRole)).resolves.toEqual({ imageUrl: null, role: null });
  });
});
