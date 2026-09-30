import { DISTRICT_META, PLOTS_BY_ID } from "@/lib/city";
import type { PublicResident } from "@/lib/types";

export function registryNo(place: number) {
  return `MC-${String(place).padStart(6, "0")}`;
}

export function fmtDate(t: number) {
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The plot deed every resident gets when their registration is verified. */
export function Deed({ r, compact }: { r: PublicResident; compact?: boolean }) {
  const p = PLOTS_BY_ID.get(r.plotId)!;
  const meta = DISTRICT_META[p.district];
  const rows: [string, string][] = [
    ["Owner", r.handle],
    ["Plot", `No. ${p.num} · ${meta.name}`],
    ["Coordinates", `${Math.round(p.x)}, ${Math.round(p.z)}`],
    ["Registered", fmtDate(r.joinedAt)],
    ["Status", r.tier === "free" ? "Registered · house built" : "Registered · founding resident"],
  ];
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 text-left"
      style={{ borderColor: meta.color + "55", background: `linear-gradient(160deg, ${meta.color}18, transparent 55%), #0b1220` }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full border-2 border-dashed opacity-30" style={{ borderColor: meta.color }} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label" style={{ color: meta.color }}>
            MergeCity Land Registry
          </p>
          <p className="mt-1 font-display text-sm font-bold tracking-wide">Certificate of plot registration</p>
        </div>
        <span className="rounded-md border px-2 py-1 font-mono text-[11px]" style={{ borderColor: meta.color + "66", color: meta.color }}>
          {registryNo(r.place)}
        </span>
      </div>
      {!compact && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-dim">{k}</dt>
              <dd className="truncate text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {compact && (
        <p className="mt-2 text-[13px] text-muted">
          Plot {p.num} · {meta.name} · registered {fmtDate(r.joinedAt)}
        </p>
      )}
    </div>
  );
}
