import { SITE } from "@/lib/site";

/** "Who's behind this": a small founder card. */
export function Founder({ compact }: { compact?: boolean }) {
  const f = SITE.founder;
  const initials = f.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  if (compact) {
    return (
      <a
        href={f.github}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-black/45 py-1.5 pl-1.5 pr-3.5 backdrop-blur transition hover:border-white/25"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-cyan to-blue font-display text-[10px] font-black text-[#04101c]">{initials}</span>
        <span className="whitespace-nowrap text-[12px] leading-tight text-muted">
          Built by <b className="font-semibold text-ink group-hover:underline">{f.name}</b> · solo indie hacker
        </span>
      </a>
    );
  }

  return (
    <section className="glass flex items-start gap-4 rounded-2xl p-5">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan to-blue font-display text-lg font-black text-[#04101c]">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="label !text-cyan">{f.role}</p>
        <p className="mt-1 font-display text-lg font-bold text-ink">{f.name}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {f.tagline} No team, no investors: every email to this address is read and answered by me.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={f.github} target="_blank" rel="noopener noreferrer" className="chip !no-underline hover:!text-ink">
            GitHub ↗
          </a>
          <a href={`mailto:${SITE.email}`} className="chip !no-underline hover:!text-ink">
            Email me
          </a>
        </div>
      </div>
    </section>
  );
}
