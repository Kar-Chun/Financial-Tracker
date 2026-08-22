import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, LoaderCircle, LockKeyhole, MailCheck } from "lucide-react"
import { cloneElement, isValidElement, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { z } from "zod"

import { AppLogo } from "@/components/shared/app-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/auth-context"
import { signIn, signUp } from "@/features/auth/auth-service"
import { getErrorMessage } from "@/lib/errors"

const authSchema = z.object({
  displayName: z.string().trim().max(100, "Display name is too long."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters."),
})

type AuthFormValues = z.infer<typeof authSchema>

type AuthPageProps = {
  mode: "login" | "signup"
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === "login"
  const navigate = useNavigate()
  const location = useLocation()
  const { configurationError } = useAuth()
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  })

  const mutation = useMutation({
    mutationFn: async (values: AuthFormValues) => {
      if (isLogin) return signIn(values.email, values.password)
      return signUp(values)
    },
    onSuccess: (data, values) => {
      if (!data.session) {
        setConfirmationEmail(values.email)
        return
      }

      const requestedPath = (location.state as { from?: string } | null)?.from
      navigate(requestedPath ?? "/dashboard", { replace: true })
    },
  })

  if (confirmationEmail) {
    return (
      <AuthFrame>
        <Card className="shadow-lg shadow-slate-950/5">
          <CardContent className="py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="size-6" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              We sent a confirmation link to <strong>{confirmationEmail}</strong>.
              Confirm your account, then return here to log in.
            </p>
            <Button className="mt-6" variant="outline" onClick={() => navigate("/login")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <Card className="shadow-lg shadow-slate-950/5">
        <CardHeader className="text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="font-heading text-xl font-medium leading-snug">
            {isLogin ? "Welcome back" : "Create your workspace"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLogin
              ? "Sign in to your private financial workspace."
              : "Start tracking your finances securely."}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            {!isLogin && (
              <FormField label="Display name" error={errors.displayName?.message}>
                <Input
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  aria-invalid={Boolean(errors.displayName)}
                  {...register("displayName")}
                />
              </FormField>
            )}
            <FormField label="Email" error={errors.email?.message}>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </FormField>
            <FormField label="Password" error={errors.password?.message}>
              <Input
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </FormField>

            {(configurationError || mutation.error) && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {configurationError ?? getErrorMessage(mutation.error, "Authentication failed. Please try again.")}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={mutation.isPending || Boolean(configurationError)}
            >
              {mutation.isPending && <LoaderCircle className="animate-spin" />}
              {isLogin ? "Log in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isLogin ? "New to Ledgerly?" : "Already have an account?"}{" "}
            <Link
              to={isLogin ? "/signup" : "/login"}
              className="font-medium text-primary hover:underline"
            >
              {isLogin ? "Sign up" : "Log in"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  )
}

export function LoginPage() {
  return <AuthPage mode="login" />
}

export function SignupPage() {
  return <AuthPage mode="signup" />
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <AppLogo />
        </div>
        {children}
        <Link
          to="/"
          className="mx-auto mt-6 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back home
        </Link>
      </div>
    </main>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  const inputId = label.toLowerCase().replaceAll(" ", "-")
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {isValidElement<{ id?: string }>(children)
        ? cloneElement(children, { id: inputId })
        : children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
