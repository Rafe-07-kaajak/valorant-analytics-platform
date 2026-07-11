"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section";
}

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export function ScrollReveal({ children, className, delay = 0, as = "div" }: ScrollRevealProps) {
  const MotionTag = as === "section" ? motion.section : motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
