import { PLAY_AS_COOKIE, setPlayAsCookie } from "../play-as-cookie";

describe("setPlayAsCookie", () => {
  afterEach(() => {
    setPlayAsCookie(false);
  });

  it("sets a presence-only cookie on every path while play-as is active", () => {
    const write = jest.spyOn(document, "cookie", "set");

    setPlayAsCookie(true);

    expect(write).toHaveBeenCalledWith(`${PLAY_AS_COOKIE}=1; path=/; SameSite=Lax`);
    expect(document.cookie).toContain(`${PLAY_AS_COOKIE}=1`);
    write.mockRestore();
  });

  it("clears it when play-as stops", () => {
    setPlayAsCookie(true);
    const write = jest.spyOn(document, "cookie", "set");

    setPlayAsCookie(false);

    expect(write).toHaveBeenCalledWith(`${PLAY_AS_COOKIE}=; path=/; max-age=0; SameSite=Lax`);
    expect(document.cookie).not.toContain(PLAY_AS_COOKIE);
    write.mockRestore();
  });
});
