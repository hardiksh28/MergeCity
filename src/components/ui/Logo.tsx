export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={small ? 22 : 28} height={small ? 22 : 28} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ff2bd6" />
            <stop offset="1" stopColor="#22f3ff" />
          </linearGradient>
        </defs>
        <path d="M3 29V13l6-4v20M12 29V6l8-4v27M23 29V12l6 3v14" fill="none" stroke="url(#lg)" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M1 29.5h30" stroke="#ff2bd6" strokeWidth="1.6" />
      </svg>
      <span data-text="MERGECITY" className={`glitch font-display font-black tracking-[0.18em] ${small ? "text-sm" : "text-base sm:text-lg"}`}>
        MERGECITY
      </span>
    </div>
  );
}
