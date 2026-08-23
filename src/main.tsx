import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "@/App"
import { AppProviders } from "@/app/providers"
import { initialiseInstallPromptCapture } from "@/lib/pwa-install"
import "@/index.css"

document.documentElement.classList.add("dark")
initialiseInstallPromptCapture()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
