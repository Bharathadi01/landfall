"use client";

import React, { useRef } from "react";
import Link from "next/link";
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

function Spinner() {
  return (
    <svg className="btn-spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One button for every action in the product.
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

  // Plain, predictable buttons: no pointer-tracked glare, no magnetic drift, no elastic bounce.
  const handlers = {
    onPointerMove: rest.onPointerMove,
    onPointerLeave: rest.onPointerLeave,
    onPointerDown: rest.onPointerDown,
    onPointerUp: rest.onPointerUp,
  };
  void magnetic;
  void refract;

  const cls = cn("btn", className);
  const dataAttrs = {
    "data-variant": variant,
    "data-size": size,
    "data-icon-only": iconOnly ? "" : undefined,
  };

  const content = (
    <>
      {loading ? <Spinner /> : leading}
      {children != null && <span className="btn-label">{children}</span>}
      {!loading && trailing != null && <span className="btn-trail inline-flex" aria-hidden>{trailing}</span>}
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
