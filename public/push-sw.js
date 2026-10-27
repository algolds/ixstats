// push-sw.js
// Web Push service worker (SL-5). Registered by Settings > Notifications with the scope
// `/push/`, so it never controls or caches pages: it only shows pushed notifications and opens
// their link when clicked. Payload: { title, body, href, tag } (src/lib/notifications/delivery).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "IxStats";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined,
      icon: new URL("../favicon.ico", self.registration.scope).href,
      data: { href: data.href || new URL("..", self.registration.scope).href },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.href || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
