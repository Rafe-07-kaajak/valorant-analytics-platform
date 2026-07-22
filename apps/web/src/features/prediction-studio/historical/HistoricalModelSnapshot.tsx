import type { CSSProperties } from "react";
import { Layers } from "lucide-react";
import type { RealPredictionReadiness } from "@repo/shared";
import { Card } from "@repo/ui";

export interface HistoricalModelSnapshotProps {
  readiness: RealPredictionReadiness;
}

/**
 * Snapshot-card identifiers are a quick-glance summary, not the primary
 * label for a raw ID (the full value belongs in a result's own provenance
 * disclosure -- see HistoricalMatchResult). Truncated with the full value
 * kept on `title` so it's still available on demand.
 */
function truncateHash(value: string, length = 10): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

/**
 * TASK-056 — a read-only "what's active" snapshot, deliberately not a
 * model-version selector: the real-prediction backend serves exactly one
 * frozen Elo model today (docs/35, "Known limitations" -- "Selected model is
 * Elo"), so a dropdown with a single always-selected option would be
 * misleading rather than useful. This surfaces the same already-fetched
 * `readiness` fields the section already holds, made visually central per
 * the requirement that the active model feel central to the replay, without
 * inventing selection logic the backend doesn't support.
 */
export function HistoricalModelSnapshot({ readiness }: HistoricalModelSnapshotProps) {
  return (
    <Card
      variant="result"
      style={{ "--border-accent": "var(--color-accent-amber)" } as CSSProperties}
      className="flex flex-col gap-2xs"
    >
      <div className="flex items-center gap-2xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Layers aria-hidden="true" className="size-3.5" />
        Active model snapshot
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-sm gap-y-2xs text-xs">
        <dt className="text-muted-foreground">Model version</dt>
        <dd className="truncate font-mono text-foreground" title={readiness.currentModelVersion}>
          {readiness.currentModelVersion ? truncateHash(readiness.currentModelVersion) : "Unknown"}
        </dd>
        <dt className="text-muted-foreground">Feature dataset</dt>
        <dd className="truncate font-mono text-foreground" title={readiness.sourceFeatureDatasetVersion}>
          {readiness.sourceFeatureDatasetVersion ? truncateHash(readiness.sourceFeatureDatasetVersion) : "Unknown"}
        </dd>
        {readiness.sourceMode ? (
          <>
            <dt className="text-muted-foreground">Data source</dt>
            <dd className="text-foreground">{readiness.sourceMode === "runtime-package" ? "Runtime package" : "Local dataset"}</dd>
          </>
        ) : null}
        {readiness.runtimePackageVersion ? (
          <>
            <dt className="text-muted-foreground">Package version</dt>
            <dd className="truncate font-mono text-foreground" title={readiness.runtimePackageVersion}>
              {truncateHash(readiness.runtimePackageVersion)}
            </dd>
          </>
        ) : null}
      </dl>
    </Card>
  );
}
