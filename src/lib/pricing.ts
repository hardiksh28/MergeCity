// Prices in US dollars. Charged in USD worldwide; the checkout can show a
// local-currency equivalent (e.g. INR for UPI in India).
export const FOUNDER_PRICE = 2;
export const SEAT_PRICE = 5; // placeholder: set your real per-seat monthly price
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
