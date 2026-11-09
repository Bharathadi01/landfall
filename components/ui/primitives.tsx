import React from "react";
import { CountUp } from "@/components/motion/CountUp";

export type Tone = "accent" | "paypal" | "ai" | "amber" | "storm" | "danger" | "neutral";

const toneText: Record<Tone, string> = {
  accent: "text-accent-strong",
  paypal: "text-paypal",
  ai: "text-ai",
  amber: "text-amber",
  storm: "text-storm",
  danger: "text-danger",
  neutral: "text-ink-2",
};

const toneGlow: Record<Tone, string> = {
  accent: "rgb(var(--c-accent) / 0.28)",
  paypal: "rgb(var(--c-paypal) / 0.28)",
  ai: "rgb(var(--c-ai) / 0.28)",
  amber: "rgb(var(--c-amber) / 0.24)",
  storm: "rgb(var(--c-storm) / 0.26)",
  danger: "rgb(var(--c-danger) / 0.26)",
  neutral: "rgb(255 255 255 / 0.08)",
};

export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  className = "",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sz = size === "sm" ? "icon-tile-sm" : size === "lg" ? "icon-tile-lg" : "";
  const t = tone === "neutral" ? "" : `tone-${tone}`;
  return (
    <span className={`icon-tile ${sz} ${t} ${className}`}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

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
  const cls =
    tone === "accent"
      ? "field-badge-success"
      : tone === "paypal"
      ? "field-badge-info"
      : tone === "ai"
      ? "field-badge-ai"
      : tone === "amber"
      ? "field-badge-warning"
      : tone === "storm" || tone === "danger"
      ? "field-badge-critical"
      : "field-badge-neutral";
  return (
    <span className={`field-badge ${cls} ${className}`}>
      {live && <span className="live-dot" />}
      {children}
    </span>
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
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  title: React.ReactNode;
  accent?: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl space-y-4" data-reveal>
      <div className="flex flex-wrap items-center gap-2.5">
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
        <span className={`eyebrow ${toneText[tone]}`}>{eyebrow}</span>
      </div>
      <h1 className="text-title-1 text-ink">
        {title}
        {accent && (
          <>
            {" "}
            <span className="font-accent italic font-normal text-ink-2">{accent}</span>
          </>
        )}
      </h1>
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
  icon,
  tone = "accent",
  title,
  accent,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  title: React.ReactNode;
  accent?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="relative flex flex-col gap-6 pb-8 lg:flex-row lg:items-end lg:justify-between" data-reveal>
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {icon && <IconTile icon={icon} tone={tone} size="sm" />}
          <span className={`eyebrow ${toneText[tone]}`} style={{ color: undefined }}>
            {eyebrow}
          </span>
          {meta}
        </div>
        <h1 className="text-title-1 text-ink">
          {title}
          {accent && (
            <>
              {" "}
              <span className="font-accent italic font-normal text-ink-2">{accent}</span>
            </>
          )}
        </h1>
        {description && <p className="text-body-base max-w-2xl text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
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
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  footer?: React.ReactNode;
}) {
  return (
    <div className="glass card-hover overflow-hidden p-5" data-reveal>
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
        style={{ background: toneGlow[tone] }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="eyebrow">{label}</span>
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      </div>
      <div className={`relative mt-4 text-[30px] font-semibold leading-none tracking-[-0.035em] tabular ${tone === "neutral" ? "text-ink" : toneText[tone]}`}>
        {display ?? (value !== undefined ? <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} /> : null)}
      </div>
      {hint && <p className="relative mt-2.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
      {footer && <div className="relative mt-4">{footer}</div>}
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
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: Tone;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} />}
        <div>
          <h2 className="text-heading text-ink">{title}</h2>
          {description && <p className="text-[13px] text-ink-3">{description}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** The colour-meaning legend. Shown once in the shell so every screen reads the same way. */
export const MEANING: { tone: Tone; label: string }[] = [
  { tone: "accent", label: "Relief cash" },
  { tone: "paypal", label: "PayPal" },
  { tone: "ai", label: "AI (read-only)" },
  { tone: "amber", label: "Reserve" },
  { tone: "storm", label: "Storm risk" },
];

export function MeaningDot({ tone }: { tone: Tone }) {
  const bg: Record<Tone, string> = {
    accent: "bg-accent",
    paypal: "bg-paypal",
    ai: "bg-ai",
    amber: "bg-amber",
    storm: "bg-storm",
    danger: "bg-danger",
    neutral: "bg-ink-3",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${bg[tone]}`} />;
}
