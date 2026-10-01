// The founding-resident upgrade, charged in USD through Dodo Payments.
// Dodo's checkout can show local prices and takes UPI in India.
export const FOUNDER_PRICE = 2;
export const SEAT_PRICE = 5; // placeholder: set your real per-seat monthly price
export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
