/** @jest-environment node */
/**
 * SL-5: email and Web Push delivery, both off unless configured, honouring the user's switches.
 * Providers are mocked; the push encryption is checked against RFC 8291's worked example.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createECDH, createPublicKey, verify } from "node:crypto";
import { deliveryChannels, emailConfig, pushConfig } from "~/lib/notifications/delivery/config";
import { sendEmail } from "~/lib/notifications/delivery/email";
import {
  encryptPushPayload,
  isAllowedPushEndpoint,
  sendWebPush,
  vapidAuthorization,
} from "~/lib/notifications/delivery/web-push";
import { deliverNotification } from "~/lib/notifications/delivery/deliver";
import { runNotificationEmailDigest } from "~/lib/notifications/delivery/digest";
import { createMockPrisma } from "~/tests/helpers/mock-db";

function vapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    VAPID_PUBLIC_KEY: ecdh.getPublicKey("base64url"),
    VAPID_PRIVATE_KEY: ecdh.getPrivateKey("base64url"),
    VAPID_SUBJECT: "mailto:ops@example.com",
  };
}
const EMAIL_ENV = { EMAIL_API_KEY: "key", EMAIL_FROM: "IxStats <n@example.com>" };
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

describe("configuration", () => {
  it("is off without env vars", () => {
    expect(deliveryChannels({})).toEqual({ email: false, push: false, vapidPublicKey: null });
    expect(emailConfig({ EMAIL_API_KEY: "k" })).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "p", VAPID_PRIVATE_KEY: "s" })).toBeNull();
  });

  it("turns each channel on with its variables", () => {
    const keys = vapidKeys();
    expect(deliveryChannels({ ...EMAIL_ENV, ...keys })).toEqual({
      email: true,
      push: true,
      vapidPublicKey: keys.VAPID_PUBLIC_KEY,
    });
    expect(emailConfig(EMAIL_ENV)?.apiUrl).toBe("https://api.resend.com/emails");
  });
});

describe("email sender", () => {
  it("posts Resend-shaped JSON with the bearer key", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const ok = await sendEmail(
      emailConfig(EMAIL_ENV)!,
      { to: "a@b.c", subject: "S", text: "T", html: "<p>T</p>" },
      fetchImpl
    );
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body)).toEqual({
      from: "IxStats <n@example.com>",
      to: ["a@b.c"],
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
  });

  it("resolves false instead of throwing", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    expect(
      await sendEmail(
        emailConfig(EMAIL_ENV)!,
        { to: "a", subject: "", text: "", html: "" },
        fetchImpl
      )
    ).toBe(false);
  });
});

describe("Web Push", () => {
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

  it("signs a VAPID JWT for the push service origin that verifies with the public key", () => {
    const keys = vapidKeys();
    const header = vapidAuthorization(ENDPOINT, pushConfig(keys)!, new Date(0));
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!;
    expect(match[4]).toBe(keys.VAPID_PUBLIC_KEY);
    const claims = JSON.parse(Buffer.from(match[2]!, "base64url").toString());
    expect(claims).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 12 * 60 * 60,
      sub: "mailto:ops@example.com",
    });
    const pub = Buffer.from(keys.VAPID_PUBLIC_KEY, "base64url");
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33).toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${match[1]}.${match[2]}`),
        { key, dsaEncoding: "ieee-p1363" },
        Buffer.from(match[3]!, "base64url")
      )
    ).toBe(true);
  });

  it("only accepts https endpoints on known push services", () => {
    expect(isAllowedPushEndpoint(ENDPOINT)).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(
      true
    );
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evilfcm.googleapis.com.example/x")).toBe(false);
  });

  it("posts an aes128gcm body and reports a gone subscription", async () => {
    const receiver = createECDH("prime256v1");
    receiver.generateKeys();
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 410 });
    const result = await sendWebPush(
      pushConfig(vapidKeys())!,
      {
        endpoint: ENDPOINT,
        p256dh: receiver.getPublicKey("base64url"),
        auth: Buffer.alloc(16, 1).toString("base64url"),
      },
      { title: "T", body: "B" },
      { fetchImpl }
    );
    expect(result).toEqual({ ok: false, gone: true, status: 410 });
    expect(fetchImpl.mock.calls[0]![1].headers).toMatchObject({
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
    });
  });
});

describe("deliverNotification", () => {
  function setup(prefs: Record<string, unknown> | null) {
    const db = createMockPrisma();
    db.userPreferences.findUnique.mockResolvedValue(prefs);
    db.pushSubscription.findMany.mockResolvedValue([
      { id: "s1", endpoint: ENDPOINT, p256dh: "p", auth: "a" },
      { id: "s2", endpoint: ENDPOINT + "2", p256dh: "p", auth: "a" },
    ]);
    const sendPush = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, gone: false })
      .mockResolvedValueOnce({ ok: false, gone: true });
    const sendEmail = jest.fn().mockResolvedValue(true);
    const resolveEmail = jest.fn().mockResolvedValue("player@example.com");
    return { db, sendPush, sendEmail, resolveEmail };
  }
  const notification = {
    userId: "user_1",
    title: "Crisis",
    message: "Border incident",
    href: "/mycountry",
    priority: "high",
  };
  const optedIn = {
    pushNotifications: true,
    emailNotifications: true,
    emailEnabledAt: new Date(),
    emailDigest: false,
  };

  it("does nothing while no channel is configured", async () => {
    const deps = setup(optedIn);
    await deliverNotification(notification, { ...deps, db: deps.db as never, env: {} });
    expect(deps.db.userPreferences.findUnique).not.toHaveBeenCalled();
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("pushes to every subscription and deletes a gone one", async () => {
    const deps = setup(optedIn);
    await deliverNotification(notification, { ...deps, db: deps.db as never, env: vapidKeys() });
    expect(deps.sendPush).toHaveBeenCalledTimes(2);
    expect(deps.sendPush.mock.calls[0]![2]).toEqual({
      title: "Crisis",
      body: "Border incident",
      href: "/mycountry",
    });
    expect(deps.sendPush.mock.calls[0]![3]).toEqual({ urgency: "high" });
    expect(deps.db.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: "s2" } });
  });

  it("respects the push switch", async () => {
    const deps = setup({ ...optedIn, pushNotifications: false });
    await deliverNotification(notification, { ...deps, db: deps.db as never, env: vapidKeys() });
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it("emails high-priority notifications to opted-in users with an absolute link", async () => {
    const deps = setup(optedIn);
    await deliverNotification(notification, {
      ...deps,
      db: deps.db as never,
      env: { ...EMAIL_ENV, APP_URL: "https://ixwiki.com/projects/ixstats" },
    });
    expect(deps.resolveEmail).toHaveBeenCalledWith("user_1");
    const message = deps.sendEmail.mock.calls[0]![1];
    expect(message).toMatchObject({ to: "player@example.com", subject: "Crisis" });
    expect(message.text).toContain("https://ixwiki.com/projects/ixstats/mycountry");
  });

  it("does not email low priorities, digest users, or users who never opted in", async () => {
    for (const [prefs, priority] of [
      [optedIn, "medium"],
      [{ ...optedIn, emailDigest: true }, "high"],
      [{ ...optedIn, emailEnabledAt: null }, "high"],
      [{ ...optedIn, emailNotifications: false }, "critical"],
      [null, "critical"],
    ] as const) {
      const deps = setup(prefs);
      await deliverNotification(
        { ...notification, priority },
        { ...deps, db: deps.db as never, env: EMAIL_ENV }
      );
      expect(deps.sendEmail).not.toHaveBeenCalled();
    }
  });
});

describe("daily email digest job", () => {
  const now = new Date("2026-10-06T08:07:00Z");

  it("is a no-op while email is not configured", async () => {
    const db = createMockPrisma();
    expect(await runNotificationEmailDigest({ db: db as never, env: {}, now })).toEqual({
      skipped: "email is not configured",
      sent: 0,
    });
    expect(db.userPreferences.findMany).not.toHaveBeenCalled();
  });

  it("emails a summary of unread notifications since the last digest and advances it", async () => {
    const db = createMockPrisma();
    db.userPreferences.findMany.mockResolvedValue([
      { userId: "user_a", lastEmailDigestAt: new Date("2026-10-06T00:00:00Z") },
      { userId: "user_quiet", lastEmailDigestAt: null },
    ]);
    db.user.findFirst.mockResolvedValue({ id: "db_a" });
    db.notification.count.mockImplementation(async (args: any) =>
      args.where.userId.in.includes("user_a") ? 2 : 0
    );
    db.notification.findMany.mockResolvedValue([
      { title: "Election called", message: "Polls open", description: null, href: "/elections" },
      { title: "Trade offer", message: null, description: "From Caphiria", href: null },
    ]);
    const sendEmail = jest.fn().mockResolvedValue(true);

    const result = await runNotificationEmailDigest({
      db: db as never,
      env: EMAIL_ENV,
      now,
      sendEmail,
      resolveEmail: async () => "a@example.com",
    });

    expect(result).toEqual({ users: 2, sent: 1, failed: 0 });
    expect(db.userPreferences.findMany.mock.calls[0]![0].where).toEqual({
      emailDigest: true,
      emailNotifications: true,
      emailEnabledAt: { not: null },
    });
    const where = db.notification.count.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      userId: { in: ["user_a", "db_a"] },
      createdAt: { gt: new Date("2026-10-06T00:00:00Z") },
      read: false,
      dismissed: false,
    });
    const message = sendEmail.mock.calls[0]![1];
    expect(message.subject).toBe("Your IxStats summary: 2 new notifications");
    expect(message.text).toContain("Election called");
    expect(db.userPreferences.update).toHaveBeenCalledWith({
      where: { userId: "user_a" },
      data: { lastEmailDigestAt: now },
    });
  });

  it("keeps the digest time when the send fails, so the next run retries", async () => {
    const db = createMockPrisma();
    db.userPreferences.findMany.mockResolvedValue([{ userId: "user_a", lastEmailDigestAt: null }]);
    db.notification.count.mockResolvedValue(1);
    db.notification.findMany.mockResolvedValue([{ title: "X", message: null, href: null }]);
    const result = await runNotificationEmailDigest({
      db: db as never,
      env: EMAIL_ENV,
      now,
      sendEmail: async () => false,
      resolveEmail: async () => "a@example.com",
    });
    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect(db.userPreferences.update).not.toHaveBeenCalled();
  });
});
