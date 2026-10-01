import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `Privacy Policy · ${SITE.product}` };

export default function Privacy() {
  const mail = `mailto:${SITE.email}?subject=Privacy%20request`;
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${SITE.product} is the waitlist for ${SITE.brand}, run by ${SITE.operator} (${SITE.location}). This page explains what we collect, why, and what you can ask us to do with it. We do not sell your data.`}
    >
      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Your email address</strong> (required). Used to send your verification code, updates about your house, and launch news. <strong>It is never shown in the city.</strong>
        </li>
        <li>
          <strong>What you choose to show publicly:</strong> the name on your door, your character&apos;s look, and your GitHub username if you add it. These, with your plot number, place in line, floors and join date, are visible to everyone in the city.
        </li>
        <li>
          <strong>Referrals:</strong> which invite link you joined with, so we can add a floor to the person who invited you.
        </li>
        <li>
          <strong>Payments:</strong> if you pay, Dodo Payments collects your payment details directly. We receive the result (amount, currency, date and a payment ID), never your card number or UPI PIN.
        </li>
        <li>
          <strong>Technical data:</strong> basic logs (IP address, browser, timestamps) kept by our hosting provider to run the site and stop abuse.
        </li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To create your account, verify your email and give you a plot.</li>
        <li>To run referrals, upgrades and team towers.</li>
        <li>To email you about your account and about the {SITE.brand} launch. You can unsubscribe from launch news at any time.</li>
        <li>To prevent spam, fake signups and fraud.</li>
      </ul>

      <h2>3. Who else handles it</h2>
      <p>We use a few providers to run the service. Each only gets what it needs:</p>
      <ul>
        <li><strong>Vercel</strong>: hosting.</li>
        <li><strong>Supabase</strong>: database and sign-in.</li>
        <li><strong>Google</strong>: sending sign-in emails, and Google Analytics to count visits and signups.</li>
        <li><strong>Dodo Payments</strong>: payments, receipts and sales tax, as our merchant of record.</li>
        <li><strong>GitHub</strong>: only if you connect your GitHub account.</li>
      </ul>
      <p>Some of these providers store data outside India, including in the United States.</p>

      <h2>4. Cookies and local storage</h2>
      <p>
        We use your browser&apos;s local storage to remember your sign-in, your graphics setting and what you last saw in the city. We use Google Analytics, which sets cookies to count visits, see which pages people use and measure signups. It doesn&apos;t receive your email or name. You can block it with any tracker blocker or Google&apos;s <a href="https://tools.google.com/dlpage/gaoptout">opt-out add-on</a>. We do not use advertising cookies.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        We keep your account while the waitlist and product exist, or until you ask us to delete it. Payment records are kept as long as tax law requires, even after an account is deleted.
      </p>

      <h2>6. Your choices and rights</h2>
      <p>
        Email <a href={mail}>{SITE.email}</a> to see a copy of your data, correct it, or delete your account and house. Wherever you live, including India (DPDP Act), the EU/UK (GDPR) and California (CCPA), we handle these requests within 30 days.
      </p>

      <h2>7. Children</h2>
      <p>{SITE.product} is not meant for children under 13. You must be 18 or older, or have a parent&apos;s permission, to make a payment.</p>

      <h2>8. Changes</h2>
      <p>If we change this policy in a way that matters, we will email you before it takes effect.</p>

      <p>
        See also our <Link href="/terms">Terms</Link> and <Link href="/refunds">Refund Policy</Link>.
      </p>
    </LegalPage>
  );
}
