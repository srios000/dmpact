"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type CellKeyDownEvent,
  type ColDef,
  type GridState,
  type ICellRendererParams,
  type IRowNode,
  type ModelUpdatedEvent,
  type RowClickedEvent,
  type StateUpdatedEvent,
  type ValueFormatterParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  CheckIcon,
  CircleAlertIcon,
  DownloadIcon,
  LinkIcon,
  PlayIcon,
  RotateCwIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { QueueSummaryBar } from "@/components/molecules/queue-summary";
import { StateFilter } from "@/components/molecules/state-filter";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DaysLeft } from "@/components/ui/days-left";
import { Input } from "@/components/ui/input";
import { PaymentBadge } from "@/components/ui/payment-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { currencyExponent, fromMinor, toMinor } from "@/lib/money/decimal";
import {
  daysLeft,
  deadlineTone,
  overduePayment,
  paymentLabel,
  paymentTone,
  summarize,
  type MoneyByCurrency,
  type QueueRow,
} from "@/lib/queue/queue";
import type { PaymentStatus } from "@/lib/repositories/shared";
import { SERVICE_LABELS, type ServiceType } from "@/lib/schema/agreement";
import {
  canRetryBalanceInvoice,
  canRetryDepositInvoice,
} from "@/lib/state-machine/deposit-retry";
import { STATE_LABELS } from "@/lib/state-machine/labels";
import type { CommissionState } from "@/lib/state-machine/rules";

ModuleRegistry.registerModules([AllCommunityModule]);

const surface = "color-mix(in srgb, var(--popover) 40%, var(--background))";

const queueTheme = themeQuartz.withParams({
  backgroundColor: surface,
  foregroundColor: "var(--foreground)",
  textColor: "var(--foreground)",
  headerBackgroundColor: surface,
  headerTextColor: "var(--muted-foreground)",
  headerFontWeight: 500,
  headerFontSize: 13,
  borderColor: "var(--border)",
  rowHoverColor: "color-mix(in oklab, var(--foreground) 4%, transparent)",
  accentColor: "var(--primary)",
  valueChangeValueHighlightBackgroundColor:
    "color-mix(in oklab, var(--primary) 30%, transparent)",
  chromeBackgroundColor: surface,
  inputBackgroundColor: "var(--background)",
  inputBorder: { color: "var(--input)" },
  menuBackgroundColor: "var(--popover)",
  tooltipBackgroundColor: "var(--popover)",
  tooltipTextColor: "var(--popover-foreground)",
  fontFamily: "inherit",
  fontSize: 14,
  wrapperBorderRadius: 12,
  spacing: 7,
  rowHeight: 60,
  headerHeight: 40,
});

const LAYOUT_KEY = "dmpact.queue.layout";
const REFRESH_MS = 20_000;
const EXPORT_COLUMNS = [
  "client",
  "service",
  "total",
  "currency",
  "deposit",
  "balance",
  "state",
  "deadline",
  "daysLeft",
  "overdue",
];

type RowAction = (
  commissionId: string,
) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;

type RowActionHandlers = {
  startWork: RowAction;
  retryDeposit: RowAction;
  retryBalance: RowAction;
};

type QueueError = { title: string; message: string };

type Footer = { count: number; totals: MoneyByCurrency };
type GridContext = { footer: Footer; today: string };

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const PAYMENT_ORDER: Record<PaymentStatus["status"], number> = {
  sent: 0,
  not_created: 1,
  draft: 1,
  paid: 2,
  not_required: 3,
  cancelled: 4,
};

function savedLayout(): GridState | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as GridState) : undefined;
  } catch {
    return undefined;
  }
}

function saveLayout(event: StateUpdatedEvent<QueueRow>) {
  const { columnOrder, columnSizing, sort } = event.state;
  window.localStorage.setItem(
    LAYOUT_KEY,
    JSON.stringify({ columnOrder, columnSizing, sort }),
  );
}

function footerOf(rows: QueueRow[]): Footer {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.total || !row.currency) continue;
    const minor = toMinor(row.total, currencyExponent(row.currency));
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + minor);
  }
  return {
    count: rows.length,
    totals: [...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, minor]) => ({
        currency,
        amount: fromMinor(minor, currencyExponent(currency)),
      })),
  };
}

function isFooter(p: { node?: IRowNode | null }): boolean {
  return p.node?.rowPinned === "bottom";
}

function rowOf(p: { data?: QueueRow; node?: IRowNode | null }) {
  return p.data && !isFooter(p) ? p.data : null;
}

function canStartWork(row: QueueRow): boolean {
  return (
    row.state === "dp_paid" ||
    (row.state === "agreed" && row.deposit.status === "not_required")
  );
}

function ActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            data-row-action
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RowActions({
  row,
  actions,
  onError,
}: {
  row: QueueRow;
  actions: RowActionHandlers;
  onError: (error: QueueError | null) => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  async function copyLink() {
    if (!row.clientToken) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/a/${row.clientToken}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function run(action: RowAction, title: string) {
    onError(null);
    startTransition(async () => {
      const result = await action(row.id);
      if (!result.ok) {
        onError({ title, message: `${row.title}. ${result.error.message}` });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex h-full items-center gap-0.5">
      <ActionButton
        label={
          row.clientToken
            ? copied
              ? "Copied"
              : "Copy client link"
            : "Not sent to the client yet"
        }
        disabled={!row.clientToken}
        onClick={copyLink}
      >
        {copied ? <CheckIcon /> : <LinkIcon />}
      </ActionButton>
      {canRetryDepositInvoice(row.state, row.deposit.status) ? (
        <ActionButton
          label="Send deposit invoice again"
          disabled={pending}
          onClick={() =>
            run(actions.retryDeposit, "Couldn't send the deposit invoice")
          }
        >
          <RotateCwIcon />
        </ActionButton>
      ) : canRetryBalanceInvoice(row.state, row.balance.status) ? (
        <ActionButton
          label="Send balance invoice again"
          disabled={pending}
          onClick={() =>
            run(actions.retryBalance, "Couldn't send the balance invoice")
          }
        >
          <RotateCwIcon />
        </ActionButton>
      ) : (
        <ActionButton
          label={
            canStartWork(row)
              ? "Mark in progress"
              : "Can start once the deposit is paid"
          }
          disabled={!canStartWork(row) || pending}
          onClick={() => run(actions.startWork, "Couldn't start the work")}
        >
          <PlayIcon />
        </ActionButton>
      )}
      <ActionButton label="Delivery upload isn't available yet" disabled>
        <UploadIcon />
      </ActionButton>
    </div>
  );
}

function ClientCell(p: ICellRendererParams<QueueRow, string, GridContext>) {
  if (isFooter(p)) {
    const { count } = p.context.footer;
    return (
      <span className="font-medium text-muted-foreground">
        {count} {count === 1 ? "commission" : "commissions"}
      </span>
    );
  }
  if (!p.data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <span className="truncate font-medium">{p.value}</span>
      <span className="truncate text-sm text-muted-foreground">
        {p.data.title}
      </span>
    </div>
  );
}

function blankOnFooter(
  format: (p: ValueFormatterParams<QueueRow>) => string,
): (p: ValueFormatterParams<QueueRow>) => string {
  return (p) => (isFooter(p) ? "" : format(p));
}

function buildColumns(
  actions: RowActionHandlers,
  onError: (error: QueueError | null) => void,
): ColDef<QueueRow>[] {
  const paymentColumn = (kind: "deposit" | "balance"): ColDef<QueueRow> => ({
    headerName: kind === "deposit" ? "Deposit" : "Balance",
    colId: kind,
    width: 130,
    enableCellChangeFlash: true,
    valueGetter: (p) => {
      const row = rowOf(p);
      if (!row) return "";
      const late = overduePayment(row, p.context.today) === kind;
      return paymentLabel(row[kind], late);
    },
    comparator: (_a, _b, nodeA, nodeB) =>
      PAYMENT_ORDER[nodeA.data![kind].status] -
      PAYMENT_ORDER[nodeB.data![kind].status],
    cellRenderer: (p: ICellRendererParams<QueueRow, string, GridContext>) => {
      const row = rowOf(p);
      if (!row) return null;
      const late = overduePayment(row, p.context.today) === kind;
      return (
        <PaymentBadge tone={paymentTone(row[kind], late)}>
          {p.value}
        </PaymentBadge>
      );
    },
  });

  return [
    {
      headerName: "Client",
      colId: "client",
      minWidth: 220,
      flex: 2,
      valueGetter: (p) => rowOf(p)?.clientName ?? "Unnamed client",
      tooltipValueGetter: (p) => {
        const row = rowOf(p);
        return row
          ? [row.clientName, row.clientHandle, row.title]
              .filter(Boolean)
              .join("\n")
          : undefined;
      },
      getQuickFilterText: (p) =>
        [p.data?.clientName, p.data?.clientHandle, p.data?.title]
          .filter(Boolean)
          .join(" "),
      cellRenderer: ClientCell,
    },
    {
      headerName: "Service",
      colId: "service",
      minWidth: 130,
      flex: 1,
      valueGetter: (p) => {
        const row = rowOf(p);
        return row
          ? (SERVICE_LABELS[row.serviceType as ServiceType] ?? row.serviceType)
          : "";
      },
    },
    {
      headerName: "Total",
      colId: "total",
      width: 130,
      type: "rightAligned",
      filter: "agNumberColumnFilter",
      valueGetter: (p) => {
        const row = rowOf(p);
        return row?.total ? Number(row.total) : null;
      },
      valueFormatter: (p) =>
        isFooter(p)
          ? (p.context as GridContext).footer.totals
              .map((t) => `${t.currency} ${t.amount}`)
              .join(", ")
          : (p.data?.total ?? "Not set"),
      cellClass: (p) =>
        isFooter(p) ? "tabular-nums font-medium" : "tabular-nums",
    },
    {
      headerName: "Currency",
      field: "currency",
      width: 110,
      valueFormatter: blankOnFooter((p) => p.value ?? ""),
    },
    paymentColumn("deposit"),
    paymentColumn("balance"),
    {
      headerName: "State",
      colId: "state",
      width: 150,
      enableCellChangeFlash: true,
      valueGetter: (p) => {
        const row = rowOf(p);
        return row ? STATE_LABELS[row.state] : "";
      },
      cellRenderer: (p: ICellRendererParams<QueueRow>) => {
        const row = rowOf(p);
        return row && <StatusBadge state={row.state} />;
      },
    },
    {
      headerName: "Deadline",
      field: "deadline",
      width: 120,
      filter: "agDateColumnFilter",
      filterValueGetter: (p) =>
        p.data?.deadline ? new Date(`${p.data.deadline}T00:00:00`) : null,
      valueFormatter: blankOnFooter((p) =>
        p.value
          ? dateFormatter.format(new Date(`${p.value}T00:00:00Z`))
          : "Not set",
      ),
    },
    {
      headerName: "Days left",
      colId: "daysLeft",
      width: 130,
      filter: "agNumberColumnFilter",
      valueGetter: (p) => {
        const row = rowOf(p);
        return row ? daysLeft(row, p.context.today) : null;
      },
      comparator: (a: number | null, b: number | null) =>
        (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER),
      cellRenderer: (p: ICellRendererParams<QueueRow, number, GridContext>) => {
        const row = rowOf(p);
        return (
          row && (
            <DaysLeft
              days={p.value ?? null}
              tone={deadlineTone(row, p.context.today)}
            />
          )
        );
      },
    },
    {
      headerName: "Overdue",
      colId: "overdue",
      width: 130,
      enableCellChangeFlash: true,
      valueGetter: (p) => {
        const row = rowOf(p);
        const kind = row ? overduePayment(row, p.context.today) : null;
        return kind === "deposit"
          ? "Deposit"
          : kind === "balance"
            ? "Balance"
            : "";
      },
      cellRenderer: (p: ICellRendererParams<QueueRow, string>) =>
        p.value ? <PaymentBadge tone="late">{p.value}</PaymentBadge> : null,
    },
    {
      headerName: "",
      colId: "actions",
      width: 128,
      pinned: "right",
      sortable: false,
      filter: false,
      resizable: false,
      suppressHeaderMenuButton: true,
      suppressMovable: true,
      cellRenderer: (p: ICellRendererParams<QueueRow>) => {
        const row = rowOf(p);
        return (
          row && <RowActions row={row} actions={actions} onError={onError} />
        );
      },
    },
  ];
}

export interface CommissionQueueProps {
  rows: QueueRow[];
  today: string;
  startWork: RowAction;
  retryDeposit: RowAction;
  retryBalance: RowAction;
}

function CommissionQueue({
  rows,
  today,
  startWork,
  retryDeposit,
  retryBalance,
}: CommissionQueueProps) {
  const router = useRouter();
  const gridRef = React.useRef<AgGridReact<QueueRow>>(null);
  const [search, setSearch] = React.useState("");
  const [state, setState] = React.useState<CommissionState | null>(null);
  const [error, setError] = React.useState<QueueError | null>(null);
  const [footer, setFooter] = React.useState<Footer>(() => footerOf(rows));
  const [initialState] = React.useState(savedLayout);
  const stateRef = React.useRef(state);

  const summary = React.useMemo(() => summarize(rows, today), [rows, today]);
  const counts = React.useMemo(() => {
    const map: Partial<Record<CommissionState, number>> = {};
    for (const row of rows) map[row.state] = (map[row.state] ?? 0) + 1;
    return map;
  }, [rows]);
  const columns = React.useMemo(
    () => buildColumns({ startWork, retryDeposit, retryBalance }, setError),
    [startWork, retryDeposit, retryBalance],
  );
  const context = React.useMemo<GridContext>(
    () => ({ footer, today }),
    [footer, today],
  );
  const pinnedBottom = React.useMemo(() => [{ id: "footer" }], []);
  const defaultColDef = React.useMemo<ColDef<QueueRow>>(
    () => ({
      sortable: true,
      resizable: true,
      filter: "agTextColumnFilter",
      cellClass: "flex items-center",
    }),
    [],
  );

  const liveApi = React.useCallback(() => {
    const api = gridRef.current?.api;
    return api && !api.isDestroyed() ? api : null;
  }, []);

  React.useEffect(() => {
    stateRef.current = state;
    liveApi()?.onFilterChanged();
  }, [state, liveApi]);

  React.useEffect(() => {
    const api = liveApi();
    const node = api?.getPinnedBottomRow(0);
    if (api && node) {
      api.refreshCells({ rowNodes: [node], force: true, suppressFlash: true });
    }
  }, [footer, liveApi]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  function onModelUpdated(event: ModelUpdatedEvent<QueueRow>) {
    const shown: QueueRow[] = [];
    event.api.forEachNodeAfterFilter((node) => {
      if (node.data) shown.push(node.data);
    });
    const next = footerOf(shown);
    setFooter((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
  }

  function clearFilters() {
    setSearch("");
    setState(null);
    liveApi()?.setFilterModel(null);
  }

  function exportCsv() {
    liveApi()?.exportDataAsCsv({
      fileName: `dmpact-queue-${today}.csv`,
      columnKeys: EXPORT_COLUMNS,
      skipPinnedBottom: true,
    });
  }

  function openRow(row: QueueRow | undefined) {
    if (row) router.push(`/commissions/${row.id}`);
  }

  function onRowClicked(event: RowClickedEvent<QueueRow>) {
    if (event.node.rowPinned) return;
    const target = event.event?.target;
    if (target instanceof Element && target.closest("[data-row-action]")) {
      return;
    }
    openRow(event.data);
  }

  function onCellKeyDown(event: CellKeyDownEvent<QueueRow>) {
    const key = (event.event as KeyboardEvent | null)?.key;
    if (
      key === "Enter" &&
      !event.node.rowPinned &&
      event.column.getColId() !== "actions"
    ) {
      openRow(event.data);
    }
  }

  return (
    <div className="space-y-5">
      <QueueSummaryBar summary={summary} />

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>{error.title}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              onClick={() => setError(null)}
            >
              <XIcon />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <StateFilter
          counts={counts}
          total={rows.length}
          value={state}
          onChange={setState}
        />
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search by client or title"
              placeholder="Search clients"
              className="h-9 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={exportCsv}
          >
            <DownloadIcon data-icon="inline-start" />
            Export CSV
          </Button>
        </div>
      </div>

      <AgGridReact<QueueRow>
        ref={gridRef}
        theme={queueTheme}
        rowData={rows}
        pinnedBottomRowData={pinnedBottom}
        columnDefs={columns}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => p.data.id}
        initialState={initialState}
        onStateUpdated={saveLayout}
        onModelUpdated={onModelUpdated}
        domLayout="autoHeight"
        quickFilterText={search}
        isExternalFilterPresent={() => stateRef.current !== null}
        doesExternalFilterPass={(node: IRowNode<QueueRow>) =>
          node.data?.state === stateRef.current
        }
        rowClassRules={{
          "queue-row-overdue": (p) =>
            !!p.data &&
            !p.node.rowPinned &&
            overduePayment(p.data, today) !== null,
          "cursor-pointer": (p) => !p.node.rowPinned,
        }}
        onRowClicked={onRowClicked}
        onCellKeyDown={onCellKeyDown}
        tooltipShowDelay={400}
        suppressNoRowsOverlay
      />

      {footer.count === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            No commissions match these filters.
          </p>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

export { CommissionQueue };
