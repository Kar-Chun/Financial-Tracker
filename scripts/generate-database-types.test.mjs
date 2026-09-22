import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generateDatabaseTypes } from "./generate-database-types.mjs"

const projectRef = "abcdefghijklmnopqrst"
const validSchema = `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: { accounts: { Row: { id: string }; Insert: { id: string }; Update: { id?: string }; Relationships: [] } }
    Views: { [_ in never]: never }
    Functions: { get_total: { Args: never; Returns: number } }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
`
let root
let destination

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "ledgerly-types-test-"))
  mkdirSync(path.join(root, "supabase/.temp"), { recursive: true })
  mkdirSync(path.join(root, "src/types"), { recursive: true })
  writeFileSync(path.join(root, "supabase/.temp/project-ref"), projectRef)
  destination = path.join(root, "src/types/database.generated.ts")
  writeFileSync(destination, "existing schema must survive\r\n")
  vi.stubEnv("npm_execpath", path.join(root, "npm-cli.cjs"))
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

function expectPreserved() {
  expect(readFileSync(destination, "utf8")).toBe("existing schema must survive\r\n")
  expect(readdirSync(path.dirname(destination))).toEqual(["database.generated.ts"])
}

function cliOutput(source, exitCode = 0) {
  return vi.fn((_executable, _args, options) => {
    expectPreservedDuringGeneration()
    // Exercise actual child-process stdout/stderr separation and file descriptors.
    return spawnSync(process.execPath, ["-e", `process.stdout.write(${JSON.stringify(source)}); process.stderr.write('private CLI diagnostic'); process.exitCode = ${exitCode}`], options)
  })
}

function expectPreservedDuringGeneration() {
  expect(readFileSync(destination, "utf8")).toBe("existing schema must survive\r\n")
  expect(readdirSync(path.dirname(destination)).filter((name) => name.startsWith(".database-types-"))).toHaveLength(1)
}

// Subprocess startup and compiler checks can exceed 5s under full-suite contention.
describe("safe Supabase type generation", { timeout: 15_000 }, () => {
  it("replaces only validated output through a temporary file and isolates stderr", () => {
    const run = cliOutput(validSchema)
    generateDatabaseTypes({ projectRef, root, run })
    expect(readFileSync(destination, "utf8")).toBe(validSchema)
    expect(readdirSync(path.dirname(destination))).toEqual(["database.generated.ts"])
    expect(run).toHaveBeenCalledWith(process.execPath, [
      process.env.npm_execpath, "exec", "--yes", "--package=supabase@2.117.0", "--",
      "supabase", "gen", "types", "typescript", "--linked", "--schema", "public",
    ], expect.objectContaining({ cwd: root, timeout: 120_000, windowsHide: true }))
  })

  it.each([
    ["install prompt", "Need to install the following packages:\nsupabase@2.117.0\nOk to proceed? (y)\n" + validSchema],
    ["commented prompt", "// Need to install the following packages:\n" + validSchema],
    ["trailing error", validSchema + "// npm error generation failed\n"],
    ["empty output", ""],
    ["truncated schema", validSchema.slice(0, -4)],
    ["missing public schema", "export type Json = string\nexport type Database = {}\n"],
    ["invalid TypeScript type", validSchema.replace("id: string", "id: MissingType")],
  ])("rejects %s without overwriting the destination", (_label, source) => {
    expect(() => generateDatabaseTypes({ projectRef, root, run: cliOutput(source) })).toThrow()
    expectPreserved()
  })

  it("preserves the destination on nonzero CLI exit even with valid stdout", () => {
    expect(() => generateDatabaseTypes({ projectRef, root, run: cliOutput(validSchema, 1) })).toThrow("generation failed")
    expectPreserved()
  })

  it("preserves the destination on a CLI launch error or timeout", () => {
    const run = () => ({ status: null, error: new Error("private launch diagnostic") })
    expect(() => generateDatabaseTypes({ projectRef, root, run })).toThrow("generation failed")
    expectPreserved()
  })

  it.each([undefined, "invalid", "zyxwvutsrqponmlkjihg"])("refuses missing, malformed, or mismatched confirmation (%s)", (confirmedRef) => {
    const run = vi.fn()
    expect(() => generateDatabaseTypes({ projectRef: confirmedRef, root, run })).toThrow()
    expect(run).not.toHaveBeenCalled()
    expectPreserved()
  })

  it("refuses an unlinked project before invoking the CLI", () => {
    unlinkSync(path.join(root, "supabase/.temp/project-ref"))
    const run = vi.fn()
    expect(() => generateDatabaseTypes({ projectRef, root, run })).toThrow("No local Supabase project link")
    expect(run).not.toHaveBeenCalled()
    expectPreserved()
  })
})
