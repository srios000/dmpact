import { Button } from "@/components/ui/button";
import type { getCommission } from "@/lib/repositories/commission-repository";

type CommissionDetail = NonNullable<Awaited<ReturnType<typeof getCommission>>>;
export type VersionItem = CommissionDetail["versions"][number];

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const AUTHORS: Record<VersionItem["createdBy"], string> = {
  creator: "you",
  client: "the client",
  paypal: "PayPal",
  system: "DMpact",
};

function confirmedBy(version: VersionItem, party: "creator" | "client") {
  return version.confirmations.some(
    (c) => c.party === party && c.contentHash === version.contentHash,
  );
}

function confirmationText(version: VersionItem): string {
  const creator = confirmedBy(version, "creator");
  const client = confirmedBy(version, "client");
  if (creator && client) return "Confirmed by you and the client";
  if (creator) return "Confirmed by you";
  if (client) return "Confirmed by the client";
  return "Not confirmed";
}

export interface AgreementVersionHistoryProps {
  versions: VersionItem[];
  inForceVersion: number | null;
  loadedVersion: number | null;
  onLoad?: (version: VersionItem) => void;
}

function AgreementVersionHistory({
  versions,
  inForceVersion,
  loadedVersion,
  onLoad,
}: AgreementVersionHistoryProps) {
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  const latest = ordered[0]?.version;

  return (
    <section aria-labelledby="versions-heading" className="space-y-3">
      <h2 id="versions-heading" className="font-medium text-foreground">
        Versions
      </h2>
      <ol className="divide-y divide-border">
        {ordered.map((version) => (
          <li
            key={version.id}
            className="flex items-start justify-between gap-3 py-3 first:pt-0"
          >
            <div className="min-w-0 space-y-0.5 text-sm">
              <p className="font-medium text-foreground">
                Version {version.version}
                {version.version === inForceVersion && (
                  <span className="ml-2 text-status-agreed">In force</span>
                )}
              </p>
              <p className="text-muted-foreground">
                {dateFormatter.format(new Date(version.createdAt))}, by{" "}
                {AUTHORS[version.createdBy]}
              </p>
              <p className="text-muted-foreground">
                {confirmationText(version)}
              </p>
            </div>
            {version.version === latest ? (
              <span className="shrink-0 text-sm text-muted-foreground">
                Latest
              </span>
            ) : version.version === loadedVersion ? (
              <span className="shrink-0 text-sm text-primary">Loaded</span>
            ) : (
              onLoad && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onLoad(version)}
                >
                  Load
                </Button>
              )
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export { AgreementVersionHistory };
