import { describe, expect, it } from "vitest"

import { pwaManifest } from "@/app/pwa-manifest"

describe("PWA manifest", () => {
  it("contains installable Finance Tracker metadata and required icons", () => {
    expect(pwaManifest).toMatchObject({
      name: "Finance Tracker",
      short_name: "Finance",
      display: "standalone",
      start_url: "/",
      background_color: "#0b132b",
      theme_color: "#0b132b",
    })
    expect(pwaManifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]))
  })
})
