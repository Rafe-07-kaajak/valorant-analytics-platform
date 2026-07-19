import { NextResponse } from "next/server";
import { buildHistoricalCatalog, validateCatalogFilters } from "../../../../../server/prediction/historicalCatalog";
import { toPredictionApiError } from "../../../../../server/prediction/errors";

/**
 * GET-only historical catalog endpoint — TASK-047 requirement 6/15. Exposes
 * only safe selection metadata (never labels, scores, or feature vectors).
 * Filters are validated strictly; an unknown/malformed filter value is
 * rejected as `request_invalid` rather than silently ignored.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = validateCatalogFilters({
      eventFamily: url.searchParams.get("eventFamily") ?? undefined,
      teamProviderId: url.searchParams.get("teamProviderId") ?? undefined,
      scheduledAfter: url.searchParams.get("scheduledAfter") ?? undefined,
      scheduledBefore: url.searchParams.get("scheduledBefore") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const catalog = await buildHistoricalCatalog(filters);
    return NextResponse.json(catalog, { status: 200 });
  } catch (error) {
    const apiError = toPredictionApiError(error);
    return NextResponse.json(apiError.toSafeJSON(), { status: apiError.httpStatus });
  }
}
