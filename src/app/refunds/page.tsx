import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: `Refund & Cancellation Policy · ${SITE.product}` };

export default function Refunds() {
  const mail = `mailto:${SITE.email}?subject=Refund%20request`;
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      intro={`Short version: the ${SITE.founderPrice} founding-resident upgrade is refundable on request any time before ${SITE.brand} launches. Team subscriptions can be cancelled any time.`}
    >
      <h2>1. The {SITE.founderPrice} founding-resident upgrade</h2>
      <p>
        This is a <strong>one-time payment of {SITE.founderPrice} USD</strong>. It moves your house to Main Street in {SITE.product}, turns its lights on and adds a founding-resident flag. It is not a subscription and is never charged again.
      </p>
      <ul>
        <li>
          <strong>Before launch:</strong> you can ask for a full refund at any time, for any reason. After the refund your house returns to the Outskirts.
        </li>
        <li>
          <strong>At launch:</strong> the {SITE.founderPrice} is credited as {SITE.founderPrice} off your first {SITE.brand} bill. Once it has been applied to a bill, it can no longer be refunded as cash.
        </li>
        <li>If {SITE.brand} never launches, email us and we will refund you.</li>
        <li>The credit is tied to your account, cannot be transferred and has no cash value except as a refund under this policy.</li>
      </ul>

      <h2>2. Team tower subscriptions</h2>
      <p>
        Team plans are billed monthly at {SITE.seatPrice} USD per seat. You can cancel, or reduce seats, at any time from the link in your receipt email or by emailing us.
      </p>
      <ul>
        <li>Cancelling stops future charges. Your tower stays lit until the end of the month you have already paid for.</li>
        <li>
          We do not refund partial months, except that <strong>a first payment is refundable in full if you ask within {SITE.refundDays} days</strong> and have not used the paid features beyond the city.
        </li>
        <li>If you were charged by mistake, for example a duplicate charge, we refund it in full.</li>
      </ul>

      <h2>3. How to ask for a refund</h2>
      <p>
        Email <a href={mail}>{SITE.email}</a> from the address you signed up with. Include the receipt number or the date of the payment. We reply within 3 business days.
      </p>
      <p>
        Approved refunds go back to the original payment method (card or UPI). Payments are processed by <strong>Dodo Payments</strong>, our merchant of record, which issues the refund. Your bank usually shows it within 5–10 business days.
      </p>

      <h2>4. Delivery</h2>
      <p>
        Everything we sell is digital. The founding-resident upgrade and team towers are delivered instantly in {SITE.product} once the payment is confirmed. Nothing is shipped.
      </p>

      <h2>5. Chargebacks</h2>
      <p>
        Please email us before disputing a charge with your bank. We will sort it out faster. Accounts with a chargeback may lose the paid upgrade while the dispute is open.
      </p>

      <p>
        See also our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
