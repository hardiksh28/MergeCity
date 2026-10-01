"use client";

import { sendGAEvent } from "@next/third-parties/google";

import { GA_ID } from "./ga";

/** Funnel events: join_start → code_requested → sign_up → payment_submitted / share. */
export function track(event: string, params: Record<string, string | number> = {}) {
  if (!GA_ID || typeof window === "undefined") return;
  try {
    sendGAEvent("event", event, params);
  } catch {
    /* analytics must never break the app */
  }
}
