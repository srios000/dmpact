import { cookies } from "next/headers"

export const RATE_CARD_COOKIE = "dmpact-rate-card"

export const SERVICE_RATE_FIELDS = [
  {
    key: "mixMaster",
    label: "Mix & Master",
    description: "Base price for a full mix and master package.",
  },
  {
    key: "illustration",
    label: "Illustration",
    description: "Base price for a single commissioned illustration.",
  },
  {
    key: "live2dRigging",
    label: "Live2D Rigging",
    description: "Base price for rigging a standard bust-up model.",
  },
  {
    key: "mvEditing",
    label: "MV Editing",
    description: "Base price for lyric or cover video editing.",
  },
  {
    key: "chibiIcon",
    label: "Chibi Icon",
    description: "Base price for a simple profile or mascot icon.",
  },
] as const

export const EXTRA_RATE_FIELDS = [
  {
    key: "extraRevision",
    label: "Extra revision",
    description: "Price per additional revision round.",
  },
  {
    key: "commercialUsage",
    label: "Commercial usage",
    description: "Additional fee for monetized or commercial use.",
  },
  {
    key: "rush48h",
    label: "Rush delivery",
    description: "Extra fee for 48-hour turnaround.",
  },
  {
    key: "sourceFile",
    label: "Source file",
    description: "Additional fee for editable or project source files.",
  },
] as const

type ServiceRateKey = (typeof SERVICE_RATE_FIELDS)[number]["key"]
type ExtraRateKey = (typeof EXTRA_RATE_FIELDS)[number]["key"]

export type RateCardValues = {
  currency: string
  paypalEmail: string
  defaultDepositPct: string
  mismatchThresholdPct: string
  services: Record<ServiceRateKey, string>
  extras: Record<ExtraRateKey, string>
  updatedAtLabel: string
  source: "default" | "cookie" | "database"
}

type RateCardSnapshot = Omit<RateCardValues, "updatedAtLabel" | "source">

export type RateCardActionState = {
  status: "idle" | "success" | "error"
  message: string
  values: RateCardValues
}

const DEFAULT_RATE_CARD: RateCardSnapshot = {
  currency: "USD",
  paypalEmail: "",
  defaultDepositPct: "50",
  mismatchThresholdPct: "20",
  services: {
    mixMaster: "150.00",
    illustration: "180.00",
    live2dRigging: "350.00",
    mvEditing: "220.00",
    chibiIcon: "80.00",
  },
  extras: {
    extraRevision: "15.00",
    commercialUsage: "40.00",
    rush48h: "60.00",
    sourceFile: "25.00",
  },
}

function formatUpdatedAt(date: Date | string | null | undefined) {
  if (!date) return "Default rate card"

  const value = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(value.getTime())) return "Default rate card"

  return `Updated ${value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`
}

function toRateCardValues(
  snapshot: Partial<RateCardSnapshot> | null | undefined,
  source: RateCardValues["source"],
  updatedAt?: Date | string | null
): RateCardValues {
  return {
    currency: snapshot?.currency ?? DEFAULT_RATE_CARD.currency,
    paypalEmail: snapshot?.paypalEmail ?? DEFAULT_RATE_CARD.paypalEmail,
    defaultDepositPct: snapshot?.defaultDepositPct ?? DEFAULT_RATE_CARD.defaultDepositPct,
    mismatchThresholdPct: snapshot?.mismatchThresholdPct ?? DEFAULT_RATE_CARD.mismatchThresholdPct,
    services: {
      ...DEFAULT_RATE_CARD.services,
      ...(snapshot?.services ?? {}),
    },
    extras: {
      ...DEFAULT_RATE_CARD.extras,
      ...(snapshot?.extras ?? {}),
    },
    updatedAtLabel: formatUpdatedAt(updatedAt),
    source,
  }
}

function sanitizeMoney(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return ""

  return parsed.toFixed(2)
}

function sanitizePercent(value: FormDataEntryValue | null, fallback: string) {
  const parsed = Number(String(value ?? "").trim())
  if (!Number.isFinite(parsed)) return fallback
  return String(Math.min(100, Math.max(0, Math.round(parsed))))
}

export function parseRateCardFormData(formData: FormData): RateCardSnapshot {
  const services = Object.fromEntries(
    SERVICE_RATE_FIELDS.map((field) => [field.key, sanitizeMoney(formData.get(`service-${field.key}`))])
  ) as RateCardSnapshot["services"]

  const extras = Object.fromEntries(
    EXTRA_RATE_FIELDS.map((field) => [field.key, sanitizeMoney(formData.get(`extra-${field.key}`))])
  ) as RateCardSnapshot["extras"]

  return {
    currency: String(formData.get("currency") ?? DEFAULT_RATE_CARD.currency).trim().toUpperCase() || "USD",
    paypalEmail: String(formData.get("paypalEmail") ?? "").trim(),
    defaultDepositPct: sanitizePercent(formData.get("defaultDepositPct"), DEFAULT_RATE_CARD.defaultDepositPct),
    mismatchThresholdPct: sanitizePercent(
      formData.get("mismatchThresholdPct"),
      DEFAULT_RATE_CARD.mismatchThresholdPct
    ),
    services: {
      ...DEFAULT_RATE_CARD.services,
      ...services,
    },
    extras: {
      ...DEFAULT_RATE_CARD.extras,
      ...extras,
    },
  }
}

function validateRateCard(snapshot: RateCardSnapshot) {
  const missingService = SERVICE_RATE_FIELDS.find((field) => !snapshot.services[field.key])
  if (missingService) {
    return `${missingService.label} needs a base price before you can save.`
  }

  const missingExtra = EXTRA_RATE_FIELDS.find((field) => !snapshot.extras[field.key])
  if (missingExtra) {
    return `${missingExtra.label} needs a value before you can save.`
  }

  if (snapshot.currency.length !== 3) {
    return "Currency must use a 3-letter code like USD."
  }

  return null
}

function toRatesJson(snapshot: RateCardSnapshot) {
  return {
    currency: snapshot.currency,
    defaultDepositPct: Number(snapshot.defaultDepositPct),
    services: snapshot.services,
    extras: snapshot.extras,
  }
}

function fromRatesJson(rates: unknown, mismatchThresholdPct: number, paypalEmail?: string | null) {
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) {
    return null
  }

  const value = rates as {
    currency?: string
    defaultDepositPct?: number
    services?: Partial<Record<ServiceRateKey, string>>
    extras?: Partial<Record<ExtraRateKey, string>>
  }

  return {
    currency: value.currency ?? DEFAULT_RATE_CARD.currency,
    paypalEmail: paypalEmail ?? "",
    defaultDepositPct: String(value.defaultDepositPct ?? Number(DEFAULT_RATE_CARD.defaultDepositPct)),
    mismatchThresholdPct: String(mismatchThresholdPct),
    services: {
      ...DEFAULT_RATE_CARD.services,
      ...(value.services ?? {}),
    },
    extras: {
      ...DEFAULT_RATE_CARD.extras,
      ...(value.extras ?? {}),
    },
  } satisfies Partial<RateCardSnapshot>
}

async function readCookieSnapshot() {
  const cookieStore = await cookies()
  const value = cookieStore.get(RATE_CARD_COOKIE)?.value

  if (!value) return null

  try {
    return JSON.parse(value) as Partial<RateCardSnapshot>
  } catch {
    return null
  }
}

export async function getRateCardValues() {
  try {
    const { db } = await import("@/lib/db")
    const creator = await db.creator.findFirst({
      include: { rateCard: true },
      orderBy: { createdAt: "asc" },
    })

    if (creator?.rateCard) {
      const snapshot = fromRatesJson(
        creator.rateCard.rates,
        creator.rateCard.mismatchThresholdPct,
        creator.paypalEmail
      )

      if (snapshot) {
        return toRateCardValues(snapshot, "database", creator.rateCard.updatedAt)
      }
    }
  } catch {
    // Fall back to cookie/default values when the local database is unavailable.
  }

  const cookieSnapshot = await readCookieSnapshot()
  if (cookieSnapshot) {
    return toRateCardValues(cookieSnapshot, "cookie")
  }

  return toRateCardValues(DEFAULT_RATE_CARD, "default")
}

export async function persistRateCard(snapshot: RateCardSnapshot) {
  const cookieStore = await cookies()
  cookieStore.set(RATE_CARD_COOKIE, JSON.stringify(snapshot), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  try {
    const { db } = await import("@/lib/db")
    let creator = await db.creator.findFirst({
      orderBy: { createdAt: "asc" },
    })

    if (!creator) {
      creator = await db.creator.create({
        data: {
          authUserId: crypto.randomUUID(),
          email: "hasna.demo@dmpact.local",
          displayName: "Hasna",
          paypalEmail: snapshot.paypalEmail || null,
          rateCard: {
            create: {
              rates: toRatesJson(snapshot),
              mismatchThresholdPct: Number(snapshot.mismatchThresholdPct),
            },
          },
        },
      })
    } else {
      await db.creator.update({
        where: { id: creator.id },
        data: {
          paypalEmail: snapshot.paypalEmail || null,
          rateCard: {
            upsert: {
              update: {
                rates: toRatesJson(snapshot),
                mismatchThresholdPct: Number(snapshot.mismatchThresholdPct),
              },
              create: {
                rates: toRatesJson(snapshot),
                mismatchThresholdPct: Number(snapshot.mismatchThresholdPct),
              },
            },
          },
        },
      })
    }

    return {
      savedToDatabase: true,
      values: toRateCardValues(snapshot, "database", new Date()),
    }
  } catch {
    return {
      savedToDatabase: false,
      values: toRateCardValues(snapshot, "cookie", new Date()),
    }
  }
}

export function getInitialRateCardActionState(values: RateCardValues): RateCardActionState {
  return {
    status: "idle",
    message: "",
    values,
  }
}

export function validateRateCardSnapshot(snapshot: RateCardSnapshot) {
  return validateRateCard(snapshot)
}
