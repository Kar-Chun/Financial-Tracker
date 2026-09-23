export function canShareExport(file: File) {
  const mobileOrInstalled = window.matchMedia("(pointer: coarse)").matches
    || window.matchMedia("(display-mode: standalone)").matches
  try {
    return mobileOrInstalled && typeof navigator.share === "function"
      && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export function downloadExport(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    // Allow the browser to consume the link before releasing the object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
