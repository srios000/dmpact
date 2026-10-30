"use client"

import * as React from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { BadgeDollarSignIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react"
import { saveRateCard } from "@/app/settings/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type RateCardFormValues = {
  currency: string
  paypalEmail: string
  defaultDepositPct: string
  mismatchThresholdPct: string
  services: Record<string, string>
  extras: Record<string, string>
  updatedAtLabel: string
  source: "default" | "cookie" | "database"
}

type RateCardActionState = {
  status: "idle" | "success" | "error"
  message: string
  values: RateCardFormValues
}

type RateField = {
  key: string
  label: string
  description: string
}

type RateCardFormProps = {
  initialState: RateCardActionState
  serviceFields: readonly RateField[]
  extraFields: readonly RateField[]
}

function SaveButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-10 rounded-xl px-5 text-[13px] font-bold shadow-lg shadow-primary/20"
    >
      {pending ? "Saving..." : "Save Rate Card"}
    </Button>
  )
}

function Field({
  label,
  hint,
  name,
  value,
  onChange,
  prefix,
  suffix,
  type = "text",
  inputMode,
  placeholder,
}: {
  label: string
  hint: string
  name: string
  value: string
  onChange: (name: string, value: string) => void
  prefix?: string
  suffix?: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
}) {
  return (
    <label className="grid gap-2">
      <div className="space-y-0.5">
        <span className="text-[12px] font-black tracking-[0.12em] text-foreground uppercase">{label}</span>
        <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[12px] font-bold text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          placeholder={placeholder}
          className={`h-11 rounded-2xl border-border bg-background text-[13px] font-semibold ${
            prefix ? "pl-8" : ""
          } ${suffix ? "pr-12" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12px] font-bold text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  )
}

export function RateCardForm({ initialState, serviceFields, extraFields }: RateCardFormProps) {
  const [state, formAction] = useActionState(saveRateCard, initialState)
  const [values, setValues] = React.useState(initialState.values)

  React.useEffect(() => {
    setValues(state.values)
  }, [state.values])

  const totalStarterEstimate = React.useMemo(() => {
    const mix = Number(values.services.mixMaster || 0)
    const revision = Number(values.extras.extraRevision || 0)
    const usage = Number(values.extras.commercialUsage || 0)

    return (mix + revision + usage).toFixed(2)
  }, [values.extras.commercialUsage, values.extras.extraRevision, values.services.mixMaster])

  function updateField(name: string, nextValue: string) {
    if (name.startsWith("service-")) {
      const key = name.replace("service-", "")
      setValues((current) => ({
        ...current,
        services: {
          ...current.services,
          [key]: nextValue,
        },
      }))
      return
    }

    if (name.startsWith("extra-")) {
      const key = name.replace("extra-", "")
      setValues((current) => ({
        ...current,
        extras: {
          ...current.extras,
          [key]: nextValue,
        },
      }))
      return
    }

    setValues((current) => ({
      ...current,
      [name]: nextValue,
    }))
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6">
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardHeader className="flex flex-col gap-4 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-[17px] font-black tracking-tight text-foreground uppercase">
                  Rate Card Settings
                </CardTitle>
                <p className="max-w-2xl text-[13px] font-medium leading-relaxed text-muted-foreground">
                  Set your default pricing once so AI can follow your real rates instead of guessing.
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  state.status === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : state.status === "error"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {state.status === "idle" ? values.updatedAtLabel : state.message}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  Default Deposit
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {values.defaultDepositPct}%
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  Currency
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{values.currency}</p>
              </div>
              <div className="rounded-3xl border border-border bg-background p-4">
                <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                  Mismatch Threshold
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-foreground">
                  {values.mismatchThresholdPct}%
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 pt-0 md:p-8 md:pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Currency"
                hint="Use a 3-letter currency code supported by PayPal."
                name="currency"
                value={values.currency}
                onChange={updateField}
                placeholder="USD"
              />
              <Field
                label="PayPal Email"
                hint="Used as the default payout and invoicing address."
                name="paypalEmail"
                value={values.paypalEmail}
                onChange={updateField}
                placeholder="creator@example.com"
                type="email"
              />
              <Field
                label="Default Deposit"
                hint="Applied to new commissions unless you override it later."
                name="defaultDepositPct"
                value={values.defaultDepositPct}
                onChange={updateField}
                suffix="%"
                inputMode="numeric"
              />
              <Field
                label="Mismatch Threshold"
                hint="Warn the AI when the client budget falls too far under your estimate."
                name="mismatchThresholdPct"
                value={values.mismatchThresholdPct}
                onChange={updateField}
                suffix="%"
                inputMode="numeric"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-6 pb-4 md:p-8 md:pb-4">
            <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
              Base Service Prices
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 pt-0 md:grid-cols-2 md:p-8 md:pt-0">
            {serviceFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint={field.description}
                name={`service-${field.key}`}
                value={values.services[field.key] ?? ""}
                onChange={updateField}
                prefix="$"
                inputMode="decimal"
              />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-6 pb-4 md:p-8 md:pb-4">
            <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
              Extras and Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 p-6 pt-0 md:grid-cols-2 md:p-8 md:pt-0">
            {extraFields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint={field.description}
                name={`extra-${field.key}`}
                value={values.extras[field.key] ?? ""}
                onChange={updateField}
                prefix="$"
                inputMode="decimal"
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:sticky xl:top-6 xl:self-start">
        <Card className="rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <BadgeDollarSignIcon className="size-5" />
              </div>
              <div>
                <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
                  Quick Preview
                </CardTitle>
                <p className="text-[12px] font-medium text-muted-foreground">{values.updatedAtLabel}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <div className="rounded-3xl border border-border bg-background p-4">
              <p className="text-[11px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                Starter Estimate
              </p>
              <p className="mt-2 text-[28px] font-black tracking-tight text-foreground">${totalStarterEstimate}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">
                Mix & master + 1 extra revision + commercial usage.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-0.5 size-4 text-primary" />
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-foreground">AI pricing guardrail</p>
                  <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                    The assistant should follow this rate card strictly when drafting prices or mismatch notices.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="mt-0.5 size-4 text-emerald-600" />
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-foreground">Save behavior</p>
                  <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
                    Values are saved to the database when available. If local DB access fails, the form still keeps a
                    preview copy so your demo flow stays usable.
                  </p>
                </div>
              </div>
            </div>

            <SaveButton />
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
