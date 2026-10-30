import type { VariantProps } from "class-variance-authority"
import { badgeVariants } from "@/components/ui/status-badge"

export type CommissionState = NonNullable<VariantProps<typeof badgeVariants>["state"]>
export type InvoiceStatus = "unbilled" | "pending" | "paid" | "overdue"

export interface CommissionRow {
  id: string
  client: string
  service: string
  total: string
  currency: string
  depositStatus: InvoiceStatus
  balanceStatus: InvoiceStatus
  state: CommissionState
  deadline: string
  daysLeft: number
  overdue: boolean
}

export const commissionRows: CommissionRow[] = [
  {
    id: "COM-104",
    client: "Aurelia",
    service: "MV Editing",
    total: "120.00",
    currency: "USD",
    depositStatus: "pending",
    balanceStatus: "unbilled",
    state: "dp_pending",
    deadline: "2026-11-08",
    daysLeft: 9,
    overdue: false,
  },
  {
    id: "COM-103",
    client: "Kaito",
    service: "Mix & Master",
    total: "90.00",
    currency: "USD",
    depositStatus: "paid",
    balanceStatus: "unbilled",
    state: "in_progress",
    deadline: "2026-11-04",
    daysLeft: 5,
    overdue: false,
  },
  {
    id: "COM-102",
    client: "Lunaria",
    service: "Illustration",
    total: "180.00",
    currency: "USD",
    depositStatus: "paid",
    balanceStatus: "pending",
    state: "delivered",
    deadline: "2026-10-31",
    daysLeft: 1,
    overdue: false,
  },
  {
    id: "COM-101",
    client: "Noctis",
    service: "Live2D Rigging",
    total: "350.00",
    currency: "USD",
    depositStatus: "overdue",
    balanceStatus: "unbilled",
    state: "agreed",
    deadline: "2026-10-28",
    daysLeft: -2,
    overdue: true,
  },
  {
    id: "COM-100",
    client: "Mirea",
    service: "Thumbnail Pack",
    total: "65.00",
    currency: "USD",
    depositStatus: "paid",
    balanceStatus: "paid",
    state: "completed",
    deadline: "2026-10-25",
    daysLeft: -5,
    overdue: false,
  },
]

export function getCommissionById(id: string) {
  return commissionRows.find((row) => row.id === id) ?? null
}

export function getQueueSummary(rows: CommissionRow[]) {
  const outstanding = rows.reduce((total, row) => {
    const needsDeposit = row.depositStatus === "pending" || row.depositStatus === "overdue"
    const needsBalance = row.balanceStatus === "pending" || row.balanceStatus === "overdue"
    const amount = Number(row.total)

    if (needsDeposit && needsBalance) return total + amount
    if (needsDeposit) return total + amount / 2
    if (needsBalance) return total + amount / 2
    return total
  }, 0)

  const depositsPending = rows.filter(
    (row) => row.depositStatus === "pending" || row.depositStatus === "overdue"
  ).length

  const dueThisWeek = rows.filter((row) => row.daysLeft >= 0 && row.daysLeft <= 7).length

  return {
    outstanding: outstanding.toFixed(2),
    depositsPending,
    dueThisWeek,
  }
}

export type CommissionEventType =
  | "created"
  | "agreement"
  | "invoice"
  | "payment"
  | "delivery"
  | "change_request"
  | "reminder"
  | "status"

export type CommissionActor = "creator" | "client" | "paypal" | "system"

export interface CommissionEvent {
  id: string
  type: CommissionEventType
  title: string
  description: string
  actor: CommissionActor
  timestamp: string
}

export interface CommissionVersion {
  id: string
  version: number
  contentHash: string
  confirmedByCreator: boolean
  confirmedByClient: boolean
  createdAt: string
}

export interface CommissionInvoice {
  id: string
  kind: "deposit" | "balance"
  amount: string
  currency: string
  status: InvoiceStatus
  dueDate: string
}

export interface CommissionDelivery {
  id: string
  label: string
  fileName: string
  contentHash: string
  uploadedAt: string
}

export interface CommissionDetail extends CommissionRow {
  versions: CommissionVersion[]
  invoices: CommissionInvoice[]
  deliveries: CommissionDelivery[]
  events: CommissionEvent[]
}

const STATE_FLOW: CommissionRow["state"][] = [
  "draft",
  "negotiation",
  "agreed",
  "dp_pending",
  "in_progress",
  "delivered",
  "completed",
]

function stateIndex(state: CommissionRow["state"]) {
  const index = STATE_FLOW.indexOf(state)
  return index === -1 ? 2 : index
}

function shortHash(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function buildDetail(row: CommissionRow): CommissionDetail {
  const index = stateIndex(row.state)
  const total = Number(row.total)
  const deposit = (total / 2).toFixed(2)
  const balance = (total - Number(deposit)).toFixed(2)

  const versions: CommissionVersion[] = [
    {
      id: `${row.id}-v1`,
      version: 1,
      contentHash: shortHash(`${row.id}-v1`),
      confirmedByCreator: true,
      confirmedByClient: index >= 2,
      createdAt: index >= 2 ? "8 days ago" : "10 days ago",
    },
  ]
  if (index >= 4) {
    versions.push({
      id: `${row.id}-v2`,
      version: 2,
      contentHash: shortHash(`${row.id}-v2`),
      confirmedByCreator: true,
      confirmedByClient: true,
      createdAt: "6 days ago",
    })
  }

  const invoices: CommissionInvoice[] = [
    {
      id: `${row.id}-DP`,
      kind: "deposit",
      amount: deposit,
      currency: row.currency,
      status: row.depositStatus,
      dueDate: row.deadline,
    },
    {
      id: `${row.id}-BL`,
      kind: "balance",
      amount: balance,
      currency: row.currency,
      status: row.balanceStatus,
      dueDate: row.deadline,
    },
  ]

  const deliveries: CommissionDelivery[] = []
  if (index >= 5) {
    deliveries.push({
      id: `${row.id}-d1`,
      label: "Final delivery",
      fileName: `${slugify(row.service)}-final.zip`,
      contentHash: shortHash(`${row.id}-d1`),
      uploadedAt: "2 days ago",
    })
  }
  if (index >= 6) {
    deliveries.push({
      id: `${row.id}-d2`,
      label: "Revision",
      fileName: `${slugify(row.service)}-revision-1.zip`,
      contentHash: shortHash(`${row.id}-d2`),
      uploadedAt: "1 day ago",
    })
  }

  const timeline: CommissionEvent[] = []
  const addEvent = (
    type: CommissionEventType,
    title: string,
    description: string,
    actor: CommissionActor,
    timestamp: string,
  ) => {
    timeline.push({
      id: `${row.id}-e${timeline.length + 1}`,
      type,
      title,
      description,
      actor,
      timestamp,
    })
  }

  addEvent(
    "created",
    "Commission created",
    `${row.service} · ${row.currency} ${row.total}`,
    "creator",
    "12 days ago",
  )
  if (index >= 1) {
    addEvent(
      "change_request",
      "Client requested changes",
      "Revision notes on scope and deadline.",
      "client",
      "10 days ago",
    )
  }
  if (index >= 2) {
    addEvent(
      "agreement",
      "Agreement confirmed by both parties",
      `Version 1 locked · ${shortHash(`${row.id}-v1`)}`,
      "client",
      "8 days ago",
    )
    addEvent(
      "invoice",
      "Deposit invoice sent",
      `${row.currency} ${deposit} · 50% deposit`,
      "system",
      "8 days ago",
    )
  }
  if (row.depositStatus === "paid") {
    addEvent(
      "payment",
      "Deposit payment received",
      `${row.currency} ${deposit} via PayPal`,
      "paypal",
      "6 days ago",
    )
  }
  if (index >= 4) {
    addEvent("status", "Work started", "Commission moved to in progress.", "creator", "5 days ago")
  }
  if (index >= 5) {
    addEvent(
      "delivery",
      "Delivery uploaded",
      `${deliveries[0]?.fileName ?? "final.zip"} · ${shortHash(`${row.id}-d1`)}`,
      "creator",
      "2 days ago",
    )
    addEvent(
      "invoice",
      "Balance invoice sent",
      `${row.currency} ${balance} · remaining balance`,
      "system",
      "2 days ago",
    )
  }
  if (index >= 6) {
    addEvent(
      "payment",
      "Balance payment received",
      `${row.currency} ${balance} via PayPal`,
      "paypal",
      "1 day ago",
    )
    addEvent(
      "status",
      "Commission completed",
      "All deliverables and payments settled.",
      "system",
      "1 day ago",
    )
  }
  if (row.overdue) {
    addEvent("reminder", "Overdue reminder sent", `Deadline was ${row.deadline}.`, "system", "Today")
  }

  return {
    ...row,
    versions,
    invoices,
    deliveries,
    events: timeline.reverse(),
  }
}

export function getCommissionDetailById(id: string): CommissionDetail | null {
  const row = getCommissionById(id)
  return row ? buildDetail(row) : null
}
