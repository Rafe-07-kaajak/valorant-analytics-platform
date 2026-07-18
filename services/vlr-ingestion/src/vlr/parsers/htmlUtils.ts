import { JSDOM } from "jsdom";

/**
 * Shared HTML parsing utilities — see docs/29-vlr-data-ingestion-foundation.md
 * ("Parsing") and TASK-041 requirement 14. `jsdom` is already a workspace
 * dependency (used by `apps/web`'s component tests), so reusing it here
 * avoids adding a new dependency while giving every parser real
 * `querySelector`/`textContent` semantics — safe entity decoding and
 * resilient-to-whitespace text extraction come for free instead of being
 * hand-rolled with regex.
 */

export const PARSER_VERSION = "vlr-parsers@1.0.0";

export interface ParseIssue {
  readonly code: string;
  readonly message: string;
  readonly selector?: string;
}

export interface ParseOutcome<T> {
  readonly value: T | null;
  readonly warnings: readonly ParseIssue[];
  readonly errors: readonly ParseIssue[];
  readonly parserVersion: string;
}

/** Parses an HTML fragment/document into a queryable DOM. Never touches the network. */
export function parseHtmlDocument(html: string): Document {
  return new JSDOM(html).window.document;
}

/** Sanitized, whitespace-normalized text extraction — safe against markup whitespace changes. */
export function extractText(element: Element | null | undefined): string | undefined {
  const text = element?.textContent?.replace(/\s+/g, " ").trim();
  return text && text.length > 0 ? text : undefined;
}

export function extractAttribute(element: Element | null | undefined, attribute: string): string | undefined {
  const value = element?.getAttribute(attribute)?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Extracts the first path segment matching `pattern` from a source URL, without any network access. */
export function extractIdFromUrl(url: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(url);
  return match?.[1];
}

export function querySelectorAllText(scope: ParentNode, selector: string): string[] {
  return Array.from(scope.querySelectorAll(selector))
    .map((element) => extractText(element))
    .filter((text): text is string => text !== undefined);
}
