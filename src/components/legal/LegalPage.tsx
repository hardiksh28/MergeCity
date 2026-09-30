import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LINKS, SITE } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";

export function LegalFooter({ compact }: { compact?: boolean }) {
  return (
    <nav aria-label="Legal" className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-dim ${compact ? "" : "justify-center"}`}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="hover:text-ink hover:underline">
          {l.label}
        </Link>
      ))}
      <span>
        © 2026 {SITE.brand} · operated by {SITE.operator}
      </span>
    </nav>
  );
}

export function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto scan-bg">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" aria-label={`${SITE.product} home`}>
            <Logo small />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 py-2 pl-3 pr-4 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink hover:border-white/30">
            <span aria-hidden>←</span> Back to the city
          </Link>
        </header>

        <main className="mt-10">
          <p className="label !text-cyan">Last updated {SITE.updated}</p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          {intro && <p className="mt-4 text-[15px] leading-relaxed text-muted">{intro}</p>}
          <div className="legal mt-8">{children}</div>
        </main>

        <footer className="mt-14 border-t border-line pt-6">
          <LegalFooter />
        </footer>
      </div>
    </div>
  );
}
