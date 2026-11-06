"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { get, useForm, type FieldErrors } from "react-hook-form";
import { CircleAlertIcon, CircleCheckIcon, SaveIcon } from "lucide-react";
import { FormField } from "@/components/molecules/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/repositories/action-result";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/schema/agreement";
import {
  rateCardSettingsSchema,
  type RateCard,
  type RateCardSettings,
} from "@/lib/schema/rate-card";

const SERVICE_FIELDS = SERVICE_TYPES.filter((type) => type !== "other");

const EXTRA_LABELS: Record<keyof RateCard["extras"], string> = {
  extra_revision: "Extra revision",
  commercial_usage: "Commercial usage",
  rush_48h: "Rush (48 hours)",
  source_file: "Source file",
};

function uppercase(value: string): string {
  return value.trim().toUpperCase();
}

function errorAt(errors: FieldErrors<RateCardSettings>, path: string) {
  const found = get(errors, path) as { message?: unknown } | undefined;
  return typeof found?.message === "string" ? found.message : undefined;
}

type SaveRateCardAction = (
  input: RateCardSettings,
) => Promise<ActionResult<RateCardSettings>>;

export interface RateCardFormProps {
  settings: RateCardSettings;
  save: SaveRateCardAction;
}

function RateCardForm({ settings, save }: RateCardFormProps) {
  const id = React.useId();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RateCardSettings>({
    defaultValues: settings,
    resolver: zodResolver(rateCardSettingsSchema),
  });
  const [pending, startTransition] = React.useTransition();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(values: RateCardSettings) {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const result = await save(values);
      if (!result.ok) return setError(result.error.message);
      setNotice("Rate card saved.");
      router.refresh();
    });
  }

  const field = (name: string) => `${id}-${name}`;

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Couldn&apos;t save rate card</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <CircleCheckIcon />
          <AlertTitle>{notice}</AlertTitle>
        </Alert>
      )}

      <section className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Base prices
          </h2>
          <p className="text-sm text-muted-foreground">
            The low end of each service. The mismatch check flags budgets far
            under these.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            label="Currency"
            htmlFor={field("currency")}
            error={errorAt(errors, "rate_card.currency")}
            hint="ISO 4217 code, e.g. USD."
          >
            <Input
              id={field("currency")}
              placeholder="USD"
              maxLength={3}
              {...register("rate_card.currency", { setValueAs: uppercase })}
            />
          </FormField>

          {SERVICE_FIELDS.map((service) => (
            <FormField
              key={service}
              label={SERVICE_LABELS[service]}
              htmlFor={field(service)}
              error={errorAt(errors, `rate_card.services.${service}`)}
            >
              <Input
                id={field(service)}
                inputMode="decimal"
                placeholder="100.00"
                {...register(`rate_card.services.${service}`)}
              />
            </FormField>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-xl border bg-card p-5 md:p-8">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Extras
          </h2>
          <p className="text-sm text-muted-foreground">
            Add-ons clients can pay for on top of the base price.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {(Object.keys(EXTRA_LABELS) as (keyof RateCard["extras"])[]).map(
            (extra) => (
              <FormField
                key={extra}
                label={EXTRA_LABELS[extra]}
                htmlFor={field(extra)}
                error={errorAt(errors, `rate_card.extras.${extra}`)}
              >
                <Input
                  id={field(extra)}
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register(`rate_card.extras.${extra}`)}
                />
              </FormField>
            ),
          )}

          <FormField
            label="Included revisions"
            htmlFor={field("revisions")}
            error={errorAt(errors, "rate_card.included_revisions")}
          >
            <Input
              id={field("revisions")}
              type="number"
              min={0}
              {...register("rate_card.included_revisions", {
                valueAsNumber: true,
              })}
            />
          </FormField>

          <FormField
            label="Mismatch threshold"
            htmlFor={field("threshold")}
            error={errorAt(errors, "mismatch_threshold_pct")}
            hint="Percent below estimate that triggers a mismatch notice."
          >
            <Input
              id={field("threshold")}
              type="number"
              min={1}
              max={100}
              {...register("mismatch_threshold_pct", { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          <SaveIcon data-icon="inline-start" />
          {pending ? "Saving..." : "Save rate card"}
        </Button>
      </div>
    </form>
  );
}

export { RateCardForm };
