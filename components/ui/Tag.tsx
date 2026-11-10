import React from "react";
import { cn } from "@/lib/utils";

export type Tone =
  | "accent"
  | "money"
  | "delivered"
  | "paypal"
  | "ai"
  | "amber"
  | "storm"
  | "danger"
  | "neutral";

/**
 * Broadcast tag: a small mono label with a coloured leading edge.
 * `solid` is the on-air "bug" treatment (LIVE, REPLAY, SANDBOX).
 */
export function Tag({
  tone = "neutral",
  solid = false,
  live = false,
  size = "md",
  children,
  className,
  title,
}: {
  tone?: Tone;
  solid?: boolean;
  live?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("tag", className)}
      data-tone={tone}
      data-size={size === "lg" ? "lg" : undefined}
      data-solid={solid ? "" : undefined}
      title={title}
    >
      {live && <span className="live-dot" />}
      {children}
    </span>
  );
}
