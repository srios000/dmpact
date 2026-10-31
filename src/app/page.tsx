import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  SearchIcon,
  TrendingUpIcon,
  TruckIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard, type KpiCardProps } from "@/components/molecules/kpi-card";
import { ProgressStepper, type StepperStep } from "@/components/molecules/progress-stepper";
import { AiAssistant } from "@/components/organisms/ai-assistant";
import { CommissionQueueTable } from "@/components/organisms/commission-queue-table";
import { commissionRows } from "@/app/queue/queue-data";

const kpis: KpiCardProps[] = [
  {
    title: "Total Revenue",
    value: "$4,820.00",
    change: "+12% this month",
    icon: TrendingUpIcon,
    tone: "info",
    trend: "up",
  },
  {
    title: "Money Outstanding",
    value: "$1,200.00",
    change: "Expected soon",
    icon: WalletIcon,
    tone: "primary",
    trend: "flat",
  },
  {
    title: "Commissions Due",
    value: "3",
    change: "This week",
    icon: ClockIcon,
    tone: "neutral",
    trend: "flat",
  },
  {
    title: "Overdue Payment",
    value: "1",
    change: "Action needed",
    icon: AlertTriangleIcon,
    tone: "warning",
    trend: "down",
  },
];

const steps: StepperStep[] = [
  { label: "Agreement", active: true },
  { label: "DP Payment", active: true },
  { label: "Work In Progress", active: false, current: true },
  { label: "Final Payment", active: false },
  { label: "Final Delivery", active: false },
];

const rows = commissionRows;

const activity = [
  {
    title: "Invoice #INV-2025-104",
    time: "2m ago",
    icon: WalletIcon,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    title: "Payment: $150 (DP)",
    time: "5m ago",
    icon: CheckCircleIcon,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    title: "Proof uploaded",
    time: "10m ago",
    icon: TruckIcon,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-6 font-sans md:px-8">
      {/* Top Navigation */}
      <div className="flex flex-col items-center justify-between gap-6 py-2 md:flex-row">
        <div className="relative w-full max-w-xl">
          <SearchIcon className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search commissions, clients..."
            aria-label="Search commissions and clients"
            className="w-full rounded-full border border-border bg-muted/50 py-2.5 pr-16 pl-12 text-[13px] font-medium shadow-sm transition-all focus:ring-2 focus:ring-primary/5 focus:outline-none"
          />
          <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
            <span className="text-[12px]">⌘</span> K
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-6 md:w-auto">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative rounded-full hover:bg-muted"
          >
            <BellIcon className="size-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-background" />
          </Button>

          <div className="flex items-center gap-3 border-l border-border pl-4">
            <div className="flex items-center gap-3 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-muted/60">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-md">
                HP
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground">Hasna</span>
                <ChevronDownIcon className="size-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Header */}
      <div className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
            Welcome back, Hasna!
          </h1>
          <p className="text-[14px] font-medium text-muted-foreground">
            Here&apos;s your commission overview at a glance.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl border-border bg-card px-4 py-2 text-[13px] font-bold text-foreground shadow-sm hover:bg-muted"
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          This Month
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => (
          <KpiCard key={item.title} {...item} />
        ))}
      </div>

      <div className="mt-2 grid items-start gap-8 lg:grid-cols-12">
        {/* Left Section: Commission Queue Table */}
        <div className="lg:col-span-8">
          <Card className="overflow-hidden rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-6 md:p-8 md:pb-6">
              <div className="flex items-center gap-3">
                <CardTitle className="text-[17px] font-black tracking-tight text-foreground uppercase">
                  Commission Queue
                </CardTitle>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                  {rows.length}
                </span>
              </div>
              <Link
                href="/queue"
                className="group flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
              >
                View All
                <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-1" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <CommissionQueueTable rows={rows} />
            </CardContent>
          </Card>
        </div>

        {/* Right Section: AI Agreement Assistant */}
        <div className="space-y-6 lg:col-span-4">
          <AiAssistant />
        </div>
      </div>

      <div className="mt-2 grid items-stretch gap-8 pb-8 lg:grid-cols-12">
        {/* Commission Flow Progress */}
        <div className="lg:col-span-8">
          <Card className="h-full rounded-[32px] border-2 border-white bg-card p-6 shadow-[0_15px_50px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1 md:p-8">
            <div className="mb-10 flex items-center justify-between">
              <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
                Commission Journey
              </CardTitle>
              <Link href="/queue" className="text-[12px] font-bold text-primary hover:underline">
                View Journey Details →
              </Link>
            </div>
            <div className="py-4">
              <ProgressStepper steps={steps} />
            </div>
          </Card>
        </div>

        {/* Recent Activity List */}
        <div className="lg:col-span-4">
          <Card className="h-full rounded-[32px] border-2 border-white bg-card p-6 shadow-[0_15px_50px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1 md:p-8">
            <div className="mb-8 flex items-center justify-between">
              <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
                Recent Activity
              </CardTitle>
              <Link href="/" className="text-[12px] font-bold text-primary hover:underline">
                All
              </Link>
            </div>
            <div className="relative space-y-8">
              <div className="absolute top-2 bottom-2 left-5 -z-0 w-[6px] rounded-full bg-muted shadow-inner" />
              {activity.map((item) => (
                <div key={item.title} className="group relative z-10 flex cursor-pointer items-center gap-4">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-white ${item.bg} shadow-[0_4px_10px_rgba(0,0,0,0.06)] transition-transform group-hover:scale-105`}
                  >
                    <item.icon className={`size-5 ${item.color}`} />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[12px] font-bold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
