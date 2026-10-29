/** @jest-environment node */
/**
 * A member's notification settings decide what reaches them. Ada turns economic alerts off, raises her minimum
 * urgency to medium, opts into email and subscribes two browsers (a made-up push host is refused). Then the
 * platform raises notices the way it does in play: a market alert and a pack notice (economic, never written), a
 * low-priority social notice (below her urgency), a high-priority diplomatic notice (written, pushed to both
 * browsers, the one the push service says is gone deleted, emailed once with an absolute link), a medium notice
 * (pushed, not emailed), a broadcast and a country-wide notice (in-app only, never filtered), a notice from an event
 * the admin switched off (refused), admin notices through the tRPC router and the messaging broadcast, and a bulk
 * batch. Only Ada can mark her notices read. Ben chose the daily digest: a failed send keeps his digest time so the
 * next run retries, a sent one advances it, and a run with nothing new sends nothing.
 *
 * Folds recipient-preferences (category toggles and aliases, minimum urgency, internal-id recipients, fail open,
 * create/createMany filtering), delivery-wiring (accepted single-user notices delivered, broadcasts not, channels,
 * push subscription guards, email consent), admin-notice-preferences (the router notice and the messaging
 * broadcast), guard (a disabled event key) and delivery.test (deliverNotification, the digest, and the wire format a
 * push service checks: RFC 8291's worked example, a VAPID JWT that verifies, and the push-host allowlist).
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  auth: jest.fn(),
  getAuth: () => null,
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => ({
        primaryEmailAddress: { emailAddress: `${id}@example.com` },
      }),
    },
  }),
}));

import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import { notificationAPI } from "~/lib/notifications/api";
import { pushConfig } from "~/lib/notifications/delivery/config";
import { runNotificationEmailDigest } from "~/lib/notifications/delivery/digest";
import {
  encryptPushPayload,
  isAllowedPushEndpoint,
  vapidAuthorization,
} from "~/lib/notifications/delivery/web-push";
import { createCallerFactory } from "~/server/api/trpc";
import { notificationsPreferencesRouter } from "~/server/api/routers/notifications/preferences";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { createMessagingService } from "~/server/modules/messaging";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation } from "~/tests/helpers/nation-world";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const preferences = createCallerFactory(notificationsPreferencesRouter);
const tray = createCallerFactory(notificationsUserRouter);

const APP = "https://ixwiki.com/projects/ixstates";
const PUSH_OK = "https://fcm.googleapis.com/fcm/send/ada-laptop";
const PUSH_GONE = "https://fcm.googleapis.com/fcm/send/ada-old-phone";
const EMAIL_API = "https://api.resend.com/emails";

interface Sent {
  url: string;
  body: string | Uint8Array;
}
let sent: Sent[];
let emailStatus: number;

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") };
}

/** Lets the fire-and-forget deliveries finish. */
async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

const pushes = () =>
  sent.filter((s) => s.url.startsWith("https://fcm.googleapis.com/")).map((s) => s.url);
const emails = () =>
  sent
    .filter((s) => s.url === EMAIL_API)
    .map((s) => JSON.parse(String(s.body)) as { to: string[]; subject: string; text: string });

let db: MemoryPrisma;
const saved = { ...process.env };

const as = (id: string, role: { name: string; level: number } = { name: "member", level: 100 }) =>
  createMockCallerContext({
    db,
    auth: { userId: `${id}-clerk` },
    user: { id, clerkUserId: `${id}-clerk`, countryId: id === "ada" ? "testland" : null, role },
    rateLimitIdentifier: `${id}-${Math.random()}`,
  });

beforeAll(() => {
  const vapid = createECDH("prime256v1");
  vapid.generateKeys();
  Object.assign(process.env, {
    VAPID_PUBLIC_KEY: vapid.getPublicKey("base64url"),
    VAPID_PRIVATE_KEY: vapid.getPrivateKey("base64url"),
    VAPID_SUBJECT: "mailto:ops@example.com",
    EMAIL_API_KEY: "key",
    EMAIL_FROM: "IxStats <notifications@example.com>",
    APP_URL: APP,
  });
});
afterAll(() => {
  process.env = saved;
});

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "debug").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  sent = [];
  emailStatus = 200;
  jest.spyOn(globalThis, "fetch").mockImplementation((async (
    url: string,
    init: { body: string | Uint8Array }
  ) => {
    sent.push({ url, body: init.body });
    const status = url === PUSH_GONE ? 410 : url === EMAIL_API ? emailStatus : 201;
    return { ok: status < 300, status } as Response;
  }) as typeof fetch);

  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "testland", name: "Testland", baselineDate: new Date() });
  for (const id of ["ada", "ben", "admin"]) {
    await db.user.create({
      data: {
        id,
        clerkUserId: `${id}-clerk`,
        countryId: id === "ada" ? "testland" : null,
        lastSeenAt: new Date(),
      },
    });
  }
  // The admin switched ThinkPages notices off in the notification event settings (read once, then cached)
  await db.notificationEventConfig.create({
    data: {
      eventKey: "thinkpagesNotification",
      name: "ThinkPages",
      category: "social",
      enabled: false,
    },
  });
});
afterEach(() => jest.restoreAllMocks());

/** Ada's settings, saved through Settings → Notifications as herself. */
async function adaSetsUp() {
  const ada = preferences(as("ada"));
  expect(await ada.getDeliveryChannels()).toMatchObject({
    email: true,
    push: true,
    pushSubscriptionCount: 0,
  });
  await expect(
    ada.upsertPreferences({ userId: "ben-clerk", economicAlerts: false })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await ada.upsertPreferences({
    userId: "ada-clerk",
    economicAlerts: false,
    notificationLevel: "medium",
    emailNotifications: true,
  });
  await expect(
    ada.savePushSubscription({
      endpoint: "https://push.attacker.example/hook",
      keys: browserKeys(),
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  await ada.savePushSubscription({ endpoint: PUSH_OK, keys: browserKeys() });
  await ada.savePushSubscription({ endpoint: PUSH_GONE, keys: browserKeys() });
}

it("writes and delivers only what the recipient's settings let through, and only the recipient reads it", async () => {
  await adaSetsUp();
  expect(
    (await db.userPreferences.findUniqueOrThrow({ where: { userId: "ada-clerk" } })).emailEnabledAt
  ).toBeInstanceOf(Date);

  // Filtered out by Ada's switches: economic alerts (and packs, filed under them), and below medium urgency.
  // Addressed by her internal id, her Clerk-keyed preferences still apply.
  for (const notice of [
    {
      title: "Market crash",
      userId: "ada-clerk",
      category: "economic" as const,
      priority: "high" as const,
    },
    { title: "Pack opened", userId: "ada", category: "packs" as const, priority: "high" as const },
    {
      title: "Someone waved",
      userId: "ada-clerk",
      category: "social" as const,
      priority: "low" as const,
    },
  ]) {
    expect(await notificationAPI.create(notice)).toBe("");
  }
  await expect(
    notificationAPI.create({ title: "New reply", userId: "ada-clerk", source: "thinkpages" })
  ).rejects.toThrow("thinkpagesNotification is disabled");
  await settle();
  expect(await db.notification.count()).toBe(0);
  expect(sent).toEqual([]);

  // A high-priority diplomatic notice: written, pushed to both browsers, the gone one dropped, emailed once
  const treatyId = await notificationAPI.create({
    title: "Treaty signed",
    message: "Testland and Aurelia signed a trade treaty.",
    userId: "ada-clerk",
    category: "diplomatic",
    priority: "high",
    href: "/mycountry/diplomacy",
  });
  await settle();
  expect(treatyId).not.toBe("");
  expect(pushes().sort()).toEqual([PUSH_GONE, PUSH_OK].sort());
  expect(await db.pushSubscription.findMany({ select: { endpoint: true } })).toEqual([
    { endpoint: PUSH_OK },
  ]);
  expect(emails()).toEqual([
    expect.objectContaining({
      to: ["ada-clerk@example.com"],
      subject: "Treaty signed",
      text: expect.stringContaining(`${APP}/mycountry/diplomacy`),
    }),
  ]);

  // A medium notice is pushed but not emailed; a broadcast and a country notice stay in-app
  sent = [];
  await notificationAPI.create({
    title: "Embassy staffed",
    userId: "ada-clerk",
    category: "diplomatic",
  });
  await notificationAPI.create({ title: "Maintenance tonight" });
  await notificationAPI.create({
    title: "Testland census",
    countryId: "testland",
    category: "economic",
  });
  await settle();
  expect(pushes()).toEqual([PUSH_OK]);
  expect(emails()).toEqual([]);

  // Ben subscribed a browser but switched push off, and never opted into email: his notice stays in-app
  const ben = preferences(as("ben"));
  await ben.savePushSubscription({
    endpoint: "https://fcm.googleapis.com/fcm/send/ben",
    keys: browserKeys(),
  });
  await ben.upsertPreferences({
    userId: "ben-clerk",
    pushNotifications: false,
    systemAlerts: false,
  });
  sent = [];
  await notificationAPI.create({
    title: "Border dispute",
    userId: "ben-clerk",
    category: "diplomatic",
    priority: "high",
  });
  await settle();
  expect(sent).toEqual([]);

  // A bulk batch writes and delivers only the accepted rows with a recipient
  await notificationAPI.createMany([
    { title: "Season starts", userId: "ada-clerk", category: "system", priority: "high" },
    { title: "Season starts", userId: "ben-clerk", category: "system", priority: "high" },
    { title: "Season starts", countryId: "testland", category: "system" },
  ]);
  await settle();
  expect(await db.notification.count({ where: { title: "Season starts" } })).toBe(2);
  expect(
    await db.notification.count({ where: { title: "Season starts", userId: "ben-clerk" } })
  ).toBe(0);
  expect(emails().map((e) => e.to)).toEqual([["ada-clerk@example.com"]]);

  // Admin notices honour the same switches for one user, never for a country or everyone
  const admin = tray(as("admin", { name: "admin", level: 10 }));
  const alert = { type: "system" as const, level: "high" as const, adminUserId: "admin-clerk" };
  expect(
    await admin.createNotification({
      ...alert,
      title: "Tariffs",
      category: "economic",
      userId: "ada-clerk",
    })
  ).toBeNull();
  expect(
    await admin.createNotification({
      ...alert,
      title: "Summit",
      category: "diplomatic",
      userId: "ada-clerk",
    })
  ).toMatchObject({ title: "Summit" });
  expect(
    await admin.createNotification({ ...alert, title: "Patch notes", category: "economic" })
  ).toMatchObject({
    userId: null,
  });
  await expect(
    tray(as("ben")).createNotification({ ...alert, title: "Spoof", userId: "ada-clerk" })
  ).rejects.toThrow(/Admin privileges required/);
  const messaging = createMessagingService({
    db: db as never,
    websocket: { broadcastMessage: jest.fn() } as never,
  });
  expect(
    await messaging.sendAdminBroadcast("admin-clerk", {
      title: "Markets",
      scope: "user",
      userId: "ada-clerk",
      category: "economic",
      level: "high",
    } as never)
  ).toBeNull();
  await messaging.sendAdminBroadcast("admin-clerk", {
    title: "Downtime",
    scope: "global",
  } as never);
  await settle();

  // Ada's tray: her accepted notices, the broadcasts and her country's; Ben cannot touch hers
  const adaTray = tray(as("ada"));
  const { notifications, unreadCount } = await adaTray.getUserNotifications({ limit: 50 });
  expect(notifications.map((n) => n.title).sort()).toEqual(
    [
      "Downtime",
      "Embassy staffed",
      "Maintenance tonight",
      "Patch notes",
      "Season starts",
      "Season starts",
      "Summit",
      "Testland census",
      "Treaty signed",
    ].sort()
  );
  await expect(tray(as("ben")).markAsRead({ notificationId: treatyId })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await adaTray.markAsRead({ notificationId: treatyId });
  expect((await adaTray.getUnreadCount()).count).toBe(unreadCount - 1);
});

it("fails open when a recipient's preferences cannot be read", async () => {
  await preferences(as("ada")).upsertPreferences({ userId: "ada-clerk", economicAlerts: false });
  jest.spyOn(db.userPreferences, "findUnique").mockRejectedValueOnce(new Error("db down"));
  expect(
    await notificationAPI.create({
      title: "Market crash",
      userId: "ada-clerk",
      category: "economic",
    })
  ).not.toBe("");
});

it("emails a digest user one summary per run, retrying a failed send and skipping a run with nothing new", async () => {
  await preferences(as("ben")).upsertPreferences({
    userId: "ben-clerk",
    emailNotifications: true,
    emailDigest: true,
  });
  await notificationAPI.create({
    title: "Bid placed",
    userId: "ben-clerk",
    category: "social",
    priority: "high",
  });
  await notificationAPI.create({
    title: "Bid won",
    userId: "ben",
    category: "social",
    href: "/vault/cards/market",
  });
  await settle();
  // A digest user gets no email per notice
  expect(emails()).toEqual([]);

  const minute = 60_000;
  const start = Date.now();
  const run = (minutes: number) =>
    runNotificationEmailDigest({ now: new Date(start + minutes * minute) });
  const digestAt = async () =>
    (await db.userPreferences.findUniqueOrThrow({ where: { userId: "ben-clerk" } }))
      .lastEmailDigestAt;

  emailStatus = 500;
  expect(await run(1)).toMatchObject({ sent: 0, failed: 1 });
  expect(await digestAt()).toBeNull();

  emailStatus = 200;
  sent = [];
  expect(await run(2)).toMatchObject({ sent: 1 });
  expect(await digestAt()).toEqual(new Date(start + 2 * minute));
  expect(emails()).toEqual([
    expect.objectContaining({
      to: ["ben-clerk@example.com"],
      subject: "Your IxStates summary: 2 new notifications",
      text: expect.stringContaining(`${APP}/vault/cards/market`),
    }),
  ]);

  sent = [];
  expect(await run(3)).toMatchObject({ sent: 0 });
  expect(emails()).toEqual([]);
});

it("offers no channel, refuses subscriptions and sends no digest while delivery is not configured", async () => {
  const configured = {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
  };
  for (const key of Object.keys(configured)) delete process.env[key];
  try {
    const ada = preferences(as("ada"));
    expect(await ada.getDeliveryChannels()).toMatchObject({
      email: false,
      push: false,
      vapidPublicKey: null,
    });
    await expect(
      ada.savePushSubscription({ endpoint: PUSH_OK, keys: browserKeys() })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    await ada.upsertPreferences({
      userId: "ada-clerk",
      emailNotifications: true,
      emailDigest: true,
    });
    await notificationAPI.create({
      title: "Treaty signed",
      userId: "ada-clerk",
      priority: "critical",
    });
    expect(await runNotificationEmailDigest({ now: new Date() })).toEqual({
      skipped: "email is not configured",
      sent: 0,
    });
    await settle();
    expect(sent).toEqual([]);
    // Turning email off withdraws the consent
    await ada.upsertPreferences({ userId: "ada-clerk", emailNotifications: false });
    expect(
      (await db.userPreferences.findUniqueOrThrow({ where: { userId: "ada-clerk" } }))
        .emailEnabledAt
    ).toBeNull();
  } finally {
    Object.assign(process.env, configured);
  }
});

describe("the Web Push wire format", () => {
  it("encrypts exactly as RFC 8291 Appendix A", () => {
    const body = encryptPushPayload(
      Buffer.from("When I grow up, I want to be a watermelon"),
      {
        p256dh:
          "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
        auth: "BTBZMqHH6r4Tts7J_aSIgg",
      },
      {
        salt: Buffer.from("DGv6ra1nlYgDCS1FRnbzlw", "base64url"),
        senderPrivateKey: Buffer.from("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", "base64url"),
      }
    );
    expect(body.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
    );
  });

  it("signs a VAPID JWT for the push service's origin that verifies with the public key", () => {
    const header = vapidAuthorization(PUSH_OK, pushConfig(process.env)!, new Date(0));
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(match[4]).toBe(process.env.VAPID_PUBLIC_KEY);
    expect(JSON.parse(Buffer.from(match[2]!, "base64url").toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 12 * 60 * 60,
      sub: "mailto:ops@example.com",
    });
    const pub = Buffer.from(process.env.VAPID_PUBLIC_KEY!, "base64url");
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33).toString("base64url"),
      },
      format: "jwk",
    });
    const signed = Buffer.from(`${match[1]}.${match[2]}`);
    expect(
      verify(
        "sha256",
        signed,
        { key, dsaEncoding: "ieee-p1363" },
        Buffer.from(match[3]!, "base64url")
      )
    ).toBe(true);
  });

  it("sends only to https endpoints on the known push services", () => {
    const endpoints = [
      PUSH_OK,
      "https://updates.push.services.mozilla.com/wpush/v2/x",
      "http://fcm.googleapis.com/x",
      "https://localhost/x",
      "https://evilfcm.googleapis.com.example/x",
    ];
    expect(endpoints.map((e) => [e, isAllowedPushEndpoint(e)])).toEqual([
      [endpoints[0], true],
      [endpoints[1], true],
      [endpoints[2], false],
      [endpoints[3], false],
      [endpoints[4], false],
    ]);
  });
});
