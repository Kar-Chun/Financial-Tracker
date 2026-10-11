import { describe, expect, it } from "vitest"

import { pwaManifest } from "@/app/pwa-manifest"

describe("PWA manifest", () => {
  it("defines standalone installation and the required icon sizes", () => {
    expect(pwaManifest).toMatchObject({
      display: "standalone",
      start_url: "/",
    })
    expect(pwaManifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]))
  })
})
