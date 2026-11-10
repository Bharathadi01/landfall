"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

export type ButtonVariant = "signal" | "glass" | "ghost" | "paypal" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon (or any node) before the label. */
  leading?: React.ReactNode;
  /** Icon (or any node) after the label. */
  trailing?: React.ReactNode;
  loading?: boolean;
  /** Square button with only an icon. Provide aria-label. */
  iconOnly?: boolean;
  /** Button drifts toward the pointer. Use on hero CTAs only. */
  magnetic?: boolean;
  /** Chromium-only backdrop refraction. Use on hero CTAs only. */
  refract?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type AsButton = Common &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof Common> & { href?: undefined };
type AsLink = Common &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof Common | "href"> & { href: string };

export type ButtonProps = AsButton | AsLink;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Spinner() {
  return (
    <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Liquid-glass button. One component for every action in the product.
 * `signal` = the primary action, `glass` = secondary, `ghost` = tertiary, `paypal` = PayPal rails, `danger` = destructive.
 * Renders a Next <Link> for internal hrefs, <a> for external, <button> otherwise.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "glass",
    size = "md",
    leading,
    trailing,
    loading = false,
    iconOnly = false,
    magnetic = false,
    refract = false,
    className,
    children,
    ...rest
  } = props as Common & Record<string, any>;

  const ref = useRef<HTMLElement | null>(null);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      if (magnetic && !reducedMotion() && e.pointerType === "mouse") {
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * 0.16, y: dy * 0.26, duration: 0.35, ease: "power3.out", overwrite: "auto" });
      }
    }
    rest.onPointerMove?.(e);
  };

  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (magnetic && ref.current && !reducedMotion()) {
      gsap.to(ref.current, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.45)", overwrite: "auto" });
    }
    rest.onPointerLeave?.(e);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (ref.current && !reducedMotion()) gsap.to(ref.current, { scale: 0.965, duration: 0.12, ease: "power2.out" });
    rest.onPointerDown?.(e);
  };

  const release = () => {
    if (ref.current && !reducedMotion())
      gsap.to(ref.current, { scale: 1, duration: 0.55, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
  };

  const handlers = {
    onPointerMove,
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      release();
      onPointerLeave(e);
    },
    onPointerDown,
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      release();
      rest.onPointerUp?.(e);
    },
  };

  const cls = cn("btn", className);
  const dataAttrs = {
    "data-variant": variant,
    "data-size": size,
    "data-icon-only": iconOnly ? "" : undefined,
    "data-refract": refract ? "" : undefined,
  };

  const content = (
    <>
      {loading ? <Spinner /> : leading}
      {children != null && <span className="btn-label">{children}</span>}
      {!loading && trailing}
    </>
  );

  if (typeof rest.href === "string") {
    const { href, onPointerMove: _m, onPointerLeave: _l, onPointerDown: _d, onPointerUp: _u, ...anchor } = rest;
    const external = /^(https?:|mailto:|tel:)/.test(href);
    if (external) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={cls}
          {...dataAttrs}
          {...handlers}
          {...(anchor.target === "_blank" ? { rel: "noopener noreferrer" } : null)}
          {...anchor}
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={cls}
        {...dataAttrs}
        {...handlers}
        {...anchor}
      >
        {content}
      </Link>
    );
  }

  const { onPointerMove: _m, onPointerLeave: _l, onPointerDown: _d, onPointerUp: _u, disabled, type, ...button } = rest;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cls}
      {...dataAttrs}
      {...handlers}
      {...button}
    >
      {content}
    </button>
  );
}
