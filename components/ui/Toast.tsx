"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Action feedback. Every button that does something calls `toast(...)` so a user is never left wondering whether it worked.
 * Announced to screen readers through an aria-live region; auto-dismisses; success/info use role=status, errors role=alert.
 */
export type ToastTone = "success" | "info" | "warn" | "error";
interface ToastItem { id: number; title: string; body?: string; tone: ToastTone }
type ToastFn = (t: { title: string; body?: string; tone?: ToastTone; ms?: number }) => void;

const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);


export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const toast = useCallback<ToastFn>(({ title, body, tone = "info", ms }) => {
    const id = next.current++;
    setItems((cur) => [...cur.slice(-3), { id, title, body, tone }]);
    window.setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), ms ?? (tone === "error" ? 9000 : 5500));
  }, []);

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            data-tone={t.tone}
            className="toast pointer-events-auto text-[13px]"
          >
            <div className="font-semibold text-ink">{t.title}</div>
            {t.body && <div className="mt-0.5 text-ink-2">{t.body}</div>}
            <button
              type="button"
              className="absolute right-2 top-1.5 rounded px-1.5 text-[16px] leading-none text-ink-3 hover:text-ink"
              aria-label="Dismiss notification"
              onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
