import * as React from "react";
import {
  BellIcon,
  CircleCheckIcon,
  CircleXIcon,
  FilePlusIcon,
  FileTextIcon,
  HandshakeIcon,
  MessageSquareIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import {
  EventTimeline,
  type TimelineEvent,
  type TimelineTone,
} from "@/components/molecules/event-timeline";
import { STATE_LABELS } from "@/lib/state-machine/labels";
import type { Actor, CommissionState } from "@/lib/state-machine/rules";
import { cn } from "@/lib/utils";

export type TimelineEventInput = {
  id: string;
  type: string;
  fromState: CommissionState | null;
  toState: CommissionState | null;
  actor: Actor;
  reason: string | null;
  at: string;
};

type EventStyle = { icon: LucideIcon; tone: TimelineTone; title: string };

const FALLBACK: EventStyle = {
  icon: FileTextIcon,
  tone: "neutral",
  title: "Commission updated",
};

const EVENT_STYLE: Record<string, EventStyle> = {
  created: { icon: FilePlusIcon, tone: "neutral", title: "Commission created" },
  transition: { icon: RefreshCwIcon, tone: "primary", title: "Status changed" },
  version_saved: {
    icon: FileTextIcon,
    tone: "primary",
    title: "Agreement version saved",
  },
  client_confirmed: {
    icon: HandshakeIcon,
    tone: "success",
    title: "Client confirmed the agreement",
  },
  change_requested: {
    icon: MessageSquareIcon,
    tone: "warning",
    title: "Client requested changes",
  },
  delivery_logged: {
    icon: UploadIcon,
    tone: "primary",
    title: "Delivery logged",
  },
  dispute_evidence_sent: {
    icon: UploadIcon,
    tone: "primary",
    title: "Evidence sent to PayPal dispute",
  },
  invoice_sent: {
    icon: ReceiptTextIcon,
    tone: "warning",
    title: "Invoice sent",
  },
  invoice_paid: {
    icon: CircleCheckIcon,
    tone: "success",
    title: "Invoice paid",
  },
  invoice_cancelled: {
    icon: CircleXIcon,
    tone: "danger",
    title: "Invoice cancelled",
  },
  invoice_reminded: {
    icon: BellIcon,
    tone: "warning",
    title: "Payment reminder sent",
  },
  effect_failed: {
    icon: TriangleAlertIcon,
    tone: "danger",
    title: "PayPal action failed",
  },
};

const ACTOR_LABEL: Record<Actor, string> = {
  creator: "You",
  client: "Client",
  paypal: "PayPal",
  system: "System",
};

const stampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function transitionTitle(event: TimelineEventInput): string {
  if (event.fromState && event.toState) {
    return `${STATE_LABELS[event.fromState]} → ${STATE_LABELS[event.toState]}`;
  }
  return event.toState ? STATE_LABELS[event.toState] : FALLBACK.title;
}

export interface CommissionTimelineProps extends React.HTMLAttributes<HTMLElement> {
  events: TimelineEventInput[];
}

function CommissionTimeline({
  className,
  events,
  ...props
}: CommissionTimelineProps) {
  const items: TimelineEvent[] = [...events].reverse().map((event) => {
    const style = EVENT_STYLE[event.type] ?? FALLBACK;
    return {
      id: event.id,
      title: event.type === "transition" ? transitionTitle(event) : style.title,
      description: event.reason,
      meta: `${ACTOR_LABEL[event.actor]} · ${stampFormatter.format(new Date(event.at))}`,
      tone: style.tone,
      icon: style.icon,
    };
  });

  return (
    <section
      className={cn("space-y-4 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Every agreement, invoice, delivery and status change, newest first.
        </p>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing has happened on this commission yet.
        </p>
      ) : (
        <EventTimeline events={items} />
      )}
    </section>
  );
}

export { CommissionTimeline };
