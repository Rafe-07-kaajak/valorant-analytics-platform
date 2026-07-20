"use client";

import { Card, StickyStory } from "@repo/ui";

/**
 * TASK-051 motion showcase — `StickyStory`'s `renderSticky` prop is a
 * function, which cannot cross the server/client boundary (a Server
 * Component page can pass serializable children into a Client Component,
 * but not a closure). This wrapper owns that function locally instead.
 */
const STICKY_STEPS = [
  {
    title: "Scene one",
    body: "The first scene of a scroll-driven story: this text is the real, accessible content, always in normal document flow.",
  },
  {
    title: "Scene two",
    body: "As the visitor scrolls past this step, the sticky companion panel (desktop, motion-safe only) updates to reflect it.",
  },
  {
    title: "Scene three",
    body: "On mobile, or with reduced motion, this whole story renders as a plain stacked list instead, same content, no sticky mechanic.",
  },
];

export function StickyStoryDemo() {
  return (
    <StickyStory
      className="rounded-lg border border-surface-border"
      stepClassName="flex items-center p-lg"
      stickyPaneClassName="flex items-center justify-center bg-surface-raised"
      steps={STICKY_STEPS.map((step) => (
        <Card key={step.title} className="flex flex-col gap-2xs">
          <h3>{step.title}</h3>
          <p className="text-muted-foreground">{step.body}</p>
        </Card>
      ))}
      renderSticky={(activeIndex) => (
        <div className="flex flex-col items-center gap-2xs p-lg text-center">
          <span className="text-label-sm text-muted-foreground">Active scene</span>
          <span className="text-heading-lg">{STICKY_STEPS[activeIndex]?.title}</span>
        </div>
      )}
    />
  );
}
