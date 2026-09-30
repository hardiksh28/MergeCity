"use client";

import { useCity } from "@/lib/store";

export function Toasts() {
  const toasts = useCity((s) => s.toasts);
  const phase = useCity((s) => s.phase);
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute left-1/2 z-40 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2 ${phase === "explore" ? "top-[calc(env(safe-area-inset-top)+10.5rem)] sm:top-6" : "top-[calc(env(safe-area-inset-top)+4.5rem)] sm:top-6"}`}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass sheet-in flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px]"
          style={{ borderColor: t.tone === "gold" ? "#ffb02066" : t.tone === "good" ? "#b6ff3b66" : undefined }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.tone === "gold" ? "#ffb020" : t.tone === "good" ? "#b6ff3b" : "#22f3ff", boxShadow: "0 0 8px currentColor" }} />
          <span className="truncate">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
