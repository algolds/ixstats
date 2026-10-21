/** @jest-environment node */
/**
 * SL-5: email and Web Push delivery, both off unless configured, honouring the user's switches.
 * Providers are mocked; the push encryption is checked against RFC 8291's worked example.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { createECDH, createPublicKey, verify } from "node:crypto";
import { pushConfig } from "~/lib/notifications/delivery/config";
import {
  encryptPushPayload,
  isAllowedPushEndpoint,
  vapidAuthorization,
} from "~/lib/notifications/delivery/web-push";

function vapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    VAPID_PUBLIC_KEY: ecdh.getPublicKey("base64url"),
    VAPID_PRIVATE_KEY: ecdh.getPrivateKey("base64url"),
    VAPID_SUBJECT: "mailto:ops@example.com",
  };
}

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
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
});
