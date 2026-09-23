/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core"
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

import { handleNotificationClickEvent, handlePushEvent } from "./service-worker-handlers"

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")))

self.addEventListener("push", (event) => handlePushEvent(event, self))
self.addEventListener("notificationclick", (event) => handleNotificationClickEvent(event, self))
