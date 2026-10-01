import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `Terms & Conditions · ${SITE.product}` };

export default function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={`These terms apply when you use ${SITE.product} (${SITE.url.replace("https://", "")}), the waitlist for ${SITE.brand}. The site is operated by ${SITE.operator}, an individual based in ${SITE.location} ("we", "us"). By joining or paying, you agree to them.`}
    >
      <h2>1. What {SITE.product} is</h2>
      <p>
        {SITE.product} is a waitlist for {SITE.brand}, shown as a shared 3D city. When you verify your email you get a plot, a character and a house. Houses, floors, plots, towers and flags are part of the experience. They are not property, have no value outside {SITE.product}, and cannot be sold or transferred.
      </p>
      <p>
        {SITE.brand} is still being built. We aim to launch, but we cannot promise a date or the final set of features.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Use an email address you own. One account per person.</li>
        <li>Keep your sign-in codes private. You are responsible for activity on your account.</li>
        <li>You must be at least 13 to join, and 18 or older (or have a parent&apos;s permission) to pay.</li>
      </ul>

      <h2>3. Referrals</h2>
      <p>
        Each verified teammate who joins with your invite link adds a floor to your house, up to 5 floors. Referrals from fake, duplicate or automated accounts do not count and may be removed.
      </p>

      <h2>4. Paid upgrades</h2>
      <ul>
        <li>
          <strong>Founding resident, {SITE.founderPrice} USD, one-time.</strong> Moves your house to Main Street with its lights on and a flag. It is credited as {SITE.founderPrice} off your first {SITE.brand} bill and is refundable on request before launch.
        </li>
        <li>
          <strong>Team tower.</strong> Puts your team&apos;s name on a downtown tower, with one lit floor per paid seat. During early access towers are arranged by email; the price and billing period are agreed with you in writing before you pay.
        </li>
        <li>
          Payments are processed by <strong>Dodo Payments</strong>, which acts as the merchant of record and handles applicable taxes. Prices are in US dollars; the checkout may show your local currency, and UPI is available in India.
        </li>
        <li>
          An upgrade is applied automatically once Dodo Payments confirms the payment, usually within a minute. Refunds and cancellations follow our <Link href="/refunds">Refund & Cancellation Policy</Link>.
        </li>
      </ul>

      <h2>5. Fair use</h2>
      <p>Don&apos;t:</p>
      <ul>
        <li>use names that are offensive, impersonate someone, or break the law</li>
        <li>create fake accounts or automate signups</li>
        <li>try to break, overload or reverse-engineer the service</li>
      </ul>
      <p>We may rename or remove houses, and suspend accounts, that break these rules. Where a paid upgrade is removed for a reason that isn&apos;t your fault, we refund it.</p>

      <h2>6. Your content</h2>
      <p>
        You keep ownership of what you add, such as the name on your door. You let us display it in {SITE.product} and its screenshots for as long as your account exists.
      </p>

      <h2>7. Availability and liability</h2>
      <p>
        {SITE.product} is provided &quot;as is&quot;. We try hard to keep it running but cannot promise it will always be available or error-free. To the extent the law allows, our total liability to you is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>8. Ending</h2>
      <p>
        You can delete your account at any time by emailing <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. We may shut down the waitlist after {SITE.brand} launches. Unused founding-resident payments are then refunded or credited as described in the refund policy.
      </p>

      <h2>9. Changes and law</h2>
      <p>
        We may update these terms and will email you about important changes. These terms are governed by the laws of India. Disputes go to the courts of India, unless the law where you live gives you the right to bring a claim there.
      </p>

      <p>
        Questions? See <Link href="/contact">Contact</Link>. Also read our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
