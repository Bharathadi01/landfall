"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Animated numeric readout. Counts from 0 to `value` once when it scrolls into view.
 * Server-renders the final value, so it is correct even without JS.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1.6,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) =>
    prefix +
    n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const state = { n: 0 };
    let tween: gsap.core.Tween | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        tween = gsap.to(state, {
          n: value,
          duration,
          ease: "expo.out",
          onUpdate: () => { el.textContent = fmt(state.n); },
        });
      },
      { threshold: 0.3 }
    );
    el.textContent = fmt(0);
    io.observe(el);
    return () => { io.disconnect(); tween?.kill(); el.textContent = fmt(value); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={ref} className={`tabular ${className}`}>
      {fmt(value)}
    </span>
  );
}
