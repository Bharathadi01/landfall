/**
 * PayPal JS SDK loader. One-time payments (intent=capture) and subscriptions (intent=subscription, vault=true) need
 * different SDK parameters, so each gets its own namespace and both can be on one page. (Never use window.paypal: the landing
 * page has an element with id="paypal", and browsers expose elements by id on window.)
 */
export type SdkKind = "orders" | "subscriptions";

const CONFIG: Record<SdkKind, { namespace: string; query: string }> = {
  orders: { namespace: "paypalOrders", query: "currency=USD&intent=capture&components=buttons&enable-funding=card" },
  subscriptions: { namespace: "paypalSubs", query: "vault=true&intent=subscription&components=buttons" },
};

export function sdkGlobal(kind: SdkKind): any {
  return (window as any)[CONFIG[kind].namespace];
}

export function loadPayPalSdk(kind: SdkKind, clientId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const { namespace, query } = CONFIG[kind];
    if ((window as any)[namespace]?.Buttons) return resolve((window as any)[namespace]);
    const id = `paypal-sdk-${kind}`;
    const done = () => ((window as any)[namespace]?.Buttons ? resolve((window as any)[namespace]) : reject(new Error("PayPal did not initialise")));
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("PayPal could not be loaded")));
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&${query}`;
    s.async = true;
    // own namespace for each SDK: a page element with id="paypal" would otherwise shadow window.paypal
    s.setAttribute("data-namespace", namespace);
    s.onload = done;
    s.onerror = () => reject(new Error("PayPal could not be loaded"));
    document.head.appendChild(s);
  });
}
