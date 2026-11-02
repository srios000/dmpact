import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

function PageShell({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-6 px-4 py-6 font-sans md:px-8",
        className,
      )}
      {...props}
    >
      {title ? (
        <div className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="text-[14px] font-medium text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-3">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export { PageShell };
