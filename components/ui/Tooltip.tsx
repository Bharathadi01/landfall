import React, { useId } from "react";

/**
 * CSS-only tooltip. Shows on hover and keyboard focus; the trigger gets aria-describedby.
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
}) {
  const id = useId();
  return (
    <span className="tip-wrap">
      {React.cloneElement(children, { "aria-describedby": id })}
      <span id={id} role="tooltip" className="tip" data-side={side}>
        {content}
      </span>
    </span>
  );
}
