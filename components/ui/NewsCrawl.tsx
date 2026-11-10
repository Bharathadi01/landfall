import React from "react";
import { cn } from "@/lib/utils";
import { Tag, type Tone } from "./Tag";

export type CrawlItem = { id: string; label?: string; text: string; tone?: Tone };

/**
 * Scrolling news crawl, like the ticker at the bottom of a weather broadcast.
 * Pure CSS (no JS), pauses on hover, and degrades to a horizontally scrollable strip under reduced motion.
 */
export function NewsCrawl({
  items,
  className,
  secondsPerItem = 9,
  label = "News crawl",
}: {
  items: CrawlItem[];
  className?: string;
  secondsPerItem?: number;
  label?: string;
}) {
  if (!items.length) return null;
  const duration = Math.max(30, items.length * secondsPerItem);

  const half = (hidden: boolean) => (
    <div className="crawl-half" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <span key={`${hidden ? "b" : "a"}-${it.id}`} className="flex items-center gap-3 text-[13px] text-ink-2">
          {it.label && <Tag tone={it.tone ?? "neutral"}>{it.label}</Tag>}
          <span>{it.text}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={cn("crawl", className)}
      role="marquee"
      aria-label={label}
      style={{ ["--crawl-duration" as string]: `${duration}s` }}
    >
      <div className="crawl-track">
        {half(false)}
        {half(true)}
      </div>
    </div>
  );
}
