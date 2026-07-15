"use client";

import { motion } from "framer-motion";
import { cn } from "@repo/ui";

/**
 * Effect 30 — a few soft glass panes drifting slowly, evoking the layered
 * glass material in the asset library. Built on Framer Motion so it inherits
 * reduced-motion handling for free from the app-wide
 * `MotionConfig reducedMotion="user"` in MotionProvider — no separate media
 * query needed here.
 */
export function FloatingGlassObjects({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <motion.div
        className="absolute -left-1/4 top-[-10%] size-[32rem] rounded-[2rem] border border-white/10 bg-linear-to-br from-team-a/15 via-white/5 to-transparent backdrop-blur-3xl"
        animate={{ x: ["0%", "3%", "0%"], y: ["0%", "-5%", "0%"], rotate: [-6, -2, -6] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-10%] top-[15%] size-[26rem] rounded-[2rem] border border-white/10 bg-linear-to-br from-accent-violet/15 via-white/5 to-transparent backdrop-blur-3xl"
        animate={{ x: ["0%", "-4%", "0%"], y: ["0%", "4%", "0%"], rotate: [8, 4, 8] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[20%] size-[20rem] rounded-[2rem] border border-white/10 bg-linear-to-br from-team-b/10 via-white/5 to-transparent backdrop-blur-3xl"
        animate={{ x: ["0%", "5%", "0%"], y: ["0%", "-3%", "0%"], rotate: [3, -3, 3] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
