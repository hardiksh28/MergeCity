// A deliberately small blocklist. Real moderation should also run server-side
// (see supabase/schema.sql) with a proper list and an admin review queue.
const BLOCKED = [
  "fuck", "shit", "bitch", "cunt", "dick", "slut", "whore", "nigg", "fag",
  "rape", "porn", "chutiya", "madarchod", "behenchod", "bhosd", "gandu",
  "randi", "lodu", "lund", "harami", "kutta", "admin", "mergemate",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

export function cleanHandle(raw: string) {
  return raw.replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 20);
}

export function isBlockedName(name: string) {
  const n = name
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
  return BLOCKED.some((w) => n.includes(w));
}

/** "https://github.com/octocat/", "@octocat" or "octocat" -> "octocat". */
export function normalizeGithub(raw: string) {
  return raw.trim().replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
}

export function isValidGithub(u: string) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(u);
}

export function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

/** Checks the join form before a code is sent. Shared by the demo and live backends. */
export function validateJoin(input: { email: string; github: string; handle: string }): string | null {
  if (!isValidEmail(input.email.trim())) return "Enter a valid email.";
  if (input.github && !isValidGithub(normalizeGithub(input.github))) return "That GitHub username isn't valid.";
  const h = cleanHandle(input.handle);
  if (h && isBlockedName(h)) return "Pick a different name for your door.";
  return null;
}
