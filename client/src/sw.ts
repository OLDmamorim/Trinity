/// <reference lib="webworker" />
// Service worker: guarda a app em cache e mostra as notificações push.
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  const dados = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { corpo: event.data?.text() };
    }
  })() as { titulo?: string; corpo?: string; url?: string };
  event.waitUntil(
    self.registration.showNotification(dados.titulo ?? "Trinity", {
      body: dados.corpo ?? "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      data: { url: dados.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => "focus" in j);
      if (aberta) return (aberta as WindowClient).focus();
      return self.clients.openWindow(url);
    }),
  );
});
