/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AgGridReact } from "ag-grid-react"
import type {
  ColDef,
  RowClassRules,
  RowClickedEvent,
  SizeColumnsToFitGridStrategy,
} from "ag-grid-community"
import { AllCommunityModule, themeQuartz } from "ag-grid-community"
import { ChevronRightIcon, ListIcon, SearchIcon } from "lucide-react"
import { EmptyState } from "@/components/molecules/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CommissionRow, InvoiceStatus } from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

export interface CommissionQueueTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows: CommissionRow[]
  emptyAction?: React.ReactNode
}

type StateFilter = "all" | CommissionRow["state"]

const stateOptions: Array<{ label: string; value: StateFilter }> = [
  { label: "All states", value: "all" },
  { label: "DP Pending", value: "dp_pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Delivered", value: "delivered" },
  { label: "Completed", value: "completed" },
]

function formatMoney(value: string, currency: string) {
  return `${currency} ${Number(value).toFixed(2)}`
}

function formatDaysLeft(value: number) {
  if (value < 0) return `${Math.abs(value)}d overdue`
  if (value === 0) return "Due today"
  return `${value}d left`
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatInvoiceStatus(status: InvoiceStatus) {
  switch (status) {
    case "pending":
      return "Pending"
    case "paid":
      return "Paid"
    case "overdue":
      return "Overdue"
    default:
      return "Unbilled"
  }
}

function InvoiceStatusPill({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-[11px] font-bold leading-none shadow-none",
        status === "paid" && "border-border bg-primary/6 text-primary",
        status === "pending" && "border-border bg-slate-100 text-slate-700",
        status === "overdue" && "border-rose-200 bg-rose-50 text-rose-700",
        status === "unbilled" && "border-border bg-slate-50 text-slate-500"
      )}
    >
      {formatInvoiceStatus(status)}
    </span>
  )
}

function QueueStatePill({ state }: { state: CommissionRow["state"] }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-[11px] font-bold leading-none uppercase shadow-none",
        state === "completed" && "border-border bg-primary/6 text-primary",
        state === "delivered" && "border-border bg-primary/6 text-primary",
        state === "in_progress" && "border-border bg-primary/8 text-primary",
        state === "agreed" && "border-border bg-slate-100 text-slate-700",
        state === "dp_pending" && "border-border bg-slate-100 text-slate-700",
        state === "negotiation" && "border-border bg-slate-100 text-slate-700",
        state === "draft" && "border-border bg-slate-50 text-slate-500",
        state === "ambiguous" && "border-rose-200 bg-rose-50 text-rose-700",
        state === "paid" && "border-border bg-primary/6 text-primary"
      )}
    >
      {state.replace("_", " ")}
    </span>
  )
}

function CommissionQueueTable({
  rows,
  emptyAction,
  className,
  ...props
}: CommissionQueueTableProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [stateFilter, setStateFilter] = React.useState<StateFilter>("all")

  if (rows.length === 0) {
    return (
      <div className={cn("p-6 md:p-8", className)} {...props}>
        <EmptyState
          icon={ListIcon}
          title="No commissions yet"
          description="New commissions you create will show up here with their payment status."
          action={emptyAction}
        />
      </div>
    )
  }

  const autoSizeStrategy = React.useMemo<SizeColumnsToFitGridStrategy>(
    () => ({
      type: "fitGridWidth",
      defaultMinWidth: 96,
      columnLimits: [
        { colId: "client", minWidth: 220 },
        { colId: "service", minWidth: 170 },
        { colId: "total", minWidth: 136 },
        { colId: "depositStatus", minWidth: 152 },
        { colId: "balanceStatus", minWidth: 152 },
        { colId: "state", minWidth: 148 },
        { colId: "action", minWidth: 64, maxWidth: 64 },
      ],
    }),
    []
  )

  const columnDefs = React.useMemo<ColDef<CommissionRow>[]>(
    () => [
      {
        headerName: "Client",
        field: "client",
        colId: "client",
        flex: 1.3,
        sortable: true,
        filter: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center gap-3 py-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-[11px] font-black text-primary">
              {getInitials(params.data.client)}
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[13px] font-black text-foreground">{params.data.client}</span>
              <span className="text-[11px] font-medium text-muted-foreground">{params.data.id}</span>
            </div>
          </div>
        ),
      },
      {
        headerName: "Service",
        field: "service",
        colId: "service",
        flex: 1.05,
        sortable: true,
        filter: true,
      },
      {
        headerName: "Total",
        field: "total",
        colId: "total",
        flex: 0.82,
        sortable: true,
        comparator: (a: string, b: string) => Number(a) - Number(b),
        cellRenderer: (params: any) => (
          <span className="font-black text-foreground">
            {formatMoney(params.data.total, params.data.currency)}
          </span>
        ),
      },
      {
        headerName: "Currency",
        field: "currency",
        flex: 0.62,
        sortable: true,
        filter: true,
      },
      {
        headerName: "Deposit",
        field: "depositStatus",
        colId: "depositStatus",
        flex: 0.9,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center">
            <InvoiceStatusPill status={params.value as InvoiceStatus} />
          </div>
        ),
      },
      {
        headerName: "Balance",
        field: "balanceStatus",
        colId: "balanceStatus",
        flex: 0.9,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center">
            <InvoiceStatusPill status={params.value as InvoiceStatus} />
          </div>
        ),
      },
      {
        headerName: "State",
        field: "state",
        colId: "state",
        flex: 0.92,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center">
            <QueueStatePill state={params.value} />
          </div>
        ),
      },
      {
        headerName: "Deadline",
        field: "deadline",
        flex: 0.8,
        sortable: true,
      },
      {
        headerName: "Days Left",
        field: "daysLeft",
        flex: 0.78,
        sortable: true,
        comparator: (a: number, b: number) => a - b,
        cellRenderer: (params: any) => (
          <span className={cn("font-black", params.value < 0 ? "text-rose-600" : "text-foreground")}>
            {formatDaysLeft(params.value)}
          </span>
        ),
      },
      {
        headerName: "Overdue",
        field: "overdue",
        flex: 0.58,
        sortable: true,
        cellRenderer: (params: any) => (
          <span className={cn("font-bold", params.value ? "text-rose-600" : "text-muted-foreground")}>
            {params.value ? "Yes" : "No"}
          </span>
        ),
      },
      {
        headerName: "",
        field: "id",
        colId: "action",
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        cellRenderer: () => (
          <div className="flex h-full items-center justify-center">
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </div>
        ),
      },
    ],
    []
  )

  const filteredRows = React.useMemo(() => {
    if (stateFilter === "all") return rows
    return rows.filter((row) => row.state === stateFilter)
  }, [rows, stateFilter])

  const rowClassRules = React.useMemo<RowClassRules<CommissionRow>>(
    () => ({
      "queue-row-overdue": (params) => Boolean(params.data?.overdue),
    }),
    []
  )

  function handleRowClick(event: RowClickedEvent<CommissionRow>) {
    if (!event.data) return
    router.push(`/queue/${event.data.id}`)
  }

  return (
    <div className={cn("grid gap-4 p-6 md:p-8", className)} {...props}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Quick search by client or service..."
            className="h-12 rounded-full border-2 border-white bg-white/95 pl-11 pr-4 text-[13px] font-medium shadow-[0_18px_40px_rgba(30,47,80,0.10)] transition-all focus:border-white focus:ring-4 focus:ring-primary/8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {stateOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={stateFilter === option.value ? "default" : "outline"}
              onClick={() => setStateFilter(option.value)}
              className={cn(
                "h-9 rounded-full px-4 text-[12px] font-bold",
                stateFilter !== option.value && "border-border bg-card"
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="queue-grid-card ag-theme-quartz min-w-0 overflow-hidden rounded-[22px] border-2 border-white bg-card shadow-[0_18px_45px_rgba(30,47,80,0.08)]">
        <AgGridReact<CommissionRow>
          modules={[AllCommunityModule]}
          theme={themeQuartz}
          rowData={filteredRows}
          columnDefs={columnDefs}
          autoSizeStrategy={autoSizeStrategy}
          quickFilterText={search}
          rowHeight={86}
          headerHeight={54}
          domLayout="autoHeight"
          suppressCellFocus
          animateRows
          suppressHorizontalScroll
          pagination={filteredRows.length > 8}
          paginationPageSize={8}
          rowClassRules={rowClassRules}
          onRowClicked={handleRowClick}
          defaultColDef={{
            sortable: true,
            resizable: false,
            minWidth: 96,
            suppressMovable: true,
          }}
        />
      </div>
    </div>
  )
}

export { CommissionQueueTable }
