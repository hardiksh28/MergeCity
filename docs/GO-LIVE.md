# Taking MergeCity live

Today everything runs as a **demo** inside the visitor's browser (`src/lib/backend.ts` keeps data in `localStorage`). No emails are sent and no money moves. Going live comes down to four things: a real database, real email codes, real payments, and the legal pages a payment provider requires.

Steps marked **(you)** need your accounts, documents or decisions. Steps marked **(code)** are changes in this repo that can be made once your keys exist.

---

## 1. Accounts to create (you)

| Service | Why | Cost to start |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, email-code login, realtime | Free tier |
| UPI (your bank app) + [PayPal](https://paypal.com) | ₹169 in India, $2 elsewhere, approved by hand in `/admin` | UPI free; PayPal takes a fee |
| [Resend](https://resend.com) | Sending the 6-digit codes and "you gained a floor" emails | Free up to 3,000/month |
| A domain, e.g. `mergecity.dev` | Referral links, email sending, payment provider approval | About $10–20/year |
| Vercel (already connected) | Hosting | Free tier |

## 2. Payments: manual UPI + PayPal (current)

No payment gateway and no business registration needed. The buyer pays you directly and tells the site their transaction ID; you check it and approve it.

| Buyer | Pays | How |
| --- | --- | --- |
| India | **₹169** | Scans a UPI QR (amount and note `MergeCity MC-000123` filled in), then enters the 12-digit UTR |
| Everywhere else | **$2** | Pays on your `paypal.me` link with the same note, then enters the 17-character PayPal transaction ID |

**Your routine:** open `/admin` → "Payments to check". Match the ID and amount against your bank app / PayPal, then press **Approve** (house moves to Main Street) or **Reject** (buyer sees "we couldn't find this payment").

### Set it up (you)

1. In Vercel → Environment Variables add:
   - `NEXT_PUBLIC_UPI_ID`: your UPI ID, e.g. `name@okaxis`
   - `NEXT_PUBLIC_UPI_NAME`: the name the payer's app shows
   - `NEXT_PUBLIC_PAYPAL_ME`: your PayPal.me username (create one at paypal.me)

   Redeploy. Until a value is set, that option shows "email us" instead.
2. PayPal India: complete your KYC (PAN) and set the purpose code for incoming payments, or PayPal will hold them. PayPal keeps a fee (roughly 4–5% plus a fixed fee, plus conversion) and pays out to your Indian bank.
3. Taxes: without a merchant of record, you are the seller. Keep a record of the payments and ask a CA how to report them.

### Safety

- Nothing is granted from the browser. `submit_payment_claim` only records the ID; `approve_payment_claim` (server-only) grants the upgrade.
- The same transaction ID can't be claimed twice, and each person can have only one claim waiting.
- Team towers are requested by email and set up by hand.

### Later: Dodo Payments (optional)

The Dodo checkout + webhook code is still in `src/app/api/` and `src/lib/server/dodo.ts`. If you want automatic card payments later, finish Dodo verification and set the `DODO_*` variables; the old steps are in git history.

## 3. Database: Supabase

1. **(you)** Create a project and pick a region close to most users: Mumbai (`ap-south-1`) for India, or a US region if most users will be American.
2. **(you)** In the SQL editor, run `supabase/schema.sql`, then `supabase/plots.sql`. That creates the tables and security rules and registers all 480 plots. Regenerate the plots file with `npm run db:plots > supabase/plots.sql` if you change the city layout.
3. **(you)** Go to Authentication → Providers → Email. Turn on **Email OTP**, keep "Confirm email" on, and set the code length to 6.
4. **(you)** Keep the default rate limits (Authentication → Rate limits). They stop code spam.
5. **(you)** Copy the Project URL, the `anon` key and the `service_role` key. Never put `service_role` in browser code.

## 4. Emails: Resend

1. **(you)** Add your domain in Resend and add the DNS records it shows (SPF/DKIM). This keeps codes out of spam.
2. **(you)** In Supabase, go to Authentication → SMTP Settings and enter Resend's SMTP details (`smtp.resend.com`, port 465, user `resend`, password = your API key).
3. **(you)** In Supabase, go to Authentication → Email Templates → "Magic Link" and make the body show the code: `Your MergeCity door key: {{ .Token }}`.

## 5. Legal pages every payment provider checks (done, you: review)

These are built and linked from the home-screen footer, the join form and both checkouts:

- `/terms`: Terms & Conditions
- `/privacy`: Privacy Policy
- `/refunds`: Refund & Cancellation Policy (matches the "$2, credited to your first bill, refundable before launch" wording)
- `/contact`: Contact us

Operator name, support email and website live in one file: `src/lib/site.ts`. Prices come from `src/lib/pricing.ts`, so the pages always match the app.

These pages are a solid plain-language starting point, not legal advice. Have them reviewed if you can, and ask a CA how to report the payments on your Indian taxes.

## 6. Environment variables (you, in Vercel → Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_UPI_ID=
NEXT_PUBLIC_UPI_NAME=
NEXT_PUBLIC_PAYPAL_ME=
```

## 7. Code changes once the keys exist (code)

1. `npm i @supabase/supabase-js` and swap each demo function in `src/lib/backend.ts`:
   - `requestCode` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
   - `verifyAndJoin` → `supabase.auth.verifyOtp({ email, token, type: "email" })`, then `supabase.rpc("move_in", { p_handle, p_github, p_look, p_ref })`
   - `city()` → `select` from `public_residents` and `teams`, plus a Realtime channel on `residents` so new houses appear live
   - `me()` → the signed-in user's row
2. `submitPayment()` → `supabase.rpc("submit_payment_claim", { p_method, p_txn_id })`; `myClaim()` → select from `payment_claims`.
3. `/admin` approve/reject → a server route (admin check) calling `approve_payment_claim` / `reject_payment_claim` with the service-role key.
4. Remove the demo-only parts: the "Demo inbox" code, "Demo: simulate a teammate", simulated arrivals, `catchUp`, and the demo payment notes.
5. Protect `/admin` behind an admin check, e.g. an `admins` table plus a server-side check. Make the CSV export a server route.
6. Optional: add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the join form if bots show up.
7. Optional (phase 2): GitHub OAuth in Supabase, plus a server route that fetches real contributions for the commit garden.

## 8. Launch checklist

- [ ] Sign up end to end on a real phone with a real inbox
- [ ] A referral link adds a floor only after the friend verifies
- [ ] A real ₹169 UPI payment → submit UTR → approve in /admin → house moves to Main Street
- [ ] A $2 PayPal payment works the same way
- [ ] Submitting the same transaction ID twice is refused
- [ ] The site works on a budget Android phone (3D in battery-saver mode, or the 2D map)
- [ ] The privacy, terms, refund and contact pages are live and linked in the footer
