// Google Analytics 4 measurement ID. Public (it's in every page's HTML).
// NEXT_PUBLIC_GA_ID overrides it; set it to "off" to disable analytics.
const id = process.env.NEXT_PUBLIC_GA_ID ?? "G-WRS7ZL1BR1";
export const GA_ID = id === "off" ? "" : id;
