import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

type Header = { key: string; value: string }
const config = JSON.parse(readFileSync(resolve("vercel.json"), "utf8")) as {
  headers: Array<{ source: string; headers: Header[] }>
  rewrites: Array<{ source: string; destination: string }>
}
const headers = new Map(config.headers[0].headers.map(({ key, value }) => [key.toLowerCase(), value]))
const csp = headers.get("content-security-policy-report-only")!
const entries = csp.split(";").map((directive) => directive.trim().split(/\s+/))
const policy = new Map(entries.map(([name, ...sources]) => [name, sources]))

describe("repository-controlled browser headers", () => {
  it("applies well-formed low-risk headers to app routes and assets", () => {
    expect(config.headers).toHaveLength(1)
    expect(config.headers[0].source).toBe("/(.*)")
    expect(headers.size).toBe(config.headers[0].headers.length)
    for (const { key, value } of config.headers[0].headers) {
      expect(key).toMatch(/^[A-Za-z-]+$/)
      expect(value).not.toMatch(/[\r\n]/)
      expect(value.length).toBeGreaterThan(0)
    }
    expect(headers.get("x-content-type-options")).toBe("nosniff")
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
    expect(headers.get("x-frame-options")).toBe("DENY")
    expect(headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=(), web-share=(self)")
  })

  it("keeps the compatibility policy report-only without third-party reporting or unverified HSTS", () => {
    expect(headers.has("content-security-policy")).toBe(false)
    expect(headers.has("strict-transport-security")).toBe(false)
    expect(policy.size).toBe(entries.length)
    expect(policy.has("report-uri")).toBe(false)
    expect(policy.has("report-to")).toBe(false)
    expect(headers.has("reporting-endpoints")).toBe(false)
  })

  it("would restrict arbitrary external resources, eval, inline scripts, objects and framing", () => {
    expect(policy.get("default-src")).toEqual(["'self'"])
    expect(policy.get("script-src")).toEqual(["'self'"])
    expect(policy.get("object-src")).toEqual(["'none'"])
    expect(policy.get("frame-src")).toEqual(["'none'"])
    expect(policy.get("frame-ancestors")).toEqual(["'none'"])
    expect(policy.get("base-uri")).toEqual(["'self'"])
    expect(policy.get("form-action")).toEqual(["'self'"])
    expect(csp).not.toMatch(/unsafe-eval|\*|https:;|data:/)
    expect(policy.get("style-src")).toEqual(["'self'", "'unsafe-inline'"])
  })

  it("allows only the inventoried Supabase HTTPS origin and same-origin connections", () => {
    const origin = "https://vhjnmmkagupbnssjjcmh.supabase.co"
    expect(policy.get("connect-src")).toEqual(["'self'", origin])
    // Catch a configured deployment moving projects without reviewing its policy.
    if (import.meta.env.VITE_SUPABASE_URL) expect(new URL(import.meta.env.VITE_SUPABASE_URL).origin).toBe(origin)
    expect(csp).not.toMatch(/wss?:|googleapis|push\.apple|supabase\.co\//)
  })

  it("allows local fonts/icons/manifest and only the necessary Blob worker capability", () => {
    for (const directive of ["font-src", "img-src", "manifest-src"]) expect(policy.get(directive)).toEqual(["'self'"])
    expect(policy.get("worker-src")).toEqual(["'self'", "blob:"])
    expect([...policy].filter(([, sources]) => sources.includes("blob:")).map(([name]) => name)).toEqual(["worker-src"])
  })

  it("preserves SPA fallback and static-only service worker caching", () => {
    expect(config.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }])
    const worker = readFileSync(resolve("src/service-worker.ts"), "utf8")
    expect(worker).toContain("precacheAndRoute(self.__WB_MANIFEST)")
    expect(worker).toContain('createHandlerBoundToURL("/index.html")')
    expect(worker).not.toMatch(/NetworkFirst|CacheFirst|StaleWhileRevalidate|BackgroundSync|supabase/)
  })
})
