"use client";

import React, { useEffect, useState } from "react";
import { I } from "@/components/icons";
import { Tag } from "@/components/ui/Tag";

interface Me { name: string; role: string }

/** Shows who is signed in (a DEMO persona) and lets them sign out. Role names match what the server enforces. */
export function SessionChip() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => alive && setMe(j.authenticated ? { name: j.session.name, role: j.session.role } : null))
      .catch(() => alive && setMe(null));
    return () => { alive = false; };
  }, []);

  if (me === undefined) return null;
  if (!me) {
    return (
      <a href="/signin" className="text-[12.5px] font-medium text-accent-strong underline-offset-2 hover:underline">Sign in</a>
    );
  }
  const role = me.role === "viewer" ? "Read-only" : me.role === "finance" ? "Finance" : me.role === "coordinator" ? "Coordinator" : "Resident";
  const first = me.name.replace(/\s*\(.*\)$/, "").split(" ")[0];
  return (
    <div className="hidden items-center gap-3 lg:flex" data-testid="session-chip">
      <span className="flex items-center gap-2.5" title="Demo persona: a fictional person. The server enforces this role on every request.">
        <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-[12px] font-semibold text-ink">{first.slice(0, 1)}</span>
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-ink">{first}</span>
          <span className="text-[11.5px] text-ink-3">{role} · demo</span>
        </span>
      </span>
      <button
        type="button"
        className="inline-flex min-h-[32px] items-center rounded-md px-2 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-ink/5 hover:text-ink"
        onClick={async () => {
          await fetch("/api/auth/session", { method: "DELETE" });
          window.location.assign("/");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
