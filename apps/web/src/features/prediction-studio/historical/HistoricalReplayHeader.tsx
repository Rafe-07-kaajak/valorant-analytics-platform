import Image from "next/image";
import { Archive, ShieldAlert, ShieldCheck } from "lucide-react";
import type { RealPredictionReadiness } from "@repo/shared";
import { Badge } from "@repo/ui";

export interface HistoricalReplayHeaderProps {
  readinessStatus: "loading" | "success" | "error";
  readiness: RealPredictionReadiness | null;
}

const MODEL_STATUS_LABEL: Record<RealPredictionReadiness["modelStatus"], string> = {
  unloaded: "Model unloaded",
  loading: "Model loading",
  ready: "Model ready",
  degraded: "Model degraded",
  failed: "Model failed",
};

const SOURCE_MODE_LABEL: Record<NonNullable<RealPredictionReadiness["sourceMode"]>, string> = {
  "local-generated": "Local dataset",
  "runtime-package": "Runtime package",
};

/**
 * TASK-056 — dedicated archive-console header for Historical Model Replay,
 * visually distinct from Prediction Studio's own plain text header. Status
 * badges render only once readiness has actually resolved
 * (`readinessStatus === "success"`) and are read directly off the
 * already-fetched `readiness` payload — no new state, no invented metadata.
 * The loading/error/unavailable messaging itself stays owned by
 * HistoricalReplaySection (unchanged text/roles the existing tests assert);
 * this header never duplicates that copy.
 */
export function HistoricalReplayHeader({ readinessStatus, readiness }: HistoricalReplayHeaderProps) {
  const showStatus = readinessStatus === "success" && readiness !== null;

  return (
    <div className="relative flex min-h-[200px] flex-col justify-end gap-sm overflow-hidden rounded-lg border border-surface-border p-md md:min-h-[240px]">
      <Image
        src="/assets/redesign/tool-headers/historical-replay-header.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        loading="lazy"
        className="hidden object-cover md:block"
      />
      <Image
        src="/assets/redesign/tool-headers/historical-replay-header-mobile.png"
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        loading="lazy"
        className="object-cover md:hidden"
      />
      <div className="pointer-events-none absolute inset-0 bg-background/80" aria-hidden="true" />

      <div className="relative flex flex-col gap-sm">
        <div className="flex items-center gap-2xs">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-surface-border bg-badge-info-bg text-badge-info-text">
            <Archive className="size-4" aria-hidden="true" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Archive console</span>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Historical Model Replay</h2>
          <p className="text-sm text-muted-foreground">
            Recreate a prediction using only the model and information available at that point in time.
          </p>
        </div>

        {showStatus && readiness ? (
          <div className="flex flex-wrap items-center gap-2xs">
            <Badge
              tone={readiness.modelStatus === "ready" ? "success" : readiness.modelStatus === "failed" ? "danger" : "neutralStatus"}
              className="flex items-center gap-1"
            >
              {readiness.modelStatus === "ready" ? (
                <ShieldCheck aria-hidden="true" className="size-3" />
              ) : (
                <ShieldAlert aria-hidden="true" className="size-3" />
              )}
              {MODEL_STATUS_LABEL[readiness.modelStatus]}
            </Badge>
            {readiness.sourceMode ? <Badge tone="neutralStatus">{SOURCE_MODE_LABEL[readiness.sourceMode]}</Badge> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
