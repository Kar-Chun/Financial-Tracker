import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Settings } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PwaInstallCard } from "@/components/shared/pwa-install-card"
import { useProfile, useUpdateProfile } from "@/features/auth/profile-service"
import { CategoryManagement } from "@/features/categories/category-management"
import { getErrorMessage } from "@/lib/errors"

const profileSchema = z.object({
  displayName: z.string().trim().max(100, "Display name is too long."),
  timezone: z.string().min(1, "Timezone is required."),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const timezones = ["Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "Australia/Sydney", "UTC"]

export function SettingsPage() {
  const profileQuery = useProfile()
  const mutation = useUpdateProfile()
  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: "", timezone: "Asia/Singapore" },
  })

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        displayName: profileQuery.data.display_name ?? "",
        timezone: profileQuery.data.timezone,
      })
    }
  }, [profileQuery.data, reset])

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values, {
      onSuccess: () => toast.success("Profile settings updated."),
      onError: (error) => toast.error(getErrorMessage(error, "Profile settings could not be updated.")),
    })
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="eyebrow">Workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your profile preferences and transaction categories.</p>
      </header>

      {profileQuery.isLoading ? <Skeleton className="h-96 max-w-2xl rounded-xl" /> : profileQuery.isError ? (
        <Card className="border-destructive/30"><CardContent className="py-10">Profile settings could not be loaded.</CardContent></Card>
      ) : (
        <Card className="max-w-2xl border-0 bg-card/65 shadow-none ring-1 ring-white/4">
          <CardHeader className="border-b border-border/25">
            <CardTitle className="flex items-center gap-2"><Settings className="size-4" /> Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input {...register("displayName")} />
                {errors.displayName && <p className="text-xs text-destructive">{errors.displayName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Base currency</Label>
                <Input value={profileQuery.data?.base_currency ?? "SGD"} disabled />
                <p className="text-xs leading-5 text-muted-foreground">
                  Base currency is locked in V1 so historical snapshots and manual investment valuations cannot be silently invalidated.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Controller
                  name="timezone"
                  control={control}
                  render={({ field }) => (
                    <Select
                      items={timezones.map((timezone) => ({ value: timezone, label: timezone }))}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {timezones.map((timezone) => <SelectItem key={timezone} value={timezone}>{timezone}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">Used to determine your local daily snapshot date.</p>
              </div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <LoaderCircle className="animate-spin" />}
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <CategoryManagement />
      <PwaInstallCard />
    </div>
  )
}
