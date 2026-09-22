import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { closeSync, openSync, readFileSync, renameSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

// Match the CLI version recorded by the existing generated artifact.
const supabaseVersion = "2.117.0"
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url))

export function validateGeneratedTypes(filename) {
  const source = readFileSync(filename, "utf8")
  if (!/^export type Json\s*=/u.test(source.trimStart())
    || /(?:Need to install|Ok to proceed|npm (?:warn|error|ERR!)|failed to|error:)/iu.test(source)) {
    throw new Error("Generation output contains CLI chatter or is not a TypeScript schema.")
  }

  const program = ts.createProgram([filename], {
    noEmit: true, strict: true, skipLibCheck: true, types: [],
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  })
  const ast = program.getSourceFile(filename)
  const database = ast?.statements.find((statement) =>
    ts.isTypeAliasDeclaration(statement) && statement.name.text === "Database"
    && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
  const publicSchema = database && ts.isTypeLiteralNode(database.type)
    ? database.type.members.find((member) => member.name?.getText(ast) === "public")
    : undefined
  const sections = publicSchema && ts.isPropertySignature(publicSchema)
    && publicSchema.type && ts.isTypeLiteralNode(publicSchema.type)
    ? publicSchema.type.members.map((member) => member.name?.getText(ast))
    : []

  if (!["Tables", "Views", "Functions", "Enums", "CompositeTypes"].every((name) => sections.includes(name))
    || ts.getPreEmitDiagnostics(program).length > 0) {
    // Do not echo generated content or CLI diagnostics, which may contain credentials.
    throw new Error("Generation output is not a valid public Database TypeScript schema.")
  }
}

export function generateDatabaseTypes({ projectRef, root = repositoryRoot, run = spawnSync }) {
  if (!/^[a-z0-9]{20}$/u.test(projectRef ?? "")) {
    throw new Error("Supply the confirmed project reference: npm run db:types -- --project-ref YOUR_CONFIRMED_PROJECT_REF")
  }
  let linkedRef
  try {
    linkedRef = readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim()
  } catch {
    throw new Error("No local Supabase project link found. Confirm and link the intended project first.")
  }
  if (linkedRef !== projectRef) {
    throw new Error("The confirmed project reference does not match the local Supabase link.")
  }
  const npmCli = process.env.npm_execpath
  if (!npmCli) throw new Error("Run this script through npm run db:types.")

  const destination = path.join(root, "src/types/database.generated.ts")
  // Same directory/filesystem allows a single rename after successful validation.
  const temporary = path.join(path.dirname(destination), `.database-types-${randomUUID()}.ts`)
  const output = openSync(temporary, "wx", 0o600)
  try {
    let result
    try {
      result = run(process.execPath, [
        npmCli, "exec", "--yes", `--package=supabase@${supabaseVersion}`, "--",
        "supabase", "gen", "types", "typescript", "--linked", "--schema", "public",
      ], {
        cwd: root, stdio: ["ignore", output, "pipe"],
        timeout: 120_000, windowsHide: true,
      })
    } finally {
      closeSync(output)
    }
    if (result.error || result.status !== 0) {
      throw new Error("Supabase type generation failed; the existing generated file was preserved. Check CLI authentication and project access.")
    }
    validateGeneratedTypes(temporary)
    renameSync(temporary, destination)
  } finally {
    rmSync(temporary, { force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [flag, projectRef, ...extra] = process.argv.slice(2)
    generateDatabaseTypes({ projectRef: flag === "--project-ref" && extra.length === 0 ? projectRef : undefined })
    console.log("Validated and replaced src/types/database.generated.ts. Review the diff and run tests, lint, and build.")
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Type generation failed.")
    process.exitCode = 1
  }
}
