import { cva } from "class-variance-authority";

const markVariants = cva(
  "rounded-sm px-0.5 text-foreground underline underline-offset-4",
  {
    variants: {
      kind: {
        term: "bg-primary/15 decoration-primary",
        flag: "bg-warning/15 decoration-warning decoration-dashed",
      },
    },
    defaultVariants: {
      kind: "term",
    },
  },
);

const resultVariants = cva("", {
  variants: {
    kind: {
      term: "text-foreground",
      flag: "text-warning",
    },
  },
  defaultVariants: {
    kind: "term",
  },
});

const RESULTS = [
  { label: "Service", value: "Mix and master", kind: "term" },
  { label: "Price", value: "150 USD", kind: "term" },
  { label: "Deadline", value: "The 20th of which month?", kind: "flag" },
] as const;

export function DmExample() {
  return (
    <figure className="w-full max-w-md space-y-8">
      <blockquote className="rounded-2xl rounded-bl-sm bg-secondary px-5 py-4 text-base leading-relaxed text-foreground/90">
        halo kak! mau commission{" "}
        <mark className={markVariants({ kind: "term" })}>mix + master</mark>{" "}
        cover lagu buat debut aku 🙏 budget{" "}
        <mark className={markVariants({ kind: "term" })}>$150</mark>, bisa
        selesai sebelum{" "}
        <mark className={markVariants({ kind: "flag" })}>tanggal 20</mark>?
      </blockquote>

      <dl className="space-y-3 text-sm">
        {RESULTS.map((row) => (
          <div key={row.label} className="flex gap-4">
            <dt className="w-20 shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className={resultVariants({ kind: row.kind })}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <figcaption className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Paste a client&apos;s DM. DMpact pulls out the terms and flags what
        still needs an answer before you send the agreement.
      </figcaption>
    </figure>
  );
}
