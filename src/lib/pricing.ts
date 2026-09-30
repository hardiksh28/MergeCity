// The founding-resident upgrade: $2 via PayPal outside India, ₹169 via UPI in India.
export const FOUNDER_PRICE = 2;
export const FOUNDER_PRICE_INR = 169;
export const SEAT_PRICE = 5; // placeholder: set your real per-seat monthly price
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Where payments go. Set these in Vercel (Settings → Environment Variables):
//   NEXT_PUBLIC_UPI_ID      e.g. hardik@okaxis
//   NEXT_PUBLIC_UPI_NAME    name shown in the payer's UPI app
//   NEXT_PUBLIC_PAYPAL_ME   your paypal.me username, e.g. hardiksharma
export const PAY_TO = {
  upiId: process.env.NEXT_PUBLIC_UPI_ID ?? "",
  upiName: process.env.NEXT_PUBLIC_UPI_NAME ?? "Hardik Sharma",
  paypalMe: process.env.NEXT_PUBLIC_PAYPAL_ME ?? "",
};

export type PayMethod = "upi" | "paypal";

/** Loose sanity check only; every payment is verified by hand before approval. */
export function checkTxnId(method: PayMethod, raw: string): string | null {
  const id = raw.trim().replace(/\s+/g, "");
  if (method === "upi") return /^\d{12}$/.test(id) ? null : "A UPI reference (UTR) is 12 digits. Find it in your UPI app under the payment.";
  return /^[A-Z0-9]{17}$/i.test(id) ? null : "A PayPal transaction ID is 17 letters and numbers. It's in your PayPal receipt email.";
}
