"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import QRCode from "qrcode";
import { FOUNDER_PRICE, FOUNDER_PRICE_INR, SEAT_PRICE, backend, money, rupees } from "@/lib/backend";
import { PAY_TO, type PayMethod } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { CITY, DISTRICT_META, MAX_FLOORS, PLOTS_BY_ID, TOWERS_BY_ID, plotLabel } from "@/lib/city";
import { visitPlot } from "@/lib/interact";
import { GARDEN_COLORS, GARDEN_DAYS, GARDEN_WEEKS } from "@/lib/garden";
import { gardenLevels, useGardens } from "@/lib/useGarden";
import { useCity } from "@/lib/store";
import type { Tier } from "@/lib/types";
import { Avatar } from "./Avatar";
import { BackButton } from "./BackButton";
import { Deed, fmtDate, registryNo } from "./Deed";

export function Panels() {
  const panel = useCity((s) => s.panel);
  const depth = useCity((s) => s.panelStack.length);
  const set = useCity((s) => s.set);
  if (!panel) return null;
  const close = () => set({ panel: null });

  let body: ReactNode = null;
  switch (panel.type) {
    case "neighbour":
      body = <NeighbourPanel id={panel.id} />;
      break;
    case "house":
      body = <HousePanel />;
      break;
    case "vacant":
      body = <VacantPanel plotId={panel.plotId} />;
      break;
    case "tower":
      body = <TowerPanel towerId={panel.towerId} />;
      break;
    case "hq":
    case "registry":
      body = <RegistryPanel />;
      break;
    case "pay":
      body = <PayPanel />;
      break;
    case "team":
      body = <TeamPanel towerId={panel.towerId} />;
      break;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center sm:items-start sm:justify-end sm:p-5">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 sm:bg-black/20" onClick={close} />
      <aside role="dialog" aria-modal className="glass sheet-in relative flex max-h-[84dvh] w-full flex-col rounded-t-3xl !bg-[rgba(8,13,24,0.88)] sm:max-h-[calc(100dvh-2.5rem)] sm:w-[420px] sm:rounded-3xl">
        <button onClick={close} aria-label="Close panel" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:text-ink">
          ✕
        </button>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center px-5 pt-4 sm:px-6 sm:pt-5">
          <BackButton label={depth ? "Back" : "Close"} />
        </div>
        <div className="no-scrollbar overflow-y-auto p-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-4">{body}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function TierBadge({ tier }: { tier: Tier }) {
  const m = {
    free: { t: "Outskirts resident", c: "#7ee787" },
    founder: { t: "Founding resident", c: "#4fd1ff" },
    team: { t: "Tower team", c: "#ffc15e" },
  }[tier];
  return (
    <span className="chip !py-1" style={{ color: m.c, borderColor: m.c + "66" }}>
      {tier === "founder" ? "⚑ " : ""}
      {m.t}
    </span>
  );
}

function Garden({ github }: { github: string }) {
  useGardens([github]);
  const cells = gardenLevels(github);
  return (
    <div>
      <div className="flex gap-[3px]">
        {Array.from({ length: GARDEN_WEEKS }).map((_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: GARDEN_DAYS }).map((_, d) => {
              const lvl = cells[w * GARDEN_DAYS + d];
              return <div key={d} className="h-3 w-3 rounded-[3px]" style={{ background: GARDEN_COLORS[lvl], boxShadow: lvl >= 3 ? `0 0 6px ${GARDEN_COLORS[lvl]}` : undefined }} />;
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-dim">{backend.demo ? <>Commit garden · made-up pattern for @{github} in the demo.</> : <>Commit garden · the last {GARDEN_WEEKS} weeks of <a className="underline hover:text-ink" href={`https://github.com/${github}`} target="_blank" rel="noopener noreferrer">@{github}</a>&apos;s public GitHub contributions.</>}</p>
    </div>
  );
}

function Floors({ n }: { n: number }) {
  return (
    <div className="flex flex-col-reverse gap-1">
      {Array.from({ length: MAX_FLOORS }).map((_, i) => (
        <div key={i} className="h-2.5 w-10 rounded-sm" style={{ background: i < n ? "#7ee787" : "rgba(255,255,255,.07)", boxShadow: i < n ? "0 0 10px #7ee78788" : undefined }} />
      ))}
    </div>
  );
}

function Stat({ k, v, c }: { k: string; v: ReactNode; c?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <div className="label !text-[10px]">{k}</div>
      <div className="mt-1 font-display text-lg font-bold" style={{ color: c }}>
        {v}
      </div>
    </div>
  );
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ---------------------------------------------------------------- panels

function NeighbourPanel({ id }: { id: string }) {
  const r = useCity((s) => s.residents.find((x) => x.id === id));
  const launch = useCity((s) => s.launch);
  if (!r) return <p className="text-muted">This house is empty now.</p>;
  const p = PLOTS_BY_ID.get(r.plotId)!;
  return (
    <div>
      <p className="label">{launch ? "Door open" : "Knock knock"}</p>
      <div className="mt-3 flex items-center gap-4">
        <Avatar look={r.look} size={72} />
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-black">{r.handle}</h3>
          <p className="text-sm text-muted">{plotLabel(p)}</p>
          <div className="mt-2">
            <TierBadge tier={r.tier} />
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-muted">
        <span className="text-ink">{r.handle}</span> opens the door and waves. Moved in {ago(r.joinedAt)}.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat k="In line" v={`#${r.place}`} />
        <Stat k="Floors" v={`${r.floors}/${MAX_FLOORS}`} c="#7ee787" />
        <Stat k="Lights" v={r.tier === "free" && !launch ? "Off" : "On"} c={r.tier === "free" && !launch ? "#66748c" : "#ffc15e"} />
      </div>
      {r.github && (
        <div className="mt-5">
          <a className="text-sm text-cyan hover:underline" href={`https://github.com/${r.github}`} target="_blank" rel="noopener noreferrer">
            github.com/{r.github} ↗
          </a>
          <div className="mt-3">
            <Garden github={r.github} />
          </div>
        </div>
      )}
      {launch && (
        <a className="btn btn-gold mt-6 w-full" href="#" onClick={(e) => e.preventDefault()}>
          Open MergeMate →
        </a>
      )}
    </div>
  );
}

function HousePanel() {
  const me = useCity((s) => s.me);
  const set = useCity((s) => s.set);
  const toast = useCity((s) => s.toast);
  const teams = useCity((s) => s.teams);
  const claim = useSyncExternalStore(backend.subscribe, backend.myClaim, () => null);
  const [copied, setCopied] = useState(false);
  const origin = typeof window === "undefined" ? "" : location.origin;

  if (!me) {
    return (
      <div>
        <p className="label">Visitor</p>
        <h3 className="mt-2 font-display text-xl font-black">You don&apos;t have a house yet</h3>
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ phase: "join", panel: null })}>
          Move in →
        </button>
      </div>
    );
  }
  const p = PLOTS_BY_ID.get(me.plotId)!;
  const link = `${origin}/r/${me.refCode}`;
  const shareText = `I just moved into MergeCity (Plot ${p.num}). Join the MergeMate waitlist with my link and we both get a bigger house:`;
  const myTeam = teams.find((t) => t.ownerId === me.id);
  const meta = DISTRICT_META[p.district];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy. Long-press the link instead.");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "MergeCity", text: shareText, url: link });
      } catch {}
    } else copy();
  };
  const simulate = async () => {
    const r = await backend.simulateTeammate();
    if (!r) return;
    set({ me: r.me });
    useCity.getState().arrive(r.mate.plotId);
    toast(r.me.floors >= MAX_FLOORS && me.floors >= MAX_FLOORS ? `${r.mate.handle} joined. You're already at max height.` : `${r.mate.handle} verified with your link. +1 floor!`, "good");
  };

  return (
    <div>
      <p className="label" style={{ color: meta.color }}>
        Your ticket
      </p>
      {/* ticket */}
      <div className="relative mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: meta.color + "55", background: `linear-gradient(135deg, ${meta.color}22, transparent 60%), #0b1220` }}>
        <div className="flex items-center gap-4 p-4">
          <Avatar look={me.look} size={64} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-black">{me.handle}</h3>
            <p className="text-xs text-muted">{plotLabel(p)}</p>
            <div className="mt-2">
              <TierBadge tier={me.tier} />
            </div>
          </div>
        </div>
        <div className="relative border-t border-dashed px-4 py-3" style={{ borderColor: meta.color + "44" }}>
          <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-[#0b1220]" />
          <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-[#0b1220]" />
          <div className="flex items-end justify-between">
            <div>
              <div className="label !text-[10px]">Waitlist spot</div>
              <div className="font-display text-4xl font-black neon-text" style={{ color: meta.color }}>
                #{me.place}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-right">
                <div className="label !text-[10px]">Floors</div>
                <div className="font-display text-xl font-bold text-lime">
                  {me.floors}/{MAX_FLOORS}
                </div>
              </div>
              <Floors n={me.floors} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Deed r={me} />
      </div>

      {me.github && (
        <div className="mt-5">
          <p className="label mb-2">GitHub garden</p>
          <Garden github={me.github} />
        </div>
      )}

      {/* referral */}
      <section className="mt-6">
        <p className="label">Build up · invite teammates</p>
        <p className="mt-1.5 text-sm text-muted">
          {me.floors >= MAX_FLOORS
            ? "Max height reached. Keep inviting: your teammates still move in next door."
            : `Each teammate who joins and verifies adds a floor. ${MAX_FLOORS - me.floors} to go.`}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-black/30 p-1.5 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-cyan">{link.replace(/^https?:\/\//, "")}</code>
          <button className="btn btn-ghost !px-3 !py-2 !text-[10px]" onClick={copy}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <a className="btn btn-ghost !px-2 !py-2.5 !text-[10px]" href={`https://wa.me/?text=${encodeURIComponent(shareText + " " + link)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          <a className="btn btn-ghost !px-2 !py-2.5 !text-[10px]" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer">
            Post on X
          </a>
          <button className="btn btn-ghost !px-2 !py-2.5 !text-[10px]" onClick={share}>
            Share…
          </button>
        </div>
        {backend.demo && (
          <button className="mt-2 w-full rounded-lg border border-dashed border-amber/30 py-2 font-mono text-[11px] uppercase tracking-wider text-amber/80 hover:bg-amber/5" onClick={simulate}>
            Demo: simulate a teammate verifying
          </button>
        )}
      </section>

      {/* upgrades */}
      <section className="mt-6 space-y-3">
        <p className="label">Upgrades</p>
        {me.tier === "free" ? (
          <div className="rounded-2xl border border-blue/40 p-4" style={{ background: "linear-gradient(135deg, rgba(79,209,255,.14), transparent 70%)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-display font-bold">Move to Main Street</h4>
                <p className="mt-1 text-sm text-muted">Lights on, a founding-resident flag, and a Main Street address.</p>
              </div>
              <span className="font-display text-2xl font-black text-blue">{money(FOUNDER_PRICE)}</span>
            </div>
            <p className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-xs leading-relaxed text-ink/80">
              <b>What the {money(FOUNDER_PRICE)} is:</b> a one-time payment ({rupees(FOUNDER_PRICE_INR)} by UPI in India, {money(FOUNDER_PRICE)} by PayPal elsewhere), credited as {money(FOUNDER_PRICE)} off your first MergeMate bill. Refundable on request any time before launch. Not a subscription.
            </p>
            <button className="btn btn-primary mt-3 w-full" onClick={() => set({ panel: { type: "pay" } })}>
              {claim?.status === "pending" ? "Payment being checked…" : `Pay ${money(FOUNDER_PRICE)}`}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
            <b className="text-amber">⚑ Founding resident.</b> <span className="text-muted">Your lights are on and your flag is up on {DISTRICT_META[p.district].name}.</span>
          </div>
        )}
        {myTeam ? (
          <div className="rounded-2xl border border-cyan/40 bg-cyan/10 p-4 text-sm">
            <b className="text-cyan">{myTeam.name}</b> <span className="text-muted">owns tower {myTeam.towerId} downtown with {myTeam.seats} lit floors.</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-cyan/30 p-4" style={{ background: "linear-gradient(135deg, rgba(34,243,255,.1), transparent 70%)" }}>
            <h4 className="font-display font-bold">Claim a team tower</h4>
            <p className="mt-1 text-sm text-muted">Your company name on a downtown skyscraper. One lit floor per paid seat.</p>
            <button className="btn btn-ghost mt-3 w-full" onClick={() => set({ panel: { type: "team" } })}>
              See towers →
            </button>
          </div>
        )}
      </section>

      <button
        className="mt-6 w-full text-center text-xs text-dim hover:text-muted"
        onClick={() => {
          backend.signOut();
          set({ me: null, panel: null, phase: "landing", guest: false });
        }}
      >
        Sign out of this device
      </button>
    </div>
  );
}

function VacantPanel({ plotId }: { plotId: string }) {
  const me = useCity((s) => s.me);
  const set = useCity((s) => s.set);
  const p = PLOTS_BY_ID.get(plotId)!;
  const ms = p.district === "mainstreet";
  return (
    <div>
      <p className="label" style={{ color: DISTRICT_META[p.district].color }}>
        Vacant plot
      </p>
      <h3 className="mt-2 font-display text-2xl font-black">Plot {p.num}</h3>
      <p className="text-sm text-muted">{DISTRICT_META[p.district].name}</p>
      <p className="mt-4 text-sm text-muted">
        {ms
          ? `Reserved for founding residents. Pay ${money(FOUNDER_PRICE)} and your house moves to the next free spot on Main Street.`
          : "Plots fill outward from HQ. The next person to verify gets the next free plot, so this one could be your teammate's."}
      </p>
      {me ? (
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ panel: ms && me.tier === "free" ? { type: "pay" } : { type: "house" } })}>
          {ms && me.tier === "free" ? `Move to Main Street · ${money(FOUNDER_PRICE)}` : "Get my invite link"}
        </button>
      ) : (
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ phase: "join", panel: null })}>
          Move in →
        </button>
      )}
    </div>
  );
}

function TowerPanel({ towerId }: { towerId: string }) {
  const t = TOWERS_BY_ID.get(towerId)!;
  const team = useCity((s) => s.teams.find((x) => x.towerId === towerId));
  const set = useCity((s) => s.set);
  return (
    <div>
      <p className="label" style={{ color: team ? t.color : "#ffc15e" }}>
        Downtown · Tower {t.id}
      </p>
      <h3 className="mt-2 font-display text-2xl font-black">{team ? team.name : "Unclaimed tower"}</h3>
      <div className="mt-4 flex gap-4">
        <div className="flex h-40 w-16 flex-col-reverse gap-[2px] rounded-md border border-line p-1">
          {Array.from({ length: t.floors }).map((_, i) => (
            <div key={i} className="flex-1 rounded-[1px]" style={{ background: team && i < team.seats ? t.color : "rgba(255,255,255,.05)", boxShadow: team && i < team.seats ? `0 0 6px ${t.color}` : undefined }} />
          ))}
        </div>
        <div className="flex-1 space-y-2">
          <Stat k="Floors" v={t.floors} />
          <Stat k="Lit" v={team ? `${team.seats} seats` : "0"} c={team ? t.color : "#6f6390"} />
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        {team
          ? `Every paid seat lights one floor. ${team.name} has ${t.floors - team.seats} floors left to light.`
          : "This tower is waiting for a team. Claim it and your company name goes up on the skyline for the whole city to see."}
      </p>
      {!team && (
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ panel: { type: "team", towerId } })}>
          Claim for my team
        </button>
      )}
    </div>
  );
}

/** The city's land registry: every verified signup is a registered plot. */
function RegistryPanel() {
  const residents = useCity((s) => s.residents);
  const teams = useCity((s) => s.teams);
  const me = useCity((s) => s.me);
  const launch = useCity((s) => s.launch);
  const set = useCity((s) => s.set);
  const [q, setQ] = useState("");

  const total = CITY.plots.length;
  const openMain = CITY.plots.filter((p) => p.district === "mainstreet").length - residents.filter((r) => PLOTS_BY_ID.get(r.plotId)?.district === "mainstreet").length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^#/, "");
    return [...residents]
      .sort((a, b) => b.place - a.place)
      .filter((r) => {
        if (!s) return true;
        const p = PLOTS_BY_ID.get(r.plotId);
        return r.handle.toLowerCase().includes(s) || String(p?.num) === s || registryNo(r.place).toLowerCase().includes(s);
      })
      .slice(0, 60);
  }, [residents, q]);

  const visit = (id: string) => {
    const r = residents.find((x) => x.id === id);
    const p = r && PLOTS_BY_ID.get(r.plotId);
    if (!p) return;
    visitPlot(p.id);
    set({ panel: null, phase: "explore", guest: !me });
  };

  return (
    <div>
      <p className="label !text-cyan">Registry Plaza</p>
      <h3 className="mt-2 font-display text-2xl font-black">MergeCity Land Registry</h3>
      <p className="mt-2 text-sm text-muted">Every verified signup is registered to a plot of land. Plots are handed out in order, closest to the centre first.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat k="Registered" v={residents.length} c="#7ee787" />
        <Stat k="Open land" v={total - residents.length} />
        <Stat k="Towers" v={`${teams.length}/${CITY.towers.length}`} c="#ffc15e" />
      </div>
      <p className="mt-2 text-xs text-dim">{openMain} Main Street plots left for founding residents.</p>

      {me ? (
        <div className="mt-5">
          <p className="label mb-2">Your deed</p>
          <Deed r={me} compact />
        </div>
      ) : (
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ phase: "join", panel: null })}>
          Register a plot →
        </button>
      )}

      <div className="mt-6">
        <input className="field !py-2.5 text-sm" placeholder="Search name, plot no. or MC-000123" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 divide-y divide-line/60 overflow-hidden rounded-xl border border-line">
          {list.map((r) => {
            const p = PLOTS_BY_ID.get(r.plotId);
            if (!p) return null;
            const meta = DISTRICT_META[p.district];
            return (
              <li key={r.id} className={`flex items-center gap-3 px-3 py-2.5 ${r.id === me?.id ? "bg-lime/10" : ""}`}>
                <Avatar look={r.look} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {r.handle} {r.id === me?.id && <span className="text-lime">(you)</span>}
                  </p>
                  <p className="truncate font-mono text-[11px] text-dim">
                    {registryNo(r.place)} · <span style={{ color: meta.color }}>Plot {p.num}</span> · {fmtDate(r.joinedAt)}
                  </p>
                </div>
                <button className="chip !py-1 hover:!text-ink" onClick={() => visit(r.id)}>
                  Visit
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="px-3 py-4 text-sm text-muted">No registered plot matches that.</li>}
        </ul>
      </div>

      <button className="btn btn-ghost mt-5 w-full" onClick={() => set({ launch: !launch })}>
        {launch ? "End launch-day preview" : "Preview launch day"}
      </button>
    </div>
  );
}

/** Manual checkout: pay by UPI QR (India) or PayPal (elsewhere), then submit the transaction ID for a hand check. */
function PayPanel() {
  const me = useCity((s) => s.me);
  const set = useCity((s) => s.set);
  const claim = useSyncExternalStore(backend.subscribe, backend.myClaim, () => null);
  const [method, setMethod] = useState<PayMethod>(() => (/Kolkata|Calcutta/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? "upi" : "paypal"));
  const [txn, setTxn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!me) return null;
  const ref = registryNo(me.place);

  if (me.tier !== "free" || claim?.status === "approved")
    return (
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber/60 bg-amber/15 text-3xl text-amber">⚑</div>
        <h3 className="mt-4 font-display text-2xl font-black">You&apos;re a founding resident</h3>
        <p className="mt-2 text-sm text-muted">Your house is on {plotLabel(PLOTS_BY_ID.get(me.plotId)!)}. Lights on, flag up.</p>
        {claim && <p className="mt-3 text-xs text-dim">Payment {claim.txnId} · {claim.currency === "INR" ? rupees(claim.amount) : money(claim.amount)} credited to your first MergeMate bill.</p>}
        <button className="btn btn-gold mt-6 w-full" onClick={() => { set({ panel: null, camFocus: { plotId: me.plotId, at: Date.now() } }); }}>
          Walk to my house
        </button>
      </div>
    );

  if (claim?.status === "pending")
    return (
      <div>
        <p className="label !text-blue">Founding resident</p>
        <h3 className="mt-2 font-display text-2xl font-black">Checking your payment</h3>
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
          <span className="live-dot shrink-0" />
          <p className="text-sm text-ink/90">We match every payment by hand, usually within 24 hours. Your house moves to Main Street as soon as it&apos;s confirmed. You don&apos;t need to do anything else.</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat k="Paid by" v={claim.method === "upi" ? "UPI" : "PayPal"} />
          <Stat k="Amount" v={claim.currency === "INR" ? rupees(claim.amount) : money(claim.amount)} />
        </dl>
        <p className="mt-3 font-mono text-xs text-dim">Transaction {claim.txnId}</p>
        <p className="mt-4 text-xs text-muted">
          Something wrong? Email <a className="underline hover:text-ink" href={`mailto:${SITE.email}?subject=${encodeURIComponent(`Payment ${claim.txnId} (${ref})`)}`}>{SITE.email}</a> with your transaction ID.
        </p>
      </div>
    );

  const ready = method === "upi" ? !!PAY_TO.upiId : !!PAY_TO.paypalMe;
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await backend.submitPayment(method, txn);
      useCity.getState().toast("Payment submitted. We'll confirm it within 24 hours.", "good");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="label !text-blue">Founding resident</p>
      <h3 className="mt-2 font-display text-2xl font-black">Move to Main Street</h3>
      <p className="mt-2 text-sm text-muted">One-time. Lights on, a founding-resident flag and a Main Street address. Credited to your first MergeMate bill, refundable before launch.</p>

      {claim?.status === "rejected" && (
        <p className="mt-4 rounded-xl border border-red/40 bg-red/10 p-3 text-xs text-ink/90">
          We couldn&apos;t find a payment for <b className="font-mono">{claim.txnId}</b>. Check the ID and submit again, or email {SITE.email}.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-black/30 p-1">
        {([["upi", "India · UPI", rupees(FOUNDER_PRICE_INR)], ["paypal", "Outside India · PayPal", money(FOUNDER_PRICE)]] as const).map(([m, label, price]) => (
          <button key={m} onClick={() => { setMethod(m); setErr(""); }} className={`rounded-lg px-2 py-2 text-left transition ${method === m ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}>
            <span className="block text-[11px] uppercase tracking-wider">{label}</span>
            <span className="font-display text-lg font-black">{price}</span>
          </button>
        ))}
      </div>

      {!ready ? (
        <p className="mt-4 rounded-xl border border-line p-4 text-sm text-muted">
          {method === "upi" ? "UPI" : "PayPal"} payments open soon. Email <a className="underline" href={`mailto:${SITE.email}?subject=${encodeURIComponent("Founding resident " + ref)}`}>{SITE.email}</a> and we&apos;ll send you the details.
        </p>
      ) : (
        <>
          <p className="label mt-5">Step 1 · Pay</p>
          {method === "upi" ? <UpiPay reference={ref} /> : <PayPalPay reference={ref} />}

          <p className="label mt-5">Step 2 · Tell us it&apos;s paid</p>
          <input
            className="field mt-2 font-mono"
            inputMode={method === "upi" ? "numeric" : "text"}
            placeholder={method === "upi" ? "12-digit UPI reference (UTR)" : "17-character PayPal transaction ID"}
            value={txn}
            onChange={(e) => setTxn(e.target.value)}
          />
          {err && <p className="mt-2 text-sm text-red">{err}</p>}
          <button className="btn btn-primary mt-3 w-full" disabled={busy || !txn.trim()} onClick={submit}>
            {busy ? "Submitting…" : "Submit payment"}
          </button>
          <p className="mt-2 text-center text-[11px] text-dim">
            Your house moves once we&apos;ve matched the payment, usually within 24 hours. By paying you agree to the{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-ink">Terms</Link> and{" "}
            <Link href="/refunds" target="_blank" className="underline hover:text-ink">Refund Policy</Link>.
          </p>
        </>
      )}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-black/30 py-1 pl-3 pr-1">
      <span className="text-[11px] uppercase tracking-wider text-dim">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-cyan">{value}</code>
      <button
        className="btn btn-ghost !px-2.5 !py-1.5 !text-[10px]"
        onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      >
        {done ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

function UpiPay({ reference }: { reference: string }) {
  const isTouch = useCity((s) => s.isTouch);
  const uri = `upi://pay?${new URLSearchParams({ pa: PAY_TO.upiId, pn: PAY_TO.upiName, am: FOUNDER_PRICE_INR.toFixed(2), cu: "INR", tn: `MergeCity ${reference}` })}`;
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then((s) => live && setSvg(s));
    return () => { live = false; };
  }, [uri]);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.02] p-3">
        <div className="h-32 w-32 shrink-0 rounded-lg bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full" aria-label="UPI QR code" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-xs leading-relaxed text-muted">
          Scan with GPay, PhonePe, Paytm or any UPI app. It fills in <b className="text-ink">{rupees(FOUNDER_PRICE_INR)}</b> and the note <b className="text-ink">MergeCity {reference}</b>.
        </p>
      </div>
      {isTouch && (
        <a className="btn btn-ghost w-full" href={uri}>
          Open my UPI app
        </a>
      )}
      <CopyRow label="UPI ID" value={PAY_TO.upiId} />
    </div>
  );
}

function PayPalPay({ reference }: { reference: string }) {
  return (
    <div className="mt-2 space-y-2">
      <a className="btn btn-ghost w-full" href={`https://paypal.me/${encodeURIComponent(PAY_TO.paypalMe)}/${FOUNDER_PRICE}USD`} target="_blank" rel="noopener noreferrer">
        Pay {money(FOUNDER_PRICE)} on PayPal ↗
      </a>
      <p className="text-xs leading-relaxed text-muted">
        Send <b className="text-ink">{money(FOUNDER_PRICE)} USD</b> and add <b className="text-ink">MergeCity {reference}</b> as the note. Card or PayPal balance both work. The transaction ID is in PayPal&apos;s receipt email.
      </p>
      <CopyRow label="Note" value={`MergeCity ${reference}`} />
    </div>
  );
}

function TeamPanel({ towerId }: { towerId?: string }) {
  const me = useCity((s) => s.me);
  const teams = useCity((s) => s.teams);
  const set = useCity((s) => s.set);
  const open = CITY.towers.filter((t) => !teams.some((x) => x.towerId === t.id));
  const [tid, setTid] = useState(towerId && open.some((t) => t.id === towerId) ? towerId : open[0]?.id ?? "");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(5);
  const tower = TOWERS_BY_ID.get(tid);

  if (!me)
    return (
      <div>
        <p className="label !text-cyan">Team towers</p>
        <h3 className="mt-2 font-display text-2xl font-black">Move in first</h3>
        <p className="mt-2 text-sm text-muted">Towers are claimed by residents. Get your house, then bring your team downtown.</p>
        <button className="btn btn-primary mt-5 w-full" onClick={() => set({ phase: "join", panel: null })}>
          Move in →
        </button>
      </div>
    );

  const request = `mailto:${SITE.email}?subject=${encodeURIComponent(`Tower ${tid} for ${name.trim()}`)}&body=${encodeURIComponent(
    `Hi Hardik,\n\nWe'd like tower ${tid} for ${name.trim()} with ${seats} seats.\n\nMy MergeCity registry no.: ${registryNo(me.place)}\n`,
  )}`;

  return (
    <div>
      <p className="label !text-cyan">Team plan</p>
      <h3 className="mt-2 font-display text-2xl font-black">Claim a downtown tower</h3>
      <p className="mt-2 text-sm text-muted">Your company name on the skyline. One lit floor per paid seat. Unclaimed towers stay dark for everyone to see.</p>
      {open.length === 0 ? (
        <p className="mt-4 text-sm text-amber">Every tower is claimed. Join the queue for the next district.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="label">Tower</span>
            <select className="field mt-1.5" value={tid} onChange={(e) => setTid(e.target.value)}>
              {open.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0b1220]">
                  {t.id} · {t.floors} floors
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Company name</span>
            <input className="field mt-1.5" maxLength={20} placeholder="Acme Labs" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div>
            <span className="label">Seats · {seats}</span>
            <input type="range" min={1} max={tower?.floors ?? 20} value={seats} onChange={(e) => setSeats(+e.target.value)} className="mt-2 w-full accent-[#4fd1ff]" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] p-3">
            <span className="text-sm text-muted">
              Estimate · {seats} × {money(SEAT_PRICE)}/mo
            </span>
            <span className="font-display text-xl font-black">{money(seats * SEAT_PRICE)}/mo</span>
          </div>
          <p className="text-xs text-muted">
            Team towers are set up by hand while we&apos;re in early access. Send the request and we&apos;ll reply with payment details (UPI or PayPal) within a day. Nothing is charged until you confirm. See the{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-ink">Terms</Link>.
          </p>
          <a className={`btn btn-primary w-full ${name.trim() ? "" : "pointer-events-none opacity-50"}`} href={request} aria-disabled={!name.trim()}>
            Request this tower
          </a>
        </div>
      )}
    </div>
  );
}

