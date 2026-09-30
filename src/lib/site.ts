import { FOUNDER_PRICE, FOUNDER_PRICE_INR, SEAT_PRICE } from "./pricing";

/** Who runs the site. Used by the legal pages and the footer. */
export const SITE = {
  brand: "MergeMate",
  product: "MergeCity",
  // What MergeMate does, in one line. Shown under the headline and in link previews.
  pitch: "MergeMate finds open source issues that match your skills and walks you through the fix, so you ship real PRs and actually understand them.",
  url: "https://merge-city.vercel.app",
  operator: "Hardik Sharma",
  location: "India",
  // Answers support, refund and privacy requests.
  email: "hardikhs2806@gmail.com",
  founder: {
    name: "Hardik Sharma",
    role: "Founder, MergeMate",
    tagline: "Solopreneur and indie hacker, building MergeMate in public.",
    website: "https://hardiksharma.in",
    github: "https://github.com/hardiksh28",
  },
  updated: "30 September 2026",
  founderPrice: `$${FOUNDER_PRICE}`,
  founderPriceInr: `₹${FOUNDER_PRICE_INR}`,
  seatPrice: `$${SEAT_PRICE}`,
  refundDays: 7,
};

export const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact" },
] as const;
