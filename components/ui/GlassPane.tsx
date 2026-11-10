import React from "react";
import { cn } from "@/lib/utils";

const level: Record<1 | 2 | 3, string> = {
  1: "glass",
  2: "glass-strong",
  3: "glass-hud",
};

/**
 * Frosted pane. Level 1 = in-page card, 2 = raised panel, 3 = HUD overlay on top of the globe or a video-like surface.
 */
export function GlassPane({
  level: lv = 1,
  as: Tag = "div",
  padded = true,
  hover = false,
  className,
  children,
  ...rest
}: {
  level?: 1 | 2 | 3;
  as?: React.ElementType;
  padded?: boolean;
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={cn(level[lv], hover && "card-hover", padded && "p-5", className)} {...rest}>
      {children}
    </Tag>
  );
}
