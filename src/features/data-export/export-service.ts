import { getSupabaseClient } from "@/lib/supabase"
import { parseRpcResponse } from "@/lib/rpc-validation"
import { exportResponseSchema, type ExportResponse } from "./export-schema"
import { createExportZip } from "./export-package"

let preparing = false

export async function prepareDataExport(userId: string) {
  if (preparing) throw new Error("An export is already being prepared.")
  if (!navigator.onLine) throw new Error("Export requires a connection.")
  preparing = true
  try {
    const client = getSupabaseClient()
    const assertCurrentUser = async () => {
      const { data, error } = await client.auth.getSession()
      if (error || data.session?.user.id !== userId) throw new Error("Export session changed.")
    }
    await assertCurrentUser()
    const { data, error } = await client.rpc("export_user_data_v1")
    if (error) throw new Error("Export could not be prepared.")
    const response = parseRpcResponse(exportResponseSchema, data)
    assertExportOwner(response, userId)
    const file = await createExportZip(response, readDevicePreference(response))
    await assertCurrentUser()
    return file
  } finally {
    preparing = false
  }
}

export function assertExportOwner(response: ExportResponse, userId: string) {
  if (response.data.profiles[0].id !== userId) throw new Error("Export owner mismatch.")
  for (const rows of Object.values(response.data)) {
    for (const row of rows) {
      if ("user_id" in row && row.user_id !== userId) throw new Error("Export owner mismatch.")
    }
  }
}

function readDevicePreference(response: ExportResponse) {
  try {
    const userId = response.data.profiles[0].id
    const accountId = localStorage.getItem(`finance-tracker:last-expense-account:${userId}`)
    return response.data.accounts.some((account) => account.id === accountId && account.archived_at === null
      && ["bank", "cash"].includes(account.account_type)) ? accountId : null
  } catch {
    return null
  }
}
