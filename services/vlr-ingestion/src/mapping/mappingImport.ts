import { readFile } from "node:fs/promises";
import { IngestionError } from "../errors";
import { validateTeamMappingRegistry } from "../identity/teamMapping";
import type { VlrTeamMappingEntry } from "../identity/teamMapping";

/**
 * Safe mapping import/update mechanism — TASK-043 requirement 21. Reads and
 * validates an externally-supplied `team-mappings.json` file (schema
 * validation, duplicate/conflict detection against both the file itself
 * and the current in-repo registry) and reports what *would* change. This
 * never writes generated TypeScript source or executes anything from the
 * imported file — `identity/teamMapping.ts`'s committed registry remains
 * the single place a verified mapping is actually added, by a human, the
 * same way every existing entry was (see that file's own doc comments).
 * `--apply` (a human-in-the-loop decision made outside this function) is
 * therefore always a manual code change guided by this report, never an
 * automated file rewrite.
 */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** `JSON.parse` with a reviver that rejects prototype-pollution-style keys outright — TASK-043 requirement 29. */
export function safeJsonParse(text: string): unknown {
  return JSON.parse(text, (key, value) => {
    if (DANGEROUS_KEYS.has(key)) {
      throw new IngestionError("parse_failure", `Refusing to parse a JSON key named "${key}" — potential prototype-pollution payload.`);
    }
    return value;
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface TeamMappingImportEntryReport {
  readonly entry: unknown;
  readonly outcome: "added" | "changed" | "rejected" | "unchanged";
  readonly reasons: readonly string[];
}

export interface TeamMappingImportReport {
  readonly valid: boolean;
  readonly added: readonly VlrTeamMappingEntry[];
  readonly changed: readonly VlrTeamMappingEntry[];
  readonly unchanged: readonly VlrTeamMappingEntry[];
  readonly rejected: readonly TeamMappingImportEntryReport[];
}

const REQUIRED_STRING_FIELDS = ["vlrTeamId", "internalTeamId", "reason"] as const;

function validateShape(candidate: unknown): { entry?: VlrTeamMappingEntry; reasons: string[] } {
  const reasons: string[] = [];
  if (!isPlainRecord(candidate)) {
    return { reasons: ["Entry is not a plain object."] };
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof candidate[field] !== "string" || (candidate[field] as string).trim().length === 0) {
      reasons.push(`Field "${field}" must be a non-empty string.`);
    }
  }
  if (candidate.evidence !== undefined && !Array.isArray(candidate.evidence)) reasons.push('Field "evidence" must be an array when present.');
  if (candidate.aliases !== undefined && !Array.isArray(candidate.aliases)) reasons.push('Field "aliases" must be an array when present.');
  if (reasons.length > 0) return { reasons };

  return {
    entry: {
      vlrTeamId: candidate.vlrTeamId as string,
      internalTeamId: candidate.internalTeamId as VlrTeamMappingEntry["internalTeamId"],
      reason: candidate.reason as string,
      aliases: candidate.aliases as readonly string[] | undefined,
      status: candidate.status as VlrTeamMappingEntry["status"],
      confidence: candidate.confidence as VlrTeamMappingEntry["confidence"],
      evidence: candidate.evidence as VlrTeamMappingEntry["evidence"],
      verifiedAt: candidate.verifiedAt as string | undefined,
      sourceUrl: candidate.sourceUrl as string | undefined,
      notes: candidate.notes as string | undefined,
    },
    reasons: [],
  };
}

/**
 * Validates a parsed team-mapping import payload (an array of candidate
 * entries) against the current registry. Always a dry-run report — this
 * function never mutates `currentRegistry` or any file.
 */
export function validateTeamMappingImport(payload: unknown, currentRegistry: readonly VlrTeamMappingEntry[]): TeamMappingImportReport {
  if (!Array.isArray(payload)) {
    return { valid: false, added: [], changed: [], unchanged: [], rejected: [{ entry: payload, outcome: "rejected", reasons: ["Top-level payload must be a JSON array of mapping entries."] }] };
  }

  const currentByVlrId = new Map(currentRegistry.map((entry) => [entry.vlrTeamId, entry]));
  const added: VlrTeamMappingEntry[] = [];
  const changed: VlrTeamMappingEntry[] = [];
  const unchanged: VlrTeamMappingEntry[] = [];
  const rejected: TeamMappingImportEntryReport[] = [];

  const seenInPayload = new Map<string, VlrTeamMappingEntry>();

  for (const candidate of payload) {
    const { entry, reasons } = validateShape(candidate);
    if (!entry) {
      rejected.push({ entry: candidate, outcome: "rejected", reasons });
      continue;
    }

    const duplicateInPayload = seenInPayload.get(entry.vlrTeamId);
    if (duplicateInPayload && duplicateInPayload.internalTeamId !== entry.internalTeamId) {
      rejected.push({ entry, outcome: "rejected", reasons: [`Conflicts with another entry in the same import payload for VLR team ID "${entry.vlrTeamId}".`] });
      continue;
    }
    seenInPayload.set(entry.vlrTeamId, entry);

    const existing = currentByVlrId.get(entry.vlrTeamId);
    if (!existing) {
      added.push(entry);
    } else if (existing.internalTeamId !== entry.internalTeamId) {
      rejected.push({ entry, outcome: "rejected", reasons: [`Conflicts with the existing verified mapping ("${existing.internalTeamId}") for VLR team ID "${entry.vlrTeamId}".`] });
    } else if (JSON.stringify(existing) !== JSON.stringify(entry)) {
      changed.push(entry);
    } else {
      unchanged.push(entry);
    }
  }

  const wouldBeRegistry = [...currentRegistry.filter((e) => !added.some((a) => a.vlrTeamId === e.vlrTeamId)), ...added, ...changed];
  const structuralValidation = validateTeamMappingRegistry(wouldBeRegistry);

  return { valid: rejected.length === 0 && structuralValidation.valid, added, changed, unchanged, rejected };
}

export async function loadTeamMappingImportFile(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, "utf-8");
  return safeJsonParse(text);
}
