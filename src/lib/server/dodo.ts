import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Dodo Payments: a merchant of record that accepts cards worldwide and UPI in
// India, onboards individuals with a PAN, and handles sales tax/VAT/GST.
// Docs: https://docs.dodopayments.com

const API = process.env.DODO_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";

export function dodoConfigured() {
  return !!process.env.DODO_API_KEY;
}

/** Creates a hosted checkout and returns the URL to send the customer to. */
export async function createCheckout(args: {
  productId: string;
  quantity: number;
  email?: string;
  metadata: Record<string, string>;
  returnUrl: string;
}) {
  const res = await fetch(`${API}/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.DODO_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_cart: [{ product_id: args.productId, quantity: args.quantity }],
      customer: args.email ? { email: args.email } : undefined,
      metadata: args.metadata,
      return_url: args.returnUrl,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Dodo checkout failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { checkout_url: string; session_id: string };
}

/**
 * Verifies a Dodo webhook (Standard Webhooks format):
 * signature = base64(HMAC-SHA256(key, `${id}.${timestamp}.${body}`)),
 * where key is the base64 part of the `whsec_...` secret.
 */
export function verifyWebhook(body: string, headers: Headers, secret: string) {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 5 * 60) return false; // replay guard
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  // Header may hold several space-separated "v1,<base64>" signatures.
  return sigHeader.split(" ").some((part) => {
    const sig = Buffer.from(part.split(",")[1] ?? "", "base64");
    return sig.length === expected.length && timingSafeEqual(sig, expected);
  });
}
