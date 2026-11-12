import React from "react";
import { Ticker } from "@/components/ui/Ticker";
import { Tag, type Tone } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import type { IconType } from "@/components/icons/glyphs";

export type { Tone } from "@/components/ui/Tag";


const toneText: Record<Tone, string> = {
  accent: "text-accent-strong",
  money: "text-money",
  delivered: "text-delivered",
  paypal: "text-paypal",
  ai: "text-ai",
  amber: "text-amber",
  storm: "text-storm",
  danger: "text-danger",
  neutral: "text-ink-2",
};

const toneGlow: Record<Tone, string> = {
  accent: "rgb(var(--c-accent) / 0.26)",
  money: "rgb(var(--c-money) / 0.22)",
  delivered: "rgb(var(--c-delivered) / 0.22)",
  paypal: "rgb(var(--c-paypal) / 0.26)",
  ai: "rgb(var(--c-ai) / 0.22)",
  amber: "rgb(var(--c-amber) / 0.22)",
  storm: "rgb(var(--c-storm) / 0.24)",
  danger: "rgb(var(--c-danger) / 0.26)",
  neutral: "rgb(24 34 30 / 0.07)",
};

/**
 * Used to be a rounded, coloured icon tile (the most common dashboard cliché). Now a small square marker:
 * quiet, consistent, and the meaning lives in the label next to it. Kept so existing call sites keep working.
 */
export function IconTile({
  tone = "neutral",
  size = "md",
  className = "",
}: {
  icon?: IconType;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const px = size === "lg" ? 10 : size === "sm" ? 6 : 8;
  const color = tone === "danger" ? "bg-danger" : tone === "amber" ? "bg-amber" : tone === "delivered" ? "bg-delivered" : tone === "accent" ? "bg-accent" : "bg-ink-3";
  return <span aria-hidden className={`inline-block shrink-0 ${color} ${className}`} style={{ width: px, height: px }} />;
}

/** Thin wrapper kept for existing call sites — renders a broadcast Tag. */
export function Chip({
  tone = "neutral",
  children,
  live = false,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <Tag tone={tone} live={live} className={className}>
      {children}
    </Tag>
  );
}

function TitleBlock({
  title,
  accent,
}: {
  title: React.ReactNode;
  accent?: React.ReactNode;
}) {
  return (
    <h1 className="text-title-1 text-ink">
      {title}
      {accent && (
        <>
          {" "}
          <span className="block text-ink-2">{accent}</span>
        </>
      )}
    </h1>
  );
}

/** Left side of a page header — for pages that keep their own action controls. */
export function PageTitle({
  eyebrow,
  icon,
  tone = "accent",
  title,
  accent,
  description,
}: {
  eyebrow: string;
  icon?: IconType;
  tone?: Tone;
  title: React.ReactNode;
  accent?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
        <span className={cn("eyebrow", toneText[tone])}>{eyebrow}</span>
      </div>
      <TitleBlock title={title} accent={accent} />
      {description && <p className="text-body-base max-w-2xl text-ink-2">{description}</p>}
    </div>
  );
}

/**
 * Consistent page header: eyebrow → headline (one italic accent phrase) → one-sentence purpose → actions.
 * Kept short on purpose: a viewer should understand the page in under three seconds.
 */
export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  icon?: IconType;
  tone?: Tone;
  title: React.ReactNode;
  accent?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between" data-testid="page-header">
      <div className="max-w-[54rem] space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="eyebrow">{eyebrow}</span>
          {meta}
        </div>
        <TitleBlock title={title} accent={accent} />
        {description && <p className="max-w-3xl text-[15.5px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
  display,
  hint,
  tone = "neutral",
  icon,
  footer,
}: {
  label: string;
  value?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  display?: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: IconType;
  footer?: React.ReactNode;
}) {
  return (
    <div className="pane p-5">
      <span className="eyebrow">{label}</span>
      <div className="figure mt-3 text-[36px] leading-none text-ink">
        {display ?? (value !== undefined ? <Ticker value={value} prefix={prefix} suffix={suffix} decimals={decimals} /> : null)}
      </div>
      {hint && <p className="mt-3 text-[13px] leading-snug text-ink-3">{hint}</p>}
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  icon,
  tone = "neutral",
  right,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconType;
  tone?: Tone;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-title-2 text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-3">{description}</p>}
      </div>
      {right}
    </div>
  );
}

/** The colour-meaning legend. Shown once in the shell so every screen reads the same way. */
export const MEANING: { tone: Tone; label: string }[] = [
  { tone: "accent", label: "Action · live" },
  { tone: "money", label: "Relief dollars" },
  { tone: "delivered", label: "Delivered" },
  { tone: "paypal", label: "PayPal" },
  { tone: "ai", label: "AI (read-only)" },
  { tone: "amber", label: "Reserve" },
  { tone: "storm", label: "Storm risk" },
];

export function MeaningDot({ tone }: { tone: Tone }) {
  const bg: Record<Tone, string> = {
    accent: "bg-accent",
    money: "bg-money",
    delivered: "bg-delivered",
    paypal: "bg-paypal",
    ai: "bg-ai",
    amber: "bg-amber",
    storm: "bg-storm",
    danger: "bg-danger",
    neutral: "bg-ink-3",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${bg[tone]}`} />;
}
