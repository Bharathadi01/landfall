"use client";

import React, { useEffect, useRef, useState } from "react";
import { loadPayPalSdk } from "./paypalSdk";

/** Monthly sustainer: PayPal's own subscription approval window. The server then verifies the subscription with PayPal before recording it. */
export const SUSTAINER_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID || "P-5A327449X7452233TNLYQY3A";

export function PayPalSubscribe({ onApproved, onError, onCancel }: { onApproved: (subscriptionId: string) => void; onError: (m: string) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return setState("unavailable");
    let dead = false;
    let buttons: any;
    loadPayPalSdk("subscriptions", clientId)
      .then((sdk) => {
        if (dead || !box.current) return;
        buttons = sdk.Buttons({
          style: { layout: "vertical", shape: "rect", color: "black", label: "subscribe", height: 46, tagline: false },
          createSubscription: (_: unknown, actions: any) => actions.subscription.create({ plan_id: SUSTAINER_PLAN_ID }),
          onApprove: async (data: { subscriptionID: string }) => {
            const res = await fetch("/api/subscriptions/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: data.subscriptionID }) });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.message ?? "PayPal approved the subscription but we could not confirm it.");
            onApproved(data.subscriptionID);
          },
          onCancel: () => onCancel(),
          onError: (e: unknown) => onError(e instanceof Error ? e.message : "PayPal reported a problem. Nothing was charged."),
        });
        if (buttons.isEligible()) buttons.render(box.current).then(() => !dead && setState("ready"));
        else setState("unavailable");
      })
      .catch(() => !dead && setState("unavailable"));
    return () => {
      dead = true;
      try {
        buttons?.close?.();
      } catch {
        /* already gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div className="paypal-panel">
      <div ref={box} data-testid="paypal-subscribe" className="min-h-[48px]" aria-busy={state === "loading"} />
      {state === "loading" && <p className="paypal-note">Loading PayPal…</p>}
      {state === "unavailable" && <p role="alert" className="paypal-note">PayPal couldn’t load in this browser (an ad blocker can cause this). Reload, or allow paypal.com.</p>}
    </div>
  );
}
