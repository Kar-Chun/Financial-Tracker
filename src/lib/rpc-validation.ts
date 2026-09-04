import type { z } from "zod"

export class UnexpectedRpcResponseError extends Error {
  constructor() {
    super("The server returned an unexpected response. Please try again.")
    this.name = "UnexpectedRpcResponseError"
  }
}

export function parseRpcResponse<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value)
  if (!result.success) throw new UnexpectedRpcResponseError()
  return result.data
}
