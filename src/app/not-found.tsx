import Link from "next/link"
import { CompassIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/molecules/empty-state"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-6">
      <EmptyState
        surface="plain"
        size="lg"
        icon={CompassIcon}
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
        action={
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-9 rounded-xl px-4 text-[12px] font-bold"
            )}
          >
            Back to dashboard
          </Link>
        }
      />
    </div>
  )
}
