import { PLAY_AS_COOKIE, setPlayAsCookie, syncPlayAsCookie } from "../play-as-cookie";

describe("setPlayAsCookie", () => {
  afterEach(() => {
    setPlayAsCookie(false);
  });

  it("sets a presence-only cookie on every path, for a year, while play-as is active", () => {
    const write = jest.spyOn(document, "cookie", "set");

    setPlayAsCookie(true);

    expect(write).toHaveBeenCalledWith(
      `${PLAY_AS_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`
    );
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

describe("syncPlayAsCookie", () => {
  afterEach(() => {
    localStorage.removeItem("ixstats.play_as_user");
    setPlayAsCookie(false);
  });

  it("sets the cookie when localStorage holds a play-as entry and the cookie is missing", () => {
    localStorage.setItem("ixstats.play_as_user", "user_1");

    syncPlayAsCookie();

    expect(document.cookie).toContain(`${PLAY_AS_COOKIE}=1`);
  });

  it("clears the cookie when play-as is no longer in localStorage", () => {
    setPlayAsCookie(true);

    syncPlayAsCookie();

    expect(document.cookie).not.toContain(PLAY_AS_COOKIE);
  });

  it("writes nothing when the cookie already agrees with localStorage", () => {
    localStorage.setItem("ixstats.play_as_user", "user_1");
    setPlayAsCookie(true);
    const write = jest.spyOn(document, "cookie", "set");

    syncPlayAsCookie();

    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });
});
