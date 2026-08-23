import type { ManifestOptions } from "vite-plugin-pwa"

export const pwaManifest = {
  name: "Finance Tracker",
  short_name: "Finance",
  description: "A secure personal finance tracker for accounts, transactions, and spending insights.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0b132b",
  theme_color: "#0b132b",
  lang: "en",
  categories: ["finance", "productivity"],
  icons: [
    { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} satisfies Partial<ManifestOptions>
