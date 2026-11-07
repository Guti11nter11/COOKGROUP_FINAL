// Service worker de GIRA: la app abre sin conexión (último estado guardado) y recibe notificaciones.
const SHELL = "gira-shell-v1";
const FILES = ["/app/", "/app/app.css", "/app/app.js", "/app/manifest.webmanifest", "/app/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || !url.pathname.startsWith("/app/")) return;
  // Red primero (siempre lo último); si no hay red, la copia guardada.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/app/"))),
  );
});
self.addEventListener("push", (e) => {
  let msg = { title: "GIRA", body: "", url: "/app/" };
  try { msg = { ...msg, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, tag: msg.tag, data: { url: msg.url }, icon: "/app/icon-192.png", badge: "/app/icon-192.png" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/app/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes("/app/")) { c.navigate(target); return c.focus(); }
      return self.clients.openWindow(target);
    }),
  );
});
