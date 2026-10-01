"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HEADWEAR, OUTFITS, SKINS, backend } from "@/lib/backend";
import { isValidEmail, randomLook } from "@/lib/moderation";
import { track } from "@/lib/analytics";
import { useCity } from "@/lib/store";

/**
 * One-click waitlist: email → 6-digit code → you're in, with a random
 * character on the next free plot. Building a character is optional, later.
 */
export function QuickJoin() {
  const ref = useCity((s) => s.ref);
  const set = useCity((s) => s.set);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErr("");
    if (!isValidEmail(email.trim())) return setErr("Enter a valid email.");
    setBusy(true);
    track("join_start", { flow: "quick" });
    try {
      const r = await backend.requestCode(email);
      setDevCode(r.devCode);
      setStep("code");
      track("code_requested", { flow: "quick" });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    setBusy(true);
    setErr("");
    try {
      const look = randomLook(OUTFITS, SKINS, HEADWEAR);
      const me = await backend.verifyAndJoin({ email, github: "", handle: "", look, ref }, value);
      const { residents, teams } = backend.city();
      set({ me, residents, teams, guest: false, welcome: null, draftLook: me.look });
      track("sign_up", { method: "email", flow: "quick", referred: ref ? 1 : 0 });
      useCity.getState().arrive(me.plotId);
      try {
        sessionStorage.removeItem("mergecity:ref");
      } catch {}
    } catch (x) {
      track("verify_failed", { flow: "quick" });
      setErr((x as Error).message);
      setCode("");
      setBusy(false);
    }
  };

  if (step === "code")
    return (
      <div className="w-full max-w-[460px]">
        <p className="text-sm text-muted">
          We sent a 6-digit code to <b className="text-ink">{email}</b>.
        </p>
        <input
          ref={codeRef}
          className="field mt-3 text-center font-mono !text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          aria-label="6-digit code"
          disabled={busy}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) verify(v);
          }}
        />
        {devCode && (
          <p className="mt-2 text-xs text-amber">
            Demo inbox: your code is{" "}
            <button type="button" className="font-mono font-bold underline decoration-dotted" onClick={() => { setCode(devCode); verify(devCode); }}>
              {devCode}
            </button>
          </p>
        )}
        {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
        <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-dim">
          <span>{busy ? "Checking…" : "No email? Check spam or promotions."}</span>
          <span className="flex gap-3">
            <button type="button" className="hover:text-ink" onClick={() => { setStep("email"); setCode(""); setErr(""); }}>
              Change email
            </button>
            <button type="button" className="hover:text-ink" disabled={busy} onClick={() => send()}>
              Resend
            </button>
          </span>
        </p>
      </div>
    );

  return (
    <form onSubmit={send} noValidate className="w-full max-w-[460px]">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="field min-w-0 flex-1"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary shrink-0 text-sm" disabled={busy}>
          {busy ? "Sending…" : "Join the waitlist"}
        </button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-red">{err}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-dim">
        Free, no card. We email one code to verify. By joining you agree to the{" "}
        <Link href="/terms" target="_blank" className="underline hover:text-ink">Terms</Link> and{" "}
        <Link href="/privacy" target="_blank" className="underline hover:text-ink">Privacy Policy</Link>.
      </p>
    </form>
  );
}
