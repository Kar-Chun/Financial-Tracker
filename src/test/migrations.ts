import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

const directory = resolve(process.cwd(), "supabase/migrations")
export const migrationNames = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()
export const migrationSources = migrationNames.map((name) => readFileSync(resolve(directory, name), "utf8"))

// These helpers inspect versioned SQL; they do not execute it or verify deployed state.
export function latestFunctionDefinition(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error("Invalid SQL function name in test.")
  const pattern = new RegExp(`create (?:or replace )?function public\\.${name}\\s*\\([\\s\\S]*?\\$\\$;`, "gi")
  for (const source of [...migrationSources].reverse()) {
    const definitions = [...source.matchAll(pattern)]
    const definition = definitions.at(-1)?.[0]
    if (definition) return definition
  }
  throw new Error(`No migration defines public.${name}.`)
}
