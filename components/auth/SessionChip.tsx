"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/icons";
import { Tag } from "@/components/ui/Tag";

interface Me { name: string; role: string }

/** Shows who is signed in (a DEMO persona) and lets them sign out. Role names match what the server enforces. */
export function SessionChip() {
  const router = useRouter();
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
  const label = me.role === "viewer" ? "Judge · read-only" : me.role === "finance" ? "Finance" : me.role === "coordinator" ? "Coordinator" : "Resident";
  return (
    <div className="hidden items-center gap-2 lg:flex" data-testid="session-chip">
      <Tag tone="neutral" title="Demo persona: a fictional person. The server enforces this role on every request.">
        <I.person className="h-3.5 w-3.5" /> {me.name.split(" ")[0]} · {label}
      </Tag>
      <button
        type="button"
        className="text-[12px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
        onClick={async () => {
          await fetch("/api/auth/session", { method: "DELETE" });
          router.push("/signin");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
