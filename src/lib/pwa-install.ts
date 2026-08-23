import { useSyncExternalStore } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function initialiseInstallPromptCapture() {
  if (typeof window === "undefined") return
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

export function usePwaInstall() {
  const canInstall = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => deferredPrompt !== null,
    () => false,
  )
  const isStandalone = typeof window !== "undefined"
    && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)

  return {
    canInstall,
    isIos,
    isStandalone,
    install: async () => {
      if (!deferredPrompt) return false
      const prompt = deferredPrompt
      await prompt.prompt()
      const choice = await prompt.userChoice
      deferredPrompt = null
      listeners.forEach((listener) => listener())
      return choice.outcome === "accepted"
    },
  }
}
