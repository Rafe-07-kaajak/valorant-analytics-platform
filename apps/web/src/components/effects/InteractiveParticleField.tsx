"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@repo/ui";
import { cursorPosition } from "../../lib/cursorPosition";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const PARTICLE_COUNT = 48;
const LINK_DISTANCE = 120;
const POINTER_RADIUS = 140;

/**
 * Effect 28 — a small field of drifting particles that link into faint lines
 * when close together, gently repelled by the pointer. Canvas 2D so the
 * per-frame cost is a handful of arc/line draws rather than DOM nodes.
 *
 * The animation loop only runs when the user has no reduced-motion
 * preference and the field is on screen (IntersectionObserver-gated).
 *
 * TASK-034: reads the pointer position from the shared `cursorPosition`
 * store (written by the app's one global `CursorTracker` listener) instead
 * of registering its own `window` pointermove/pointerleave listeners, so the
 * app still has exactly one global pointer listener total. The canvas's
 * viewport offset is cached in `resize()` (already called on mount and via
 * ResizeObserver) rather than read on every frame, to avoid a layout read
 * inside the render loop.
 */
export function InteractiveParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let isVisible = true;
    let canvasLeft = 0;
    let canvasTop = 0;
    const particles: Particle[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvasLeft = rect.left;
      canvasTop = rect.top;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
        });
      }
    };

    const styles = getComputedStyle(canvas);
    const lineColor = styles.getPropertyValue("--team-a").trim() || "#0891b2";

    const step = () => {
      rafId = requestAnimationFrame(step);
      if (!isVisible) return;

      ctx.clearRect(0, 0, width, height);

      const pointerX = cursorPosition.active ? cursorPosition.x - canvasLeft : -1000;
      const pointerY = cursorPosition.active ? cursorPosition.y - canvasTop : -1000;

      for (const particle of particles) {
        const dx = particle.x - pointerX;
        const dy = particle.y - pointerY;
        const distance = Math.hypot(dx, dy);
        if (distance < POINTER_RADIUS) {
          const force = (POINTER_RADIUS - distance) / POINTER_RADIUS;
          particle.vx += (dx / (distance || 1)) * force * 0.02;
          particle.vy += (dy / (distance || 1)) * force * 0.02;
        }

        particle.vx *= 0.98;
        particle.vy *= 0.98;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;
        particle.x = Math.max(0, Math.min(width, particle.x));
        particle.y = Math.max(0, Math.min(height, particle.y));
      }

      ctx.fillStyle = lineColor;
      for (const particle of particles) {
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = lineColor;
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i]!.x - particles[j]!.x;
          const dy = particles[i]!.y - particles[j]!.y;
          const distance = Math.hypot(dx, dy);
          if (distance < LINK_DISTANCE) {
            ctx.globalAlpha = (1 - distance / LINK_DISTANCE) * 0.25;
            ctx.beginPath();
            ctx.moveTo(particles[i]!.x, particles[i]!.y);
            ctx.lineTo(particles[j]!.x, particles[j]!.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    resize();
    seed();
    rafId = requestAnimationFrame(step);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      seed();
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden="true"
    />
  );
}
