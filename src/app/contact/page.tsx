import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { Founder } from "@/components/legal/Founder";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `Contact · ${SITE.product}` };

const TOPICS = [
  { t: "Refunds & billing", d: `Refunds for the ${SITE.founderPrice} upgrade, receipts, team towers and cancellations.`, s: "Refund request" },
  { t: "Your account", d: "Change the name on your door, delete your account, or get a copy of your data.", s: "Account request" },
  { t: "Report a house", d: "Offensive names, spam houses or anything that shouldn't be in the city.", s: "Report" },
  { t: "Anything else", d: "Questions about MergeMate, partnerships or feedback.", s: "Hello" },
];

export default function Contact() {
  return (
    <LegalPage title="Contact us" intro={`${SITE.product} is run by ${SITE.operator} in ${SITE.location}. Email is the fastest way to reach us, and we reply within 3 business days.`}>
      <a
        href={`mailto:${SITE.email}`}
        className="glass flex items-center justify-between gap-4 rounded-2xl p-5 !no-underline hover:border-cyan/40"
      >
        <span>
          <span className="label block">Email</span>
          <span className="mt-1 block font-display text-lg font-bold text-ink">{SITE.email}</span>
        </span>
        <span className="text-2xl text-cyan" aria-hidden>
          →
        </span>
      </a>

      <div className="mt-6">
        <Founder />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {TOPICS.map((x) => (
          <a
            key={x.t}
            href={`mailto:${SITE.email}?subject=${encodeURIComponent(x.s)}`}
            className="rounded-2xl border border-line bg-white/[0.02] p-4 !no-underline hover:border-white/25"
          >
            <span className="block font-semibold text-ink">{x.t}</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted">{x.d}</span>
          </a>
        ))}
      </div>

      <h2>Operator</h2>
      <p>
        {SITE.operator}
        <br />
        {SITE.location}
        <br />
        Website: <a href={SITE.url}>{SITE.url.replace("https://", "")}</a>
      </p>
      <p>
        Payments are processed by Dodo Payments, our merchant of record. For payment questions you can also reply to your receipt email.
      </p>
      <p>
        See our <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/refunds">Refund Policy</Link>.
      </p>
    </LegalPage>
  );
}
