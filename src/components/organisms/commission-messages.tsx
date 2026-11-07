import * as React from "react";
import { MessageSquareIcon, MessagesSquareIcon, SendIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FollowUpMessage = {
  id: string;
  message: string;
  createdAt: string;
};

export type ChangeRequestMessage = {
  id: string;
  version: number;
  message: string;
  createdAt: string;
};

const stampFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export interface CommissionMessagesProps extends React.HTMLAttributes<HTMLElement> {
  sourceDm: string;
  followUpDms: FollowUpMessage[];
  changeRequests: ChangeRequestMessage[];
}

function SubHeading({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Icon className="size-4 text-muted-foreground" />
      {title}
    </h3>
  );
}

function CommissionMessages({
  className,
  sourceDm,
  followUpDms,
  changeRequests,
  ...props
}: CommissionMessagesProps) {
  return (
    <section
      className={cn("space-y-5 rounded-xl border bg-card p-5", className)}
      {...props}
    >
      <header className="space-y-1">
        <h2 className="font-medium text-foreground">Messages</h2>
        <p className="text-sm text-muted-foreground">
          The original DM, the messages you sent with new versions, and the
          client&apos;s change requests.
        </p>
      </header>

      <div className="space-y-2">
        <SubHeading icon={MessageSquareIcon} title="Original DM" />
        <p className="max-h-56 overflow-y-auto rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {sourceDm || "No original DM stored."}
        </p>
      </div>

      <div className="space-y-2">
        <SubHeading icon={SendIcon} title="Follow-up messages" />
        {followUpDms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No follow-up messages sent yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {followUpDms.map((message) => (
              <li
                key={message.id}
                className="rounded-lg border bg-background p-3"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {message.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sent {stampFormatter.format(new Date(message.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <SubHeading icon={MessagesSquareIcon} title="Change requests" />
        {changeRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The client hasn&apos;t asked for changes.
          </p>
        ) : (
          <ul className="space-y-2">
            {changeRequests.map((request) => (
              <li
                key={request.id}
                className="rounded-lg border border-warning/30 bg-warning/5 p-3"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {request.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  On version {request.version} ·{" "}
                  {stampFormatter.format(new Date(request.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export { CommissionMessages };
