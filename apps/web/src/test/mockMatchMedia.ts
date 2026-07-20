import { vi } from "vitest";

/**
 * TASK-051 — query-aware `window.matchMedia` mock shared by every hook/
 * primitive test that depends on `useMediaQuery` (reduced motion, pointer
 * capability, breakpoint checks). Extends the single-value mock already
 * used by `CursorTracker.test.tsx` to support multiple simultaneous
 * queries (e.g. `usePointerCapability` reads two) and to let a test fire a
 * "change" event for a specific query, so `useMediaQuery`'s subscription
 * behavior is verifiable without real OS-level media-query events.
 */
export function mockMatchMedia(matchesForQuery: (query: string) => boolean) {
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();

  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matchesForQuery(query),
        media: query,
        onchange: null,
        addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
          if (!listeners.has(query)) listeners.set(query, new Set());
          listeners.get(query)?.add(callback);
        },
        removeEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => {
          listeners.get(query)?.delete(callback);
        },
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );

  return {
    fireChange(query: string, matches: boolean) {
      listeners.get(query)?.forEach((callback) => callback({ matches } as MediaQueryListEvent));
    },
    listenerCount(query: string) {
      return listeners.get(query)?.size ?? 0;
    },
  };
}
