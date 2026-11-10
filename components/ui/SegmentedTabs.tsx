"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type SegTab<T extends string> = {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
};

/**
 * Glass segmented control with a sliding indicator. Fully keyboard-operable (←/→/Home/End).
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: {
  tabs: SegTab<T>[];
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const first = useRef(true);

  const place = useCallback(
    (animate: boolean) => {
      const btn = btns.current[value];
      const ind = indRef.current;
      if (!btn || !ind) return;
      const props = { x: btn.offsetLeft, width: btn.offsetWidth };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reduce) gsap.set(ind, props);
      else gsap.to(ind, { ...props, duration: 0.5, ease: "expo.out", overwrite: "auto" });
    },
    [value]
  );

  useIso(() => {
    place(!first.current);
    first.current = false;
  }, [place, tabs.length]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = i;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[n].id);
    btns.current[tabs[n].id]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      data-size={size}
      className={cn("seg", className)}
      onKeyDown={onKeyDown}
    >
      <span ref={indRef} className="seg-ind" aria-hidden />
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            btns.current[t.id] = el;
          }}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          className="seg-btn"
          onClick={() => onChange(t.id)}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="seg-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
