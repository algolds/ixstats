import {
  folderFromPath,
  hasLegacyConversationParam,
  messagesPath,
  normaliseConversationParams,
  parseMessagesAddress,
  selectConversationParams,
  setArchivedView,
} from "~/lib/messages/deep-links";

const parse = (search: string) => parseMessagesAddress(new URLSearchParams(search));

describe("parseMessagesAddress", () => {
  it("reads the canonical conversation parameter", () => {
    expect(parse("conversation=abc").conversationId).toBe("abc");
  });

  it.each(["id=abc", "conversationId=abc"])("accepts the older %s link", (search) => {
    expect(parse(search).conversationId).toBe("abc");
  });

  it("prefers ?conversation= over the older parameters", () => {
    expect(parse("id=old&conversation=new").conversationId).toBe("new");
  });

  it("lets a conversation win over country and user targets", () => {
    expect(parse("conversation=abc&country=c1&user=bob")).toEqual({
      conversationId: "abc",
      countryId: null,
      userHandle: null,
      archived: false,
    });
  });

  it("lets a country win over a user", () => {
    const address = parse("country=c1&user=bob");
    expect(address.countryId).toBe("c1");
    expect(address.userHandle).toBeNull();
  });

  it("strips a leading @ from a handle", () => {
    expect(parse("user=%40bob").userHandle).toBe("bob");
  });

  it("ignores blank and oversized values", () => {
    expect(parse("conversation=%20%20").conversationId).toBeNull();
    expect(parse(`conversation=${"x".repeat(200)}`).conversationId).toBeNull();
  });

  it("reads the archived view", () => {
    expect(parse("view=archived").archived).toBe(true);
    expect(parse("view=other").archived).toBe(false);
  });
});

describe("normaliseConversationParams", () => {
  it("rewrites ?id= as ?conversation=", () => {
    const query = new URLSearchParams("id=abc&x=1");
    expect(normaliseConversationParams(query)).toBe(true);
    expect(query.toString()).toBe("x=1&conversation=abc");
  });

  it("rewrites ?conversationId=", () => {
    const query = new URLSearchParams("conversationId=abc");
    normaliseConversationParams(query);
    expect(query.toString()).toBe("conversation=abc");
  });

  it("keeps an existing ?conversation= and drops the older ones", () => {
    const query = new URLSearchParams("id=old&conversation=new");
    normaliseConversationParams(query);
    expect(query.toString()).toBe("conversation=new");
  });

  it("leaves a canonical address alone", () => {
    const query = new URLSearchParams("conversation=abc");
    expect(normaliseConversationParams(query)).toBe(false);
    expect(query.toString()).toBe("conversation=abc");
  });

  it("detects an older parameter", () => {
    expect(hasLegacyConversationParam(new URLSearchParams("id=a"))).toBe(true);
    expect(hasLegacyConversationParam(new URLSearchParams("conversation=a"))).toBe(false);
  });
});

describe("selectConversationParams", () => {
  it("selects a thread and drops pending targets and older parameters", () => {
    const query = new URLSearchParams("country=c1&user=bob&id=old&view=archived");
    selectConversationParams(query, "abc");
    expect(query.toString()).toBe("view=archived&conversation=abc");
  });

  it("closes the thread", () => {
    const query = new URLSearchParams("conversation=abc");
    selectConversationParams(query, null);
    expect(query.toString()).toBe("");
  });
});

describe("setArchivedView", () => {
  it("adds and removes the view parameter", () => {
    const query = new URLSearchParams();
    setArchivedView(query, true);
    expect(query.toString()).toBe("view=archived");
    setArchivedView(query, false);
    expect(query.toString()).toBe("");
  });
});

describe("folders", () => {
  it.each([
    ["/messages", "conversations"],
    ["/messages/requests", "requests"],
    ["/messages/requests/", "requests"],
    ["/messages/unknown", "conversations"],
    [null, "conversations"],
  ] as const)("%s is %s", (pathname, folder) => {
    expect(folderFromPath(pathname)).toBe(folder);
  });

  it("round-trips through messagesPath", () => {
    expect(folderFromPath(messagesPath("requests"))).toBe("requests");
    expect(folderFromPath(messagesPath("conversations"))).toBe("conversations");
  });
});
