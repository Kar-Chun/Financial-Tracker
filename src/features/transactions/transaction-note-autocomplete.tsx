import { useEffect, useRef, useState } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"

import { Textarea } from "@/components/ui/textarea"
import { useTransactionNoteSuggestions } from "@/features/transactions/transactions-hooks"
import type { TransactionNoteSuggestion } from "@/features/transactions/transactions-service"
import { isNoteSuggestionQueryEligible } from "@/features/transactions/transactions-service"
import { cn } from "@/lib/utils"

type TransactionNoteAutocompleteProps = {
  enabled: boolean
  entryPage: boolean
  inputValue: string
  onSelect: (suggestion: TransactionNoteSuggestion) => void
  registration: UseFormRegisterReturn<"description">
  transactionType: "expense" | "income" | "transfer"
  userId?: string
}

export function TransactionNoteAutocomplete({
  enabled,
  entryPage,
  inputValue,
  onSelect,
  registration,
  transactionType,
  userId,
}: TransactionNoteAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const suggestionsQuery = useTransactionNoteSuggestions({
    query: inputValue,
    transactionType,
    userId,
    enabled: enabled && open,
  })
  const suggestions = suggestionsQuery.data ?? []
  const canShow = enabled
    && transactionType !== "transfer"
    && isNoteSuggestionQueryEligible(inputValue)
  const panelVisible = open
    && canShow
    && (suggestionsQuery.isDebouncing || suggestionsQuery.isFetching || suggestions.length > 0)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [open])

  const chooseSuggestion = (suggestion: TransactionNoteSuggestion) => {
    onSelect(suggestion)
    inputRef.current?.focus()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Textarea
        className={cn("resize-none", entryPage && "min-h-20 rounded-xl bg-input/30 text-base md:text-sm")}
        rows={entryPage ? 2 : 3}
        aria-label="Note"
        aria-autocomplete="list"
        aria-controls="transaction-note-suggestions"
        aria-expanded={panelVisible}
        placeholder="Caifan, Grab home, lunch with friends…"
        name={registration.name}
        onBlur={registration.onBlur}
        onChange={(event) => {
          void registration.onChange(event)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
          } else if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault()
            optionRefs.current[0]?.focus()
          }
        }}
        ref={(element) => {
          registration.ref(element)
          inputRef.current = element
        }}
      />

      {panelVisible && (
        <div
          id="transaction-note-suggestions"
          role="listbox"
          aria-label="Past transaction Notes"
          className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-40 overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border/60"
        >
          {suggestionsQuery.isDebouncing || suggestionsQuery.isFetching ? (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">Finding past Notes…</p>
          ) : suggestions.map((suggestion, index) => (
            <button
              key={suggestion.note.toLocaleLowerCase()}
              ref={(element) => { optionRefs.current[index] = element }}
              type="button"
              role="option"
              aria-selected="false"
              className="block min-h-12 w-full px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseSuggestion(suggestion)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  optionRefs.current[(index + 1) % suggestions.length]?.focus()
                } else if (event.key === "ArrowUp") {
                  event.preventDefault()
                  if (index === 0) inputRef.current?.focus()
                  else optionRefs.current[index - 1]?.focus()
                } else if (event.key === "Escape") {
                  event.preventDefault()
                  setOpen(false)
                  inputRef.current?.focus()
                }
              }}
            >
              <span className="block truncate text-sm font-medium text-foreground">{suggestion.note}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {suggestion.category_label ?? "No active category"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
