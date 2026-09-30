"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HEADWEAR, OUTFITS, SKINS, backend } from "@/lib/backend";
import { useCity } from "@/lib/store";
import { Avatar } from "./Avatar";
import { BackButton } from "./BackButton";

export function JoinFlow() {
  const phase = useCity((s) => s.phase);
  const look = useCity((s) => s.draftLook);
  const ref = useCity((s) => s.ref);
  const map2d = useCity((s) => s.map2d);
  const set = useCity((s) => s.set);

  const [email, setEmail] = useState("");
  const [github, setGithub] = useState("");
  const [handle, setHandle] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "verify") codeRef.current?.focus();
  }, [phase]);

  const input = { email, github, handle, look, ref };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const err = backend.validate(input);
    if (err) return setError(err);
    setBusy(true);
    try {
      const r = await backend.requestCode(email);
      setDevCode(r.devCode);
      set({ phase: "verify" });
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: React.FormEvent, override?: string) => {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const me = await backend.verifyAndJoin(input, override ?? code);
      const { residents, teams } = backend.city();
      set({ me, residents, teams, phase: "movein", guest: false, welcome: null });
      useCity.getState().arrive(me.plotId);
      try {
        sessionStorage.removeItem("mergecity:ref");
      } catch {}
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  };

  const randomize = () =>
    set({
      draftLook: {
        outfit: OUTFITS[Math.floor(Math.random() * OUTFITS.length)],
        skin: SKINS[Math.floor(Math.random() * SKINS.length)],
        head: HEADWEAR[Math.floor(Math.random() * HEADWEAR.length)].id,
      },
    });

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end sm:justify-center sm:p-6">
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] sm:hidden">
        <BackButton />
      </div>

      <div className="glass sheet-in pointer-events-auto flex max-h-[68dvh] w-full flex-col rounded-t-3xl sm:max-h-[calc(100dvh-3rem)] sm:w-[440px] sm:rounded-3xl">
        <div className="no-scrollbar overflow-y-auto p-5 sm:p-7">
          {phase === "join" ? (
            <form onSubmit={send} noValidate>
              <div className="flex items-center justify-between gap-3">
                <p className="label !text-cyan">Step 1 of 2 · Your residency</p>
                <BackButton className="hidden sm:inline-flex" />
              </div>
              <h2 className="mt-2 font-display text-2xl font-black tracking-tight">Build your resident</h2>
              {ref && <p className="mt-2 rounded-lg border border-lime/30 bg-lime/10 px-3 py-2 text-xs text-lime">A teammate invited you. They gain a floor once you verify.</p>}

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="label">Email · required</span>
                  <input className="field mt-1.5" type="email" inputMode="email" autoComplete="email" placeholder="you@company.dev" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  <span className="mt-1 block text-[11px] text-dim">Never shown in the city. We send one code to verify.</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">GitHub</span>
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim">@</span>
                      <input className="field !pl-7" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="optional" value={github} onChange={(e) => setGithub(e.target.value.replace(/\s/g, ""))} />
                    </div>
                  </label>
                  <label className="block">
                    <span className="label">Name on door</span>
                    <input className="field mt-1.5" maxLength={20} placeholder="optional" value={handle} onChange={(e) => setHandle(e.target.value)} />
                  </label>
                </div>

                <div className="rounded-2xl border border-line bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <span className="label">Your character</span>
                    <button type="button" onClick={randomize} className="chip hover:text-ink">
                      ⟳ Shuffle
                    </button>
                  </div>
                  {(map2d || !useCity.getState().webgl) && (
                    <div className="mt-3 flex justify-center">
                      <Avatar look={look} size={84} />
                    </div>
                  )}
                  <p className="mt-3 mb-2 text-xs text-muted">Outfit</p>
                  <div className="flex flex-wrap gap-2">
                    {OUTFITS.map((c) => (
                      <button key={c} type="button" aria-label={`Outfit ${c}`} aria-pressed={look.outfit === c} onClick={() => set({ draftLook: { ...look, outfit: c } })}
                        className="h-8 w-8 rounded-lg transition-transform hover:scale-110"
                        style={{ background: c, boxShadow: look.outfit === c ? `0 0 0 2px #060a14, 0 0 0 4px ${c}, 0 0 18px ${c}` : "inset 0 0 0 1px rgba(255,255,255,.15)" }} />
                    ))}
                  </div>
                  <p className="mt-4 mb-2 text-xs text-muted">Skin tone</p>
                  <div className="flex flex-wrap gap-2">
                    {SKINS.map((c) => (
                      <button key={c} type="button" aria-label={`Skin ${c}`} aria-pressed={look.skin === c} onClick={() => set({ draftLook: { ...look, skin: c } })}
                        className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, boxShadow: look.skin === c ? `0 0 0 2px #060a14, 0 0 0 4px #fff` : "none" }} />
                    ))}
                  </div>
                  <p className="mt-4 mb-2 text-xs text-muted">Hair / hat</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HEADWEAR.map((h) => (
                      <button key={h.id} type="button" aria-pressed={look.head === h.id} onClick={() => set({ draftLook: { ...look, head: h.id } })}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${look.head === h.id ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-muted hover:text-ink"}`}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p role="alert" className="mt-4 text-sm text-red">{error}</p>}
              <button className="btn btn-primary mt-5 w-full" disabled={busy}>
                {busy ? "Sending code…" : "Send my door key →"}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-dim">
                Free. No card. One email to verify, then launch news only. By joining you agree to the{" "}
                <Link href="/terms" target="_blank" className="underline hover:text-ink">Terms</Link> and{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-ink">Privacy Policy</Link>.
              </p>
            </form>
          ) : (
            <form onSubmit={verify}>
              <div className="flex items-center justify-between gap-3">
                <p className="label !text-cyan">Step 2 of 2 · Verify</p>
                <BackButton />
              </div>
              <h2 className="mt-2 font-display text-2xl font-black tracking-tight">Check your inbox</h2>
              <p className="mt-2 text-sm text-muted">
                We sent a 6-digit code to <b className="text-ink">{email}</b>. Verifying keeps fake houses out of the city.
              </p>
              <input
                ref={codeRef}
                className="field mt-5 text-center font-mono !text-3xl tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verify(undefined, v);
                }}
              />
              {devCode && (
                <div className="mt-4 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber">
                  <b className="font-mono uppercase tracking-wider">Demo inbox</b> · no email service is wired up yet, so here is your code:{" "}
                  <button type="button" className="font-mono text-sm font-bold underline decoration-dotted" onClick={() => { setCode(devCode); verify(undefined, devCode); }}>
                    {devCode}
                  </button>
                </div>
              )}
              {error && <p role="alert" className="mt-4 text-sm text-red">{error}</p>}
              <button className="btn btn-primary mt-5 w-full" disabled={busy || code.length < 6}>
                {busy ? "Unlocking…" : "Unlock my house →"}
              </button>
              <div className="mt-4 flex justify-between text-xs text-muted">
                <button type="button" className="hover:text-ink" onClick={() => { setCode(""); setError(""); set({ phase: "join" }); }}>
                  ← Change details
                </button>
                <button type="button" className="hover:text-ink" onClick={() => send()} disabled={busy}>
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
