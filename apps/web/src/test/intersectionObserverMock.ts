/**
 * TASK-051 — jsdom has no native `IntersectionObserver`, which every
 * viewport-entry primitive in this task depends on (Framer Motion's
 * `whileInView`/`useInView`, used by `ScrollReveal`, `StaggerGroup`,
 * `TextLineReveal`, `ImageMaskReveal`). Framer's `inView()` helper calls
 * `new IntersectionObserver(...)` with no existence guard, so without this
 * polyfill any test rendering one of those components throws inside a
 * `useEffect`.
 *
 * This mock never fires on its own — it exists purely so a test can grab
 * the instance observing a given element and call `.trigger(true/false)`
 * to simulate entering/leaving the viewport at a moment the test controls,
 * rather than depending on real observer timing (which jsdom can't produce
 * anyway, and which the task's own testing guidance says to avoid).
 */
export class IntersectionObserverMock implements IntersectionObserver {
  root: Element | Document | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
  private readonly callback: IntersectionObserverCallback;
  private readonly elements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.elements.add(target);
  }

  unobserve(target: Element) {
    this.elements.delete(target);
  }

  disconnect() {
    this.elements.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Manually fire an intersection change for every currently observed element. */
  trigger(isIntersecting: boolean) {
    const entries = Array.from(this.elements).map(
      (target) => ({ target, isIntersecting }) as IntersectionObserverEntry,
    );
    this.callback(entries, this);
  }

  observesElement(target: Element) {
    return this.elements.has(target);
  }
}

const instances: IntersectionObserverMock[] = [];

/** Call once per test file (module scope is fine) to install the global polyfill. */
export function installIntersectionObserverMock() {
  class TrackedIntersectionObserverMock extends IntersectionObserverMock {
    constructor(callback: IntersectionObserverCallback) {
      super(callback);
      instances.push(this);
    }
  }

  window.IntersectionObserver = TrackedIntersectionObserverMock;
  globalThis.IntersectionObserver = TrackedIntersectionObserverMock;
}

/** The observer instance currently watching `element`, if any. */
export function findIntersectionObserver(element: Element): IntersectionObserverMock | undefined {
  return instances.find((instance) => instance.observesElement(element));
}

export function resetIntersectionObserverMocks() {
  instances.length = 0;
}
