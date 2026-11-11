"use client";

import React, { useEffect, useRef, useState } from "react";
import { loadPayPalSdk } from "./paypalSdk";

/**
 * Real PayPal checkout (Smart Buttons, PayPal JS SDK). Clicking opens PayPal's own approval window; the buyer signs in
 * (a Sandbox buyer account here), reviews and approves; only then does OUR server capture the order. The browser never
 * captures anything itself and never tells the server an amount: the server creates the order, and verifies the capture.
 */
declare global {
  interface Window {
    paypal?: any;
  }
}

export interface CheckoutResult {
  orderId: string;
  captureId?: string;
  amount: string;
  status: string;
}

export function PayPalCheckout({
  amount,
  fundId,
  onApproved,
  onError,
  onCancel,
}: {
  amount: string;
  fundId: string;
  onApproved: (r: CheckoutResult) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const amountRef = useRef(amount);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  // the buttons are created once; each click reads the CURRENT amount
  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  useEffect(() => {
    if (!clientId) {
      setState("unavailable");
      return;
    }
    let dead = false;
    let buttons: any;
    loadPayPalSdk("orders", clientId)
      .then((sdk) => {
        if (dead || !box.current) return;
        buttons = sdk.Buttons({
          style: { layout: "vertical", shape: "rect", color: "black", label: "paypal", height: 46, tagline: false },
          onClick: (_: unknown, actions: any) => {
            const v = Number(amountRef.current);
            if (!Number.isFinite(v) || v < 1) {
              onError("Enter an amount of at least $1.00.");
              return actions.reject();
            }
            return actions.resolve();
          },
          createOrder: async () => {
            const res = await fetch("/api/donations/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amountUsd: Number(amountRef.current).toFixed(2), fundId }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok || !j.orderId) throw new Error(j.message ?? "Could not start the PayPal checkout.");
            return j.orderId as string;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch("/api/donations/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.message ?? "PayPal approved the payment but we could not confirm the capture. You have not been charged twice; please check PayPal.");
            onApproved({ orderId: j.orderId, captureId: j.captureId, amount: j.amount, status: j.status });
          },
          onCancel: () => onCancel(),
          onError: (e: unknown) => onError(e instanceof Error ? e.message : "PayPal reported a problem. Nothing was charged."),
        });
        if (buttons.isEligible()) {
          buttons.render(box.current).then(() => !dead && setState("ready"));
        } else {
          setState("unavailable");
        }
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
    // buttons are created once for this client id; amount is read through the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fundId]);

  return (
    <div>
      <div ref={box} data-testid="paypal-buttons" className={state === "ready" ? "min-h-[48px]" : "min-h-[48px] opacity-60"} aria-busy={state === "loading"} />
      {state === "loading" && <p className="mt-2 text-center text-[12.5px] text-ink-3">Loading PayPal…</p>}
      {state === "unavailable" && (
        <p role="alert" className="mt-2 text-center text-[12.5px] text-ink-3">
          PayPal checkout couldn’t load in this browser (an ad blocker can cause this). Reload, or allow paypal.com.
        </p>
      )}
    </div>
  );
}
