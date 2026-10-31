import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CreatorNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="text-muted-foreground">
        It may have been moved, or the commission may not be yours.
      </p>
      <Button nativeButton={false} render={<Link href="/commissions" />}>
        Go to your queue
      </Button>
    </div>
  );
}
