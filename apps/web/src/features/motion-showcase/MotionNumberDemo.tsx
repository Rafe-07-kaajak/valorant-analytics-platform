"use client";

import { useState } from "react";
import { Button, Card, MotionNumber } from "@repo/ui";

/**
 * TASK-051 motion showcase — the one interactive piece: clicking "Randomize"
 * changes the values `MotionNumber` receives, so its deterministic tween
 * (old value -> new value, fixed duration, no fake random count-from-zero)
 * is actually visible rather than only ever rendering a static number.
 */
export function MotionNumberDemo() {
  const [winProbability, setWinProbability] = useState(0.62);
  const [mapsPlayed, setMapsPlayed] = useState(184);
  const [averageRating, setAverageRating] = useState(1.08);

  const randomize = () => {
    setWinProbability(Math.random());
    setMapsPlayed(Math.floor(Math.random() * 400));
    setAverageRating(0.8 + Math.random() * 0.6);
  };

  return (
    <Card className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <div className="flex flex-col gap-2xs">
          <span className="text-label-sm text-muted-foreground">Win probability</span>
          <MotionNumber value={winProbability} format="percent" className="text-heading-md" />
        </div>
        <div className="flex flex-col gap-2xs">
          <span className="text-label-sm text-muted-foreground">Maps played</span>
          <MotionNumber value={mapsPlayed} format="integer" className="text-heading-md" />
        </div>
        <div className="flex flex-col gap-2xs">
          <span className="text-label-sm text-muted-foreground">Average rating</span>
          <MotionNumber value={averageRating} format="decimal" decimals={2} className="text-heading-md" />
        </div>
      </div>
      <Button variant="secondary" size="sm" className="self-start" onClick={randomize}>
        Randomize
      </Button>
    </Card>
  );
}
