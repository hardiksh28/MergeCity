"use client";

import { goBack } from "@/lib/nav";

export function BackButton({ label = "Back", onClick, className = "" }: { label?: string; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick ?? goBack}
      className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 py-2 pl-3 pr-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink backdrop-blur transition hover:border-white/30 hover:bg-black/75 ${className}`}
    >
      <span aria-hidden className="text-sm leading-none">←</span>
      {label}
    </button>
  );
}
