"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

/**
 * Animated numeric readout (replaces CountUp).
 * - First view: counts up from `from` (default 0) when scrolled into view.
 * - Later changes: tweens from the number currently shown to the new value, so live figures roll like a scoreboard.
 * Server-renders the final value, so it is correct without JS and under reduced motion.
 */
export function Ticker({
  value,
  from = 0,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.4,
  className,
}: {
  value: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number>(value);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) =>
      prefix +
      n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
      suffix;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.textContent = fmt(value);
      shown.current = value;
      return;
    }

    const state = { n: seen.current ? shown.current : from };
    let tween: gsap.core.Tween | null = null;
    const run = () => {
      seen.current = true;
      tween = gsap.to(state, {
        n: value,
        duration,
        ease: "expo.out",
        onUpdate: () => {
          shown.current = state.n;
          el.textContent = fmt(state.n);
        },
        onComplete: () => {
          shown.current = value;
          el.textContent = fmt(value);
        },
      });
    };

    let io: IntersectionObserver | null = null;
    if (seen.current) {
      run();
    } else {
      el.textContent = fmt(from);
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io?.disconnect();
          run();
        },
        { threshold: 0.3 }
      );
      io.observe(el);
    }

    return () => {
      io?.disconnect();
      tween?.kill();
      el.textContent = fmt(value);
      shown.current = value;
    };
  }, [value, from, prefix, suffix, decimals, duration]);

  const initial =
    prefix +
    value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix;

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {initial}
    </span>
  );
}
