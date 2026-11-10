"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import type { Tone } from "./Tag";

/**
 * Broadcast lower-third: coloured label tab + serif headline + mono meta line.
 * Wipes in on mount (tab scales out, body unmasks). Use on the globe and the landing hero.
 */
export function LowerThird({
  kicker,
  title,
  meta,
  tone = "accent",
  icon,
  right,
  className,
}: {
  kicker: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  tone?: Exclude<Tone, "neutral" | "amber">;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const tab = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tabEl = tab.current;
    const bodyEl = body.current;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(tab.current, { scaleX: 0 }, { scaleX: 1, duration: 0.55 })
      .fromTo(body.current, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.8 }, "-=0.25")
      .fromTo(body.current, { x: -10 }, { x: 0, duration: 0.8 }, "<");
    return () => {
      tl.kill();
      if (tabEl) gsap.set(tabEl, { clearProps: "all" });
      if (bodyEl) gsap.set(bodyEl, { clearProps: "all" });
    };
  }, []);

  return (
    <div ref={root} className={cn("lt", className)} data-tone={tone}>
      <div ref={tab} className="lt-tab">
        {icon}
        {kicker}
      </div>
      <div ref={body} className="lt-body">
        <div className="lt-title">{title}</div>
        {meta && <div className="lt-meta">{meta}</div>}
      </div>
      {right && <div className="flex items-center pr-4">{right}</div>}
    </div>
  );
}
