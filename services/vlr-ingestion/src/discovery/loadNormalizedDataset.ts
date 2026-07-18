import type { NormalizedEvent, NormalizedMatch } from "../normalize/normalizedSchemas";
import type { IngestionStore } from "../persistence/types";

/**
 * Shared loader for every TASK-043 audit/reconciliation/curation command:
 * reads every persisted normalized match and event record via
 * `listNormalizedEntityIds` (TASK-043 addition to `persistence/types.ts`).
 * Read-only, no network.
 */
export interface NormalizedDataset {
  readonly matches: readonly NormalizedMatch[];
  readonly events: readonly NormalizedEvent[];
  readonly eventsById: ReadonlyMap<string, NormalizedEvent>;
}

export async function loadNormalizedDataset(store: IngestionStore): Promise<NormalizedDataset> {
  const matchIds = await store.listNormalizedEntityIds("match");
  const eventIds = await store.listNormalizedEntityIds("event");

  const matches: NormalizedMatch[] = [];
  for (const id of matchIds) {
    const record = await store.getNormalizedEntity<NormalizedMatch>("match", id);
    if (record) matches.push(record);
  }

  const events: NormalizedEvent[] = [];
  for (const id of eventIds) {
    const record = await store.getNormalizedEntity<NormalizedEvent>("event", id);
    if (record) events.push(record);
  }

  return { matches, events, eventsById: new Map(events.map((e) => [e.internalId, e])) };
}
