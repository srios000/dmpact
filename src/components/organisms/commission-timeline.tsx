import * as React from "react"
import {
  BellIcon,
  CheckCircleIcon,
  FileTextIcon,
  HandshakeIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  TruckIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  EventTimeline,
  type TimelineEvent,
  type TimelineTone,
} from "@/components/molecules/event-timeline"
import type {
  CommissionActor,
  CommissionEvent,
  CommissionEventType,
} from "@/app/queue/queue-data"
import { cn } from "@/lib/utils"

const EVENT_STYLE: Record<CommissionEventType, { icon: LucideIcon; tone: TimelineTone }> = {
  created: { icon: FileTextIcon, tone: "neutral" },
  change_request: { icon: MessageSquareIcon, tone: "warning" },
  agreement: { icon: HandshakeIcon, tone: "primary" },
  invoice: { icon: WalletIcon, tone: "warning" },
  payment: { icon: CheckCircleIcon, tone: "success" },
  delivery: { icon: TruckIcon, tone: "primary" },
  reminder: { icon: BellIcon, tone: "danger" },
  status: { icon: RefreshCwIcon, tone: "neutral" },
}

const ACTOR_LABEL: Record<CommissionActor, string> = {
  creator: "You",
  client: "Client",
  paypal: "PayPal",
  system: "System",
}

export interface CommissionTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  events: CommissionEvent[]
}

function CommissionTimeline({ className, events, ...props }: CommissionTimelineProps) {
  const items: TimelineEvent[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    meta: `${ACTOR_LABEL[event.actor]} · ${event.timestamp}`,
    tone: EVENT_STYLE[event.type].tone,
    icon: EVENT_STYLE[event.type].icon,
  }))

  return (
    <Card
      className={cn(
        "rounded-[32px] border-2 border-white bg-card shadow-[0_15px_50px_rgba(0,0,0,0.1)]",
        className
      )}
      {...props}
    >
      <CardHeader className="p-6 pb-2 md:p-8 md:pb-2">
        <CardTitle className="text-[15px] font-black tracking-tight text-foreground uppercase">
          Event Timeline
        </CardTitle>
        <p className="text-[12px] font-medium text-muted-foreground">
          Every agreement, invoice, delivery and status change in one place.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-4 md:p-8 md:pt-4">
        <EventTimeline events={items} />
      </CardContent>
    </Card>
  )
}

export { CommissionTimeline }
