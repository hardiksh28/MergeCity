"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { backend } from "@/lib/backend";
import { PLOTS_BY_ID, plotLabel } from "@/lib/city";
import { isBlockedName } from "@/lib/moderation";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";

type Data = ReturnType<typeof backend.admin.all>;

export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<"all" | "flagged" | "founder" | "real">("all");

  useEffect(() => {
    const load = () => setData({ ...backend.admin.all() });
    load();
    return backend.subscribe(load);
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return [...data.residents]
      .reverse()
      .filter((r) => (filter === "flagged" ? isBlockedName(r.handle) : filter === "founder" ? r.tier !== "free" : filter === "real" ? !r.demo : true))
      .filter((r) => !s || r.handle.toLowerCase().includes(s) || r.email.includes(s) || (r.github ?? "").toLowerCase().includes(s));
  }, [data, q, filter]);

  if (!data) return null;
  const day = data.residents.filter((r) => now - r.joinedAt < 864e5).length;
  const revenue = data.payments.reduce((a, p) => a + p.amount, 0);

  const exportCsv = () => {
    const head = "email,handle,github,tier,floors,plot,place,referrals,joined_at\n";
    const body = data.residents
      .map((r) => [r.email, r.handle, r.github ?? "", r.tier, r.floors, r.plotId, r.place, r.referrals, new Date(r.joinedAt).toISOString()].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `mergecity-waitlist-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto scan-bg">
      <div className="mx-auto max-w-6xl p-4 sm:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="chip !text-amber">Admin · demo data</span>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="btn btn-ghost !py-2.5">← City</Link>
            <button className="btn btn-primary !py-2.5" onClick={exportCsv}>Export emails CSV</button>
          </div>
        </header>
        <p className="mt-3 text-sm text-muted">
          Reads this browser&apos;s demo database. With Supabase connected this page should sit behind an admin role check.
        </p>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Signups", data.residents.length],
            ["Last 24h", day],
            ["Referrals", data.referrals.length],
            ["Payments", data.payments.length],
            ["Revenue", `₹${revenue.toLocaleString("en-IN")}`],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-2xl p-4">
              <div className="label">{k}</div>
              <div className="mt-1 font-display text-2xl font-black">{v}</div>
            </div>
          ))}
        </section>

        <section className="glass mt-6 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <input className="field !w-64 !py-2" placeholder="Search handle, email, GitHub" value={q} onChange={(e) => setQ(e.target.value)} />
            {(["all", "real", "founder", "flagged"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "!border-cyan !text-cyan" : ""}`}>
                {f}
              </button>
            ))}
            <button className="chip ml-auto hover:!text-red" onClick={() => confirm("Reset the demo city? This wipes local demo data.") && backend.admin.reset()}>
              Reset demo
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="label">
                <tr>
                  {["Resident", "Email", "Plot", "Tier", "Floors", "Refs", "Joined", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => {
                  const flagged = isBlockedName(r.handle);
                  return (
                    <tr key={r.id} className="border-t border-line/60 hover:bg-white/[0.02]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar look={r.look} size={28} />
                          <span className={flagged ? "text-red" : ""}>{r.handle}</span>
                          {r.github && <span className="text-xs text-dim">@{r.github}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{r.demo ? <span className="text-dim">seeded</span> : r.email}</td>
                      <td className="px-3 py-2 text-xs">{PLOTS_BY_ID.get(r.plotId) ? plotLabel(PLOTS_BY_ID.get(r.plotId)!) : r.plotId}</td>
                      <td className="px-3 py-2 text-xs">{r.tier}</td>
                      <td className="px-3 py-2">{r.floors}</td>
                      <td className="px-3 py-2">{r.referrals}</td>
                      <td className="px-3 py-2 text-xs text-muted">{new Date(r.joinedAt).toLocaleDateString("en-IN")}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button className="chip !py-1 hover:!text-ink" onClick={() => { const n = prompt("New door name", r.handle); if (n) backend.admin.rename(r.id, n); }}>
                          Rename
                        </button>{" "}
                        <button className="chip !py-1 hover:!text-red" onClick={() => confirm(`Remove ${r.handle}'s house?`) && backend.admin.remove(r.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
