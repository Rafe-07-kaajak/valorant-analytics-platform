export function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--surface-border)_1px,transparent_0)] [background-size:32px_32px] opacity-40" />
      <div className="animate-drift-slow absolute -left-1/4 top-[-10%] size-[32rem] rounded-full bg-brand-500/25 blur-3xl" />
      <div className="animate-drift-slower absolute right-[-10%] top-[10%] size-[28rem] rounded-full bg-team-a/20 blur-3xl" />
      <div className="animate-drift-slow absolute bottom-[-15%] left-[20%] size-[24rem] rounded-full bg-team-b/15 blur-3xl" />
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
