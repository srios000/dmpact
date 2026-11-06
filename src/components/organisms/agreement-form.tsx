"use client";

import * as React from "react";
import {
  get,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { z } from "zod";
import { AmbiguityFlag } from "@/components/molecules/ambiguity-flag";
import { FormField } from "@/components/molecules/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_CURRENCIES } from "@/lib/ai/extract/post-checks";
import { reviewAgreement } from "@/lib/ai/extract/review";
import {
  agreementSchema,
  SERVICE_TYPES,
  type Agreement,
  type Ambiguity,
  type ServiceType,
} from "@/lib/schema/agreement";

type AgreementInput = z.input<typeof agreementSchema>;

const SERVICE_LABELS: Record<ServiceType, string> = {
  mixing: "Mixing",
  mastering: "Mastering",
  mix_and_master: "Mix and master",
  illustration: "Illustration",
  live2d_rigging: "Live2D rigging",
  mv_editing: "MV editing",
  thumbnail: "Thumbnail",
  other: "Other",
};

const SECTIONS = [
  { key: "title", label: "Title", prefixes: ["/title"] },
  {
    key: "service",
    label: "Service",
    prefixes: ["/service_type", "/service_other"],
  },
  { key: "deliverables", label: "Deliverables", prefixes: ["/deliverables"] },
  { key: "currency", label: "Currency", prefixes: ["/price/currency"] },
  { key: "total", label: "Total price", prefixes: ["/price"] },
  {
    key: "deposit",
    label: "Deposit",
    prefixes: ["/deposit", "/balance_amount"],
  },
  { key: "deadline", label: "Deadline", prefixes: ["/deadline"] },
  { key: "revisions", label: "Revisions", prefixes: ["/revisions"] },
  { key: "usage", label: "Usage rights", prefixes: ["/usage_rights"] },
  { key: "client", label: "Client", prefixes: ["/parties"] },
  { key: "notes", label: "Notes", prefixes: ["/notes"] },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"] | "general";

function sectionOf(flag: Ambiguity): SectionKey {
  const section = SECTIONS.find((s) =>
    s.prefixes.some((p) => flag.field === p || flag.field.startsWith(`${p}/`)),
  );
  return section?.key ?? "general";
}

function labelOf(key: SectionKey): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? "Whole agreement";
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function numberOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function booleanOrNull(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function normalize(values: AgreementInput): Agreement {
  const next = structuredClone(values) as Agreement;
  next.service_other =
    next.service_type === "other" ? (next.service_other ?? "") : null;
  next.price.currency = next.price.currency
    ? next.price.currency.toUpperCase()
    : null;
  const type = next.deposit.type;
  next.deposit.percent = type === "percent" ? next.deposit.percent : null;
  next.deposit.fixed_amount =
    type === "fixed" ? next.deposit.fixed_amount : null;
  return next;
}

const schemaResolver = zodResolver(agreementSchema);
const resolver: Resolver<AgreementInput, unknown, Agreement> = (
  values,
  context,
  options,
) => schemaResolver(normalize(values), context, options);

function errorAt(errors: FieldErrors<AgreementInput>, name: string) {
  const found: { message?: unknown } | undefined = get(errors, name);
  const message = found?.message;
  return typeof message === "string" ? message : undefined;
}

export interface AgreementFormProps {
  original: Agreement;
  dmText: string;
  pasteDate: string;
  submitLabel: string;
  pending?: boolean;
  secondaryAction?: React.ReactNode;
  onSubmit: (agreement: Agreement) => void;
}

function AgreementForm({
  original,
  dmText,
  pasteDate,
  submitLabel,
  pending,
  secondaryAction,
  onSubmit,
}: AgreementFormProps) {
  const id = React.useId();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AgreementInput, unknown, Agreement>({
    defaultValues: original,
    resolver,
  });
  const deliverables = useFieldArray({ control, name: "deliverables" });
  const values = useWatch({ control }) as AgreementInput;

  const review = React.useCallback(
    (edited: Agreement) =>
      reviewAgreement({ original, edited, dmText, pasteDate }),
    [original, dmText, pasteDate],
  );

  const live = React.useMemo(() => {
    try {
      return review(normalize(values));
    } catch {
      return original;
    }
  }, [review, values, original]);

  const flagsBySection = React.useMemo(() => {
    const map = new Map<SectionKey, Ambiguity[]>();
    for (const flag of live.ambiguities) {
      const key = sectionOf(flag);
      map.set(key, [...(map.get(key) ?? []), flag]);
    }
    return map;
  }, [live]);

  const blockers = live.ambiguities.filter(
    (a) => a.severity === "blocker",
  ).length;
  const warnings = live.ambiguities.length - blockers;

  function flagsFor(key: SectionKey) {
    const list = flagsBySection.get(key);
    if (!list?.length) return null;
    return (
      <div className="space-y-2">
        {list.map((flag, i) => (
          <AmbiguityFlag
            key={`${flag.code}-${flag.field}-${i}`}
            severity={flag.severity}
            label={labelOf(key)}
            message={flag.message}
            quote={flag.source_quote}
            question={flag.suggested_question}
          />
        ))}
      </div>
    );
  }

  const field = (name: string) => `${id}-${name}`;
  const depositType = values.deposit?.type;
  const currency = live.price.currency ?? "";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((agreement) => onSubmit(review(agreement)))}
      className="space-y-8"
    >
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {blockers === 0 && warnings === 0 ? (
          "Nothing flagged."
        ) : (
          <>
            {blockers > 0 ? (
              <span className="font-semibold text-destructive">
                {blockers} {blockers === 1 ? "blocker" : "blockers"}
              </span>
            ) : (
              "No blockers"
            )}
            {warnings > 0 && (
              <>
                {" and "}
                <span className="font-semibold text-warning">
                  {warnings} {warnings === 1 ? "warning" : "warnings"}
                </span>
              </>
            )}
            {blockers > 0
              ? ". Blockers need an answer before you send this to the client."
              : ". Warnings are worth a look but don't stop sending."}
          </>
        )}
      </p>

      {flagsFor("general")}

      <div className="grid gap-6 md:grid-cols-2">
        <FormField
          label="Title"
          htmlFor={field("title")}
          error={errorAt(errors, "title")}
          flags={flagsFor("title")}
          className="md:col-span-2"
        >
          <Input id={field("title")} {...register("title")} />
        </FormField>

        <FormField
          label="Service"
          htmlFor={field("service")}
          error={
            errorAt(errors, "service_type") ?? errorAt(errors, "service_other")
          }
          flags={flagsFor("service")}
        >
          <NativeSelect
            id={field("service")}
            className="w-full"
            {...register("service_type")}
          >
            {SERVICE_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {SERVICE_LABELS[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {values.service_type === "other" && (
            <Input
              aria-label="Describe the service"
              placeholder="Describe the service"
              {...register("service_other", { setValueAs: textOrNull })}
            />
          )}
        </FormField>

        <FormField
          label="Deadline"
          htmlFor={field("deadline")}
          error={errorAt(errors, "deadline.date")}
          flags={flagsFor("deadline")}
        >
          <Input
            id={field("deadline")}
            type="date"
            {...register("deadline.date", { setValueAs: textOrNull })}
          />
        </FormField>

        <FormField
          label="Deliverables"
          error={errorAt(errors, "deliverables")}
          flags={flagsFor("deliverables")}
          className="md:col-span-2"
        >
          <ul className="space-y-2">
            {deliverables.fields.map((item, index) => (
              <li key={item.id} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    aria-label={`Deliverable ${index + 1}`}
                    placeholder="What will you deliver?"
                    {...register(`deliverables.${index}.description`)}
                  />
                  {errorAt(errors, `deliverables.${index}.description`) && (
                    <p className="text-xs text-destructive">
                      {errorAt(errors, `deliverables.${index}.description`)}
                    </p>
                  )}
                </div>
                <Input
                  aria-label={`Quantity of deliverable ${index + 1}`}
                  type="number"
                  min={1}
                  className="w-20"
                  {...register(`deliverables.${index}.quantity`, {
                    valueAsNumber: true,
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove deliverable ${index + 1}`}
                  disabled={deliverables.fields.length === 1}
                  onClick={() => deliverables.remove(index)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              deliverables.append({
                id: `d${deliverables.fields.length + 1}`,
                description: "",
                quantity: 1,
              })
            }
          >
            <PlusIcon data-icon="inline-start" />
            Add deliverable
          </Button>
        </FormField>

        <FormField
          label="Total price"
          htmlFor={field("total")}
          error={errorAt(errors, "price.total")}
          flags={flagsFor("total")}
        >
          <Input
            id={field("total")}
            inputMode="decimal"
            placeholder="150.00"
            {...register("price.total", { setValueAs: textOrNull })}
          />
        </FormField>

        <FormField
          label="Currency"
          htmlFor={field("currency")}
          error={errorAt(errors, "price.currency")}
          flags={flagsFor("currency")}
        >
          <NativeSelect
            id={field("currency")}
            className="w-full"
            {...register("price.currency", { setValueAs: textOrNull })}
          >
            <NativeSelectOption value="">Not stated</NativeSelectOption>
            {original.price.currency &&
              !SUPPORTED_CURRENCIES.has(original.price.currency) && (
                <NativeSelectOption value={original.price.currency}>
                  {original.price.currency} (PayPal can&apos;t invoice this)
                </NativeSelectOption>
              )}
            {[...SUPPORTED_CURRENCIES].map((code) => (
              <NativeSelectOption key={code} value={code}>
                {code}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>

        <FormField
          label="Deposit"
          htmlFor={field("deposit")}
          error={
            errorAt(errors, "deposit.percent") ??
            errorAt(errors, "deposit.fixed_amount")
          }
          hint={
            live.deposit.amount && live.balance_amount
              ? `Client pays ${currency} ${live.deposit.amount} up front and ${currency} ${live.balance_amount} on delivery.`
              : "Deposit and balance show once the price and currency are set."
          }
          flags={flagsFor("deposit")}
          className="md:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            <NativeSelect id={field("deposit")} {...register("deposit.type")}>
              <NativeSelectOption value="percent">Percent</NativeSelectOption>
              <NativeSelectOption value="fixed">
                Fixed amount
              </NativeSelectOption>
              <NativeSelectOption value="none">No deposit</NativeSelectOption>
            </NativeSelect>
            {depositType === "percent" && (
              <Input
                aria-label="Deposit percent"
                type="number"
                min={0}
                max={100}
                className="w-28"
                {...register("deposit.percent", { setValueAs: numberOrNull })}
              />
            )}
            {depositType === "fixed" && (
              <Input
                aria-label="Deposit amount"
                inputMode="decimal"
                placeholder="50.00"
                className="w-36"
                {...register("deposit.fixed_amount", {
                  setValueAs: textOrNull,
                })}
              />
            )}
          </div>
        </FormField>

        <FormField
          label="Revisions included"
          htmlFor={field("revisions")}
          error={errorAt(errors, "revisions.included")}
          flags={flagsFor("revisions")}
        >
          <Input
            id={field("revisions")}
            type="number"
            min={0}
            {...register("revisions.included", { setValueAs: numberOrNull })}
          />
        </FormField>

        <FormField
          label="Usage rights"
          htmlFor={field("commercial")}
          flags={flagsFor("usage")}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <NativeSelect
              id={field("commercial")}
              aria-label="Commercial use"
              className="w-full"
              {...register("usage_rights.commercial", {
                setValueAs: booleanOrNull,
              })}
            >
              <NativeSelectOption value="">
                Commercial: not stated
              </NativeSelectOption>
              <NativeSelectOption value="true">
                Commercial use allowed
              </NativeSelectOption>
              <NativeSelectOption value="false">
                Personal use only
              </NativeSelectOption>
            </NativeSelect>
            <NativeSelect
              aria-label="Credit required"
              className="w-full"
              {...register("usage_rights.credit_required", {
                setValueAs: booleanOrNull,
              })}
            >
              <NativeSelectOption value="">
                Credit: not stated
              </NativeSelectOption>
              <NativeSelectOption value="true">
                Credit required
              </NativeSelectOption>
              <NativeSelectOption value="false">
                No credit needed
              </NativeSelectOption>
            </NativeSelect>
          </div>
          <Input
            aria-label="Usage rights notes"
            placeholder="Other usage terms"
            {...register("usage_rights.notes", { setValueAs: textOrNull })}
          />
        </FormField>

        <FormField
          label="Client"
          htmlFor={field("client-name")}
          error={errorAt(errors, "parties.client.email")}
          flags={flagsFor("client")}
          className="md:col-span-2"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              id={field("client-name")}
              placeholder="Name"
              {...register("parties.client.display_name", {
                setValueAs: textOrNull,
              })}
            />
            <Input
              aria-label="Client handle"
              placeholder="@handle"
              {...register("parties.client.handle", { setValueAs: textOrNull })}
            />
            <Input
              aria-label="Client email"
              type="email"
              placeholder="client@example.com"
              {...register("parties.client.email", { setValueAs: textOrNull })}
            />
          </div>
        </FormField>

        <FormField
          label="Notes"
          htmlFor={field("notes")}
          flags={flagsFor("notes")}
          className="md:col-span-2"
        >
          <Textarea
            id={field("notes")}
            {...register("notes", { setValueAs: textOrNull })}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {secondaryAction}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { AgreementForm };
