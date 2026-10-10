/** @jest-environment node */
import { verifyToken } from "@clerk/backend";
import type { Socket } from "socket.io";
import {
  canJoinConversation,
  canJoinThinktankGroup,
  createSocketAuthMiddleware,
  getAllowedOrigins,
  getPrincipal,
  isOriginAllowed,
  verifySocketToken,
} from "~/lib/websocket/socket-auth";

jest.mock("@clerk/backend", () => ({ verifyToken: jest.fn() }));

const mockParticipantFindFirst = jest.fn();
const mockMemberFindFirst = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    conversationParticipant: {
      findFirst: (args: object) => mockParticipantFindFirst(args),
    },
    thinktankMember: { findFirst: (args: object) => mockMemberFindFirst(args) },
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const env = process.env as Record<string, string | undefined>;
const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY", "WS_ALLOWED_ORIGINS", "NEXT_PUBLIC_APP_URL"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, env[key]]));

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  setEnv({
    NODE_ENV: "test",
    CLERK_SECRET_KEY: "sk_test_secret",
    WS_ALLOWED_ORIGINS: undefined,
    NEXT_PUBLIC_APP_URL: undefined,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  setEnv(savedEnv);
});

describe("verifySocketToken", () => {
  it("returns null without a token and never calls Clerk", async () => {
    await expect(verifySocketToken(undefined)).resolves.toBeNull();
    await expect(verifySocketToken("")).resolves.toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("fails closed when CLERK_SECRET_KEY is missing", async () => {
    setEnv({ CLERK_SECRET_KEY: undefined });
    await expect(verifySocketToken("token")).resolves.toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("returns null when Clerk rejects the token", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("expired"));
    await expect(verifySocketToken("token")).resolves.toBeNull();
  });

  it("returns the Clerk user id from a valid token", async () => {
    setEnv({ WS_ALLOWED_ORIGINS: "https://maps.ixwiki.com" });
    mockVerifyToken.mockResolvedValueOnce({ sub: "user_1" } as Awaited<
      ReturnType<typeof verifyToken>
    >);
    await expect(verifySocketToken("token")).resolves.toEqual({ clerkUserId: "user_1" });
    expect(mockVerifyToken).toHaveBeenCalledWith("token", {
      secretKey: "sk_test_secret",
      authorizedParties: expect.arrayContaining(["https://maps.ixwiki.com"]),
    });
  });
});

describe("createSocketAuthMiddleware", () => {
  const handshake = (auth: object) => ({ handshake: { auth } }) as unknown as Socket;
  const run = (socket: Socket) =>
    new Promise<Error | undefined>((resolve) => createSocketAuthMiddleware()(socket, resolve));

  it("lets a handshake without a token in as an anonymous reader with no principal", async () => {
    for (const auth of [{}, { token: "" }, { token: 5 }]) {
      const socket = handshake(auth);
      await expect(run(socket)).resolves.toBeUndefined();
      expect(getPrincipal(socket)).toBeNull();
    }
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it("still fails closed on a token that does not verify", async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error("expired"));
    const error = await run(handshake({ token: "stale" }));
    expect(error?.message).toBe("unauthorized");
  });

  it("gives a verified token its principal", async () => {
    mockVerifyToken.mockResolvedValueOnce({ sub: "user_1" } as Awaited<
      ReturnType<typeof verifyToken>
    >);
    const socket = handshake({ token: "good" });
    await expect(run(socket)).resolves.toBeUndefined();
    expect(getPrincipal(socket)).toEqual({ clerkUserId: "user_1" });
  });
});

describe("origin policy", () => {
  it("allows localhost and origin-less clients outside production", () => {
    expect(getAllowedOrigins()).toEqual(["http://localhost:3000", "http://localhost:3003"]);
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("https://evil.example")).toBe(false);
  });

  it("rejects everything in production when no origin is configured", () => {
    setEnv({ NODE_ENV: "production" });
    expect(getAllowedOrigins()).toEqual([]);
    expect(isOriginAllowed("https://evil.example")).toBe(false);
    expect(isOriginAllowed("http://localhost:3000")).toBe(false);
    expect(isOriginAllowed(undefined)).toBe(false);
  });

  it("allows only configured origins in production", () => {
    setEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://ixwiki.com/projects/ixstats",
      WS_ALLOWED_ORIGINS: " https://maps.ixwiki.com/ ,not a url,,https://ixwiki.com",
    });
    expect(getAllowedOrigins()).toEqual(["https://maps.ixwiki.com", "https://ixwiki.com"]);
    expect(isOriginAllowed("https://ixwiki.com")).toBe(true);
    expect(isOriginAllowed("https://maps.ixwiki.com")).toBe(true);
    expect(isOriginAllowed("https://evil.example")).toBe(false);
    expect(isOriginAllowed(undefined)).toBe(false);
  });
});

describe("room membership", () => {
  it("allows a conversation only for an active participant", async () => {
    mockParticipantFindFirst.mockResolvedValueOnce({ id: "p1" }).mockResolvedValueOnce(null);
    await expect(canJoinConversation("user_1", "conv1")).resolves.toBe(true);
    await expect(canJoinConversation("user_2", "conv1")).resolves.toBe(false);
    expect(mockParticipantFindFirst).toHaveBeenCalledWith({
      where: { conversationId: "conv1", userId: "user_2", isActive: true },
      select: { id: true },
    });
  });

  it("allows a thinktank group only for an active member", async () => {
    mockMemberFindFirst.mockResolvedValueOnce({ id: "m1" }).mockResolvedValueOnce(null);
    await expect(canJoinThinktankGroup("user_1", "group1")).resolves.toBe(true);
    await expect(canJoinThinktankGroup("user_2", "group1")).resolves.toBe(false);
    expect(mockMemberFindFirst).toHaveBeenCalledWith({
      where: { groupId: "group1", userId: "user_2", isActive: true },
      select: { id: true },
    });
  });
});
