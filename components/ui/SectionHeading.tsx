import React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./Tag";

const eyebrowTone: Record<Tone, string> = {
  accent: "text-accent-strong",
  money: "text-money",
  delivered: "text-delivered",
  paypal: "text-paypal",
  ai: "text-ai",
  amber: "text-amber",
  storm: "text-storm",
  danger: "text-danger",
  neutral: "text-ink-3",
};

/**
 * Editorial section opener for landing pages: mono eyebrow, Archivo title with one light-weight phrase, short description.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  tone = "accent",
  align = "left",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  accent?: React.ReactNode;
  description?: React.ReactNode;
  tone?: Tone;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-4", align === "center" && "mx-auto text-center", className)} data-reveal>
      <span className={cn("eyebrow", eyebrowTone[tone])}>{eyebrow}</span>
      <h2 className="text-title-1 text-ink">
        {title}
        {accent && (
          <>
            {" "}
            <span className="text-ink-2">{accent}</span>
          </>
        )}
      </h2>
      {description && <p className="text-body-large text-ink-2">{description}</p>}
    </div>
  );
}
