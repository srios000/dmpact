"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  CircleDollarSignIcon,
  CopyIcon,
  HistoryIcon,
  LoaderCircleIcon,
  LockIcon,
  PlusIcon,
  SaveIcon,
  ScrollTextIcon,
  SendIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  agreementSchema,
  SERVICE_TYPES,
  type Agreement,
  type ServiceType,
} from "@/lib/schema/agreement";
import { computeAmounts, type DepositTerms } from "@/lib/money/decimal";
import type { AgreementEditMode } from "@/lib/state-machine/agreement-edits";
import type { getCommission } from "@/lib/repositories/commission-repository";
import { saveAgreementVersion, sendToClient } from "../actions";
import { AgreementVersionHistory } from "./agreement-version-history";

type CommissionDetail = NonNullable<Awaited<ReturnType<typeof getCommission>>>;
type VersionItem = CommissionDetail["versions"][number];
type AgreementInput = z.input<typeof agreementSchema>;
type AgreementOutput = z.output<typeof agreementSchema>;

const SERVICE_LABELS: Record<ServiceType, string> = {
  mixing: "Mixing",
  mastering: "Mastering",
  mix_and_master: "Mix & Master",
  illustration: "Illustration",
  live2d_rigging: "Live2D Rigging",
  mv_editing: "MV Editing",
  thumbnail: "Thumbnail",
  other: "Other",
};

const DEPOSIT_TYPES = [
  { value: "percent", label: "Percent of total" },
  { value: "fixed", label: "Fixed amount" },
  { value: "none", label: "No deposit" },
] as const;

const TRI_STATE = [
  { value: "unclear", label: "Not stated" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

const FULL_ONLY_HINT: Record<AgreementEditMode, string | null> = {
  full: null,
  deadline: "Client approved this version. Only the deadline can change now.",
  locked: "This commission is locked. The agreement is read-only.",
};

function normalize(agreement: Agreement): Agreement {
  return {
    ...agreement,
    deadline: {
      date: agreement.deadline.date ?? null,
      raw_text: agreement.deadline.raw_text ?? null,
      is_relative: agreement.deadline.is_relative,
    },
    revisions: {
      included: agreement.revisions.included ?? null,
      extra_fee: agreement.revisions.extra_fee ?? null,
    },
    usage_rights: {
      commercial: agreement.usage_rights?.commercial ?? null,
      credit_required: agreement.usage_rights?.credit_required ?? null,
      notes: agreement.usage_rights?.notes ?? null,
    },
    parties: {
      client: {
        display_name: agreement.parties?.client?.display_name ?? null,
        handle: agreement.parties?.client?.handle ?? null,
        email: agreement.parties?.client?.email ?? null,
      },
    },
    deliverables: agreement.deliverables.map((d) => ({
      ...d,
      format: d.format ?? null,
    })),
    notes: agreement.notes ?? null,
  };
}

const moneyField = {
  setValueAs: (value: unknown) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
};

const currencyField = {
  setValueAs: (value: unknown) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim().toUpperCase();
    return trimmed === "" ? null : trimmed;
  },
};

const intOrNull = {
  setValueAs: (value: unknown) =>
    value === "" || value === null ? null : Number(value),
};

const positiveInt = {
  setValueAs: (value: unknown) =>
    value === "" || value === null ? undefined : Number(value),
};

function boolToTri(value: boolean | null | undefined): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unclear";
}

function triToBool(value: string | null): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function nextDeliverableId(ids: string[]): string {
  const highest = ids.reduce((max, id) => {
    const n = Number(id.replace(/^d/, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `d${highest + 1}`;
}

function AmountPreview({
  total,
  currency,
  deposit,
}: {
  total: string | null;
  currency: string | null;
  deposit: DepositTerms;
}) {
  let amounts: ReturnType<typeof computeAmounts> = null;
  try {
    amounts = computeAmounts(total, currency, deposit);
  } catch {
    amounts = null;
  }

  const label = currency ?? "—";
  const rows = [
    {
      key: "deposit",
      label: "Deposit",
      value: amounts ? `${label} ${amounts.deposit}` : "—",
      tone: "text-[#FF3B8E]",
    },
    {
      key: "balance",
      label: "Balance due",
      value: amounts?.balance ? `${label} ${amounts.balance}` : "—",
      tone: "text-white",
    },
  ];

  return (
    <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6">
      <div className="flex items-center gap-2 text-slate-500">
        <CircleDollarSignIcon className="size-4" />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase">
          Live preview
        </span>
      </div>
      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4"
          >
            <span className="text-xs font-bold text-slate-500">
              {row.label}
            </span>
            <span className={cn("text-base font-black", row.tone)}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
      {amounts?.exceeds ? (
        <p className="mt-4 flex items-center gap-2 text-xs font-bold text-red-400">
          <AlertTriangleIcon className="size-3.5" />
          The deposit exceeds the total.
        </p>
      ) : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[2.5rem] border border-white/5 bg-[#0F1014]/60 p-8 shadow-2xl backdrop-blur-3xl md:p-10",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#FF3B8E]">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="text-[11px] font-black tracking-[0.2em] text-slate-400 uppercase">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-xs font-medium text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-[10px] font-black tracking-[0.18em] text-slate-500 uppercase">
        {children}
      </span>
      {hint ? (
        <span className="text-[10px] font-bold text-slate-600">{hint}</span>
      ) : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-2 text-[11px] font-bold text-red-400">{message}</p>;
}

const inputClass =
  "h-12 rounded-2xl border-white/10 bg-white/5 text-sm font-medium text-white placeholder:text-slate-600 focus-visible:border-[#FF3B8E]/50 focus-visible:bg-white/10 focus-visible:ring-[#FF3B8E]/20";

const triggerClass =
  "h-12 w-full rounded-2xl border-white/10 bg-white/5 px-4 text-sm font-medium text-white data-placeholder:text-slate-600";

export interface AgreementEditorProps {
  commission: CommissionDetail;
  mode: AgreementEditMode;
}

function AgreementEditor({ commission, mode }: AgreementEditorProps) {
  const router = useRouter();

  const versions = commission.versions;
  const latest = versions[versions.length - 1];
  const [selectedVersion, setSelectedVersion] = React.useState(latest.version);
  const [saved, setSaved] = React.useState({
    version: latest.version,
    contentHash: latest.contentHash,
  });
  const [clientToken, setClientToken] = React.useState(commission.clientToken);
  const [isSaving, startSave] = React.useTransition();
  const [isSending, startSend] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const form = useForm<AgreementInput, unknown, AgreementOutput>({
    resolver: zodResolver(agreementSchema),
    defaultValues: normalize(latest.agreement),
    mode: "onChange",
  });

  const deliverables = useFieldArray({
    control: form.control,
    name: "deliverables",
    keyName: "rhfKey",
  });

  const serviceType = useWatch({ control: form.control, name: "service_type" });
  const total = useWatch({ control: form.control, name: "price.total" });
  const currency = useWatch({ control: form.control, name: "price.currency" });
  const depositType = useWatch({ control: form.control, name: "deposit.type" });
  const depositPercent = useWatch({
    control: form.control,
    name: "deposit.percent",
  });
  const depositFixed = useWatch({
    control: form.control,
    name: "deposit.fixed_amount",
  });
  const ambiguities = useWatch({ control: form.control, name: "ambiguities" });

  const flags = ambiguities ?? [];
  const blockerCount = flags.filter((f) => f?.severity === "blocker").length;
  const deposit: DepositTerms = {
    type: depositType ?? "percent",
    percent: depositPercent ?? null,
    fixed_amount: depositFixed ?? null,
  };

  let completedAmounts: ReturnType<typeof computeAmounts> = null;
  try {
    completedAmounts = computeAmounts(total ?? null, currency ?? null, deposit);
  } catch {
    completedAmounts = null;
  }
  const agreementValid = completedAmounts !== null;

  const isDirty = form.formState.isDirty;
  const canSave = mode !== "locked" && isDirty && !isSaving;
  const canSend =
    mode === "full" &&
    commission.state === "draft" &&
    !isDirty &&
    agreementValid &&
    blockerCount === 0;
  const canCopy = Boolean(clientToken);

  const onInvalid = () => {
    setError(
      "Some fields still need attention before this version can be saved.",
    );
  };

  const onSubmit = (values: AgreementOutput) => {
    setError(null);
    setNotice(null);
    startSave(async () => {
      const result = await saveAgreementVersion({
        commissionId: commission.id,
        agreement: values,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSaved(result.data);
      form.reset(values);
      setNotice(`Saved as version ${result.data.version}.`);
      router.refresh();
    });
  };

  const handleSend = () => {
    setError(null);
    setNotice(null);
    startSend(async () => {
      const result = await sendToClient({
        commissionId: commission.id,
        versionHash: saved.contentHash,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setClientToken(result.data.token);
      setNotice("Sent. The client link is now active.");
      router.refresh();
    });
  };

  const handleCopy = async () => {
    if (!clientToken) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/a/${clientToken}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = (version: VersionItem) => {
    form.reset(normalize(version.agreement));
    setSelectedVersion(version.version);
    setNotice(`Loaded version ${version.version} into the editor.`);
  };

  const previewVersion =
    versions.find((v) => v.version === selectedVersion) ?? latest;

  const lockBanner = FULL_ONLY_HINT[mode];

  return (
    <div className="space-y-10 pb-24">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-slate-500">
            <ScrollTextIcon className="size-4" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase">
              Agreement editor
            </span>
          </div>
          <h1 className="font-heading text-4xl font-black tracking-tight text-white md:text-5xl">
            {previewVersion.agreement.title || "Untitled commission"}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge state={commission.state} />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black tracking-wider text-slate-300 uppercase">
              v{saved.version} · latest
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black tracking-wider text-slate-300 uppercase">
              {mode === "full"
                ? "Fully editable"
                : mode === "deadline"
                  ? "Deadline only"
                  : "Locked"}
            </span>
          </div>
        </div>
      </header>

      {lockBanner ? (
        <div className="flex items-center gap-3 rounded-[2rem] border border-amber-500/20 bg-amber-500/5 px-6 py-5">
          {mode === "locked" ? (
            <LockIcon className="size-5 text-amber-400" />
          ) : (
            <AlertTriangleIcon className="size-5 text-amber-400" />
          )}
          <p className="text-sm font-bold text-amber-200/90">{lockBanner}</p>
        </div>
      ) : null}

      {(error || notice) && (
        <div
          className={cn(
            "rounded-[2rem] border px-6 py-5 text-sm font-bold",
            error
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
          )}
        >
          {error ?? notice}
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-10"
        >
          <fieldset disabled={mode !== "full"} className="contents">
            <SectionCard
              title="Flags & blockers"
              description="Resolve each AI-detected ambiguity before sending."
              icon={AlertTriangleIcon}
            >
              {flags.length === 0 ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 text-sm font-bold text-emerald-300">
                  <CheckIcon className="size-4" />
                  No ambiguities detected.
                </div>
              ) : (
                <ul className="space-y-4">
                  {flags.map((flag, index) => {
                    const isBlocker = flag?.severity === "blocker";
                    return (
                      <li
                        key={`${flag?.code ?? "flag"}-${index}`}
                        className={cn(
                          "rounded-2xl border p-5",
                          isBlocker
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-amber-500/20 bg-amber-500/5",
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10",
                              isBlocker
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-500/20 text-amber-400",
                            )}
                          >
                            <AlertTriangleIcon className="size-4" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black tracking-[0.14em] text-slate-400 uppercase">
                                {flag?.code?.replace(/_/g, " ") ?? "FLAG"}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider uppercase",
                                  isBlocker
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-amber-500/20 text-amber-300",
                                )}
                              >
                                {flag?.severity ?? "warning"}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed font-bold text-white">
                              {flag?.message}
                            </p>
                            {flag?.suggested_question ? (
                              <p className="text-xs font-medium text-slate-500">
                                Suggested: {flag.suggested_question}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 shrink-0 gap-2 rounded-full px-3 text-[10px] font-black text-slate-400 uppercase hover:bg-white/5 hover:text-white"
                            onClick={() =>
                              form.setValue(
                                "ambiguities",
                                flags.filter((_, i) => i !== index),
                                { shouldDirty: true, shouldValidate: true },
                              )
                            }
                          >
                            <CheckIcon className="size-3" />
                            Resolve
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Basics" icon={ScrollTextIcon}>
              <div className="grid gap-6">
                <div>
                  <FieldLabel>Title</FieldLabel>
                  <Input
                    className={inputClass}
                    placeholder="Agreement title"
                    {...form.register("title")}
                  />
                  <FieldError message={form.formState.errors.title?.message} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <FieldLabel>Service type</FieldLabel>
                    <Controller
                      control={form.control}
                      name="service_type"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "other") {
                              form.setValue("service_other", null, {
                                shouldDirty: true,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className={triggerClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {SERVICE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {serviceType === "other" ? (
                    <div>
                      <FieldLabel>Other service</FieldLabel>
                      <Input
                        className={inputClass}
                        placeholder="Describe the service"
                        {...form.register("service_other", {
                          setValueAs: (value: unknown) => {
                            if (typeof value !== "string") return value;
                            const trimmed = value.trim();
                            return trimmed === "" ? null : trimmed;
                          },
                        })}
                      />
                      <FieldError
                        message={form.formState.errors.service_other?.message}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Deliverables"
              description="What the client receives, with quantity and format."
              icon={WandSparklesIcon}
            >
              <div className="space-y-4">
                {deliverables.fields.map((field, index) => (
                  <div
                    key={field.rhfKey}
                    className="grid gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5 md:grid-cols-[64px_1fr_96px_40px] md:items-start"
                  >
                    <div className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-[#FF3B8E]/10 text-[10px] font-black text-[#FF3B8E]">
                      {(field.id || `d${index + 1}`).toUpperCase()}
                    </div>
                    <div>
                      <Input
                        className={inputClass}
                        placeholder="Deliverable description"
                        {...form.register(`deliverables.${index}.description`)}
                      />
                      <FieldError
                        message={
                          form.formState.errors.deliverables?.[index]
                            ?.description?.message
                        }
                      />
                      <Input
                        className={cn(inputClass, "mt-3")}
                        placeholder="Format (optional) e.g. WAV 24-bit"
                        {...form.register(`deliverables.${index}.format`, {
                          setValueAs: (value: unknown) => {
                            if (typeof value !== "string") return value;
                            const trimmed = value.trim();
                            return trimmed === "" ? null : trimmed;
                          },
                        })}
                      />
                    </div>
                    <div>
                      <Input
                        className={inputClass}
                        type="number"
                        min={1}
                        {...form.register(
                          `deliverables.${index}.quantity`,
                          positiveInt,
                        )}
                      />
                      <FieldError
                        message={
                          form.formState.errors.deliverables?.[index]?.quantity
                            ?.message
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-12 rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      disabled={deliverables.fields.length <= 1}
                      onClick={() => deliverables.remove(index)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-transparent text-xs font-black tracking-widest text-slate-400 uppercase hover:bg-white/5 hover:text-white"
                  onClick={() =>
                    deliverables.append({
                      id: nextDeliverableId(
                        deliverables.fields.map((f) => f.id),
                      ),
                      description: "",
                      quantity: 1,
                      format: null,
                    })
                  }
                >
                  <PlusIcon className="size-4" />
                  Add deliverable
                </Button>
                <FieldError
                  message={form.formState.errors.deliverables?.root?.message}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Pricing"
              description="Amounts are stored as decimal strings."
              icon={CircleDollarSignIcon}
            >
              <div className="grid gap-6 md:grid-cols-[1fr_160px]">
                <div>
                  <FieldLabel>Total</FieldLabel>
                  <Input
                    className={inputClass}
                    inputMode="decimal"
                    placeholder="150.00"
                    {...form.register("price.total", moneyField)}
                  />
                  <FieldError
                    message={form.formState.errors.price?.total?.message}
                  />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <Input
                    className={cn(inputClass, "uppercase")}
                    placeholder="USD"
                    maxLength={3}
                    {...form.register("price.currency", currencyField)}
                  />
                  <FieldError
                    message={form.formState.errors.price?.currency?.message}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <FieldLabel>Deposit type</FieldLabel>
                  <Controller
                    control={form.control}
                    name="deposit.type"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value !== "percent") {
                            form.setValue("deposit.percent", null, {
                              shouldDirty: true,
                            });
                          }
                          if (value !== "fixed") {
                            form.setValue("deposit.fixed_amount", null, {
                              shouldDirty: true,
                            });
                          }
                          if (value === "percent") {
                            form.setValue("deposit.percent", 50, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }
                        }}
                      >
                        <SelectTrigger className={triggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPOSIT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {depositType === "percent" ? (
                  <div>
                    <FieldLabel>Deposit percent</FieldLabel>
                    <Input
                      className={inputClass}
                      type="number"
                      min={0}
                      max={100}
                      {...form.register("deposit.percent", intOrNull)}
                    />
                    <FieldError
                      message={form.formState.errors.deposit?.percent?.message}
                    />
                  </div>
                ) : null}

                {depositType === "fixed" ? (
                  <div>
                    <FieldLabel>Deposit amount</FieldLabel>
                    <Input
                      className={inputClass}
                      inputMode="decimal"
                      placeholder="75.00"
                      {...form.register("deposit.fixed_amount", moneyField)}
                    />
                    <FieldError
                      message={
                        form.formState.errors.deposit?.fixed_amount?.message
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-6">
                <AmountPreview
                  total={total ?? null}
                  currency={currency ?? null}
                  deposit={deposit}
                />
              </div>
            </SectionCard>

            <SectionCard title="Revisions" icon={WandSparklesIcon}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <FieldLabel>Rounds included</FieldLabel>
                  <Input
                    className={inputClass}
                    type="number"
                    min={0}
                    {...form.register("revisions.included", intOrNull)}
                  />
                  <FieldError
                    message={form.formState.errors.revisions?.included?.message}
                  />
                </div>
                <div>
                  <FieldLabel hint="optional">Extra revision fee</FieldLabel>
                  <Input
                    className={inputClass}
                    inputMode="decimal"
                    placeholder="25.00"
                    {...form.register("revisions.extra_fee", moneyField)}
                  />
                  <FieldError
                    message={
                      form.formState.errors.revisions?.extra_fee?.message
                    }
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Usage rights" icon={CheckIcon}>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <FieldLabel>Commercial use</FieldLabel>
                  <Controller
                    control={form.control}
                    name="usage_rights.commercial"
                    render={({ field }) => (
                      <Select
                        value={boolToTri(field.value)}
                        onValueChange={(value) => {
                          field.onChange(triToBool(value));
                          form.setValue(
                            "usage_rights.commercial",
                            triToBool(value),
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      >
                        <SelectTrigger className={triggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRI_STATE.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <FieldLabel>Credit required</FieldLabel>
                  <Controller
                    control={form.control}
                    name="usage_rights.credit_required"
                    render={({ field }) => (
                      <Select
                        value={boolToTri(field.value)}
                        onValueChange={(value) =>
                          form.setValue(
                            "usage_rights.credit_required",
                            triToBool(value),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger className={triggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRI_STATE.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              <div className="mt-6">
                <FieldLabel hint="optional">Notes</FieldLabel>
                <Textarea
                  className="min-h-24 rounded-2xl border-white/10 bg-white/5 text-sm font-medium text-white placeholder:text-slate-600 focus-visible:border-[#FF3B8E]/50 focus-visible:ring-[#FF3B8E]/20"
                  placeholder="Any rights notes..."
                  {...form.register("usage_rights.notes", {
                    setValueAs: (value: unknown) => {
                      if (typeof value !== "string") return value;
                      const trimmed = value.trim();
                      return trimmed === "" ? null : trimmed;
                    },
                  })}
                />
              </div>
            </SectionCard>

            <SectionCard title="Client" icon={ScrollTextIcon}>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <FieldLabel hint="optional">Display name</FieldLabel>
                  <Input
                    className={inputClass}
                    {...form.register("parties.client.display_name", {
                      setValueAs: (value: unknown) => {
                        if (typeof value !== "string") return value;
                        const trimmed = value.trim();
                        return trimmed === "" ? null : trimmed;
                      },
                    })}
                  />
                </div>
                <div>
                  <FieldLabel hint="optional">Handle</FieldLabel>
                  <Input
                    className={inputClass}
                    {...form.register("parties.client.handle", {
                      setValueAs: (value: unknown) => {
                        if (typeof value !== "string") return value;
                        const trimmed = value.trim();
                        return trimmed === "" ? null : trimmed;
                      },
                    })}
                  />
                </div>
                <div>
                  <FieldLabel hint="optional">Email</FieldLabel>
                  <Input
                    className={inputClass}
                    type="email"
                    {...form.register("parties.client.email", {
                      setValueAs: (value: unknown) => {
                        if (typeof value !== "string") return value;
                        const trimmed = value.trim();
                        return trimmed === "" ? null : trimmed;
                      },
                    })}
                  />
                  <FieldError
                    message={
                      form.formState.errors.parties?.client?.email?.message
                    }
                  />
                </div>
              </div>
            </SectionCard>
          </fieldset>

          <SectionCard
            title="Deadline"
            description={
              mode === "deadline"
                ? "This is the only field you can still change."
                : "When the work is due."
            }
            icon={CalendarIcon}
            className={cn(mode === "deadline" && "border-amber-500/20")}
          >
            <div className="grid gap-6 md:grid-cols-[1fr_200px]">
              <div>
                <FieldLabel>Date</FieldLabel>
                <Input
                  className={cn(inputClass, "[color-scheme:dark]")}
                  type="date"
                  disabled={mode === "locked"}
                  {...form.register("deadline.date", moneyField)}
                />
                <FieldError
                  message={form.formState.errors.deadline?.date?.message}
                />
              </div>
              <div>
                <FieldLabel>Relative?</FieldLabel>
                <Controller
                  control={form.control}
                  name="deadline.is_relative"
                  render={({ field }) => (
                    <Select
                      value={field.value ? "yes" : "no"}
                      onValueChange={(value) => field.onChange(value === "yes")}
                    >
                      <SelectTrigger
                        className={triggerClass}
                        disabled={mode === "locked"}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">Fixed date</SelectItem>
                        <SelectItem value="yes">Relative</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </SectionCard>

          <Button
            type="submit"
            disabled={!canSave}
            className="h-14 w-full gap-3 rounded-2xl bg-white text-sm font-black text-black shadow-lg shadow-white/5 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            {isSaving ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            Save as new version
          </Button>
        </form>

        <aside className="space-y-8">
          <div className="rounded-[2.5rem] border border-white/5 bg-[#0F1014]/60 p-8 shadow-2xl backdrop-blur-3xl lg:sticky lg:top-24">
            <h3 className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase">
              Actions
            </h3>

            <div className="mt-6 space-y-4">
              <Button
                type="button"
                disabled={!canSend || isSending}
                onClick={handleSend}
                className="h-14 w-full gap-3 rounded-2xl bg-gradient-to-r from-[#FF3B8E] to-[#D42A75] text-sm font-black text-white shadow-lg shadow-[#FF3B8E]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
              >
                {isSending ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <SendIcon className="size-4" />
                )}
                {commission.state === "draft"
                  ? "Send to client"
                  : "Sent to client"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={!canCopy}
                onClick={handleCopy}
                className="h-12 w-full gap-3 rounded-2xl border-2 border-white/10 bg-transparent text-xs font-black tracking-widest text-white uppercase hover:bg-white/5 disabled:opacity-40"
              >
                <CopyIcon className="size-4" />
                {copied ? "Link copied" : "Copy client link"}
              </Button>

              <p className="text-[11px] leading-relaxed font-medium text-slate-500">
                {commission.state === "draft"
                  ? blockerCount > 0
                    ? `${blockerCount} blocker(s) must be resolved before sending.`
                    : isDirty
                      ? "Save your changes before sending."
                      : !agreementValid
                        ? "Add a valid total, currency and deposit first."
                        : clientToken
                          ? `Client link: /a/${clientToken}`
                          : "Ready to send."
                  : clientToken
                    ? `Client link: /a/${clientToken}`
                    : "This commission has already been sent."}
              </p>
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-white/5 bg-[#0F1014]/60 p-8 shadow-2xl backdrop-blur-3xl">
            <AgreementVersionHistory
              versions={versions}
              selectedVersion={selectedVersion}
              inForceVersion={commission.inForceVersion}
              onSelectVersion={setSelectedVersion}
            />

            {selectedVersion !== latest.version ? (
              <div className="mt-6 space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 text-slate-400">
                  <HistoryIcon className="size-4" />
                  <span className="text-[10px] font-black tracking-[0.18em] uppercase">
                    Previewing v{selectedVersion}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {previewVersion.agreement.price.currency ?? "—"}{" "}
                  {previewVersion.agreement.price.total ?? "—"} ·{" "}
                  {previewVersion.agreement.deadline.date ?? "no deadline"}
                </p>
                {mode === "full" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-2 border-white/10 bg-transparent text-xs font-black tracking-widest text-white uppercase hover:bg-white/5"
                    onClick={() => handleRestore(previewVersion)}
                  >
                    Load into editor
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-[2.5rem] border border-white/5 bg-[#0F1014]/60 p-8 shadow-2xl backdrop-blur-3xl">
            <h3 className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase">
              Source
            </h3>
            <p className="mt-4 max-h-40 overflow-y-auto text-xs leading-relaxed font-medium whitespace-pre-wrap text-slate-400">
              {commission.sourceDm || "No source DM recorded."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export { AgreementEditor };
