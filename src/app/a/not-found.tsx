export default function ClientNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-start gap-6 rounded-[2.5rem] bg-sidebar p-8 text-sidebar-foreground shadow-xl">
        <span className="rounded-md border-2 border-sidebar-border px-3 py-1 text-xs font-black tracking-[0.2em] text-sidebar-accent-foreground uppercase">
          DMpact
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-sidebar-accent-foreground">
            This link doesn&apos;t work
          </h1>
          <p>
            It may be wrong or out of date. Ask the creator who sent it for a
            new one.
          </p>
        </div>
      </div>
    </main>
  );
}
