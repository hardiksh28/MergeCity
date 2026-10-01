# Taking MergeCity live

Today everything runs as a **demo** inside the visitor's browser (`src/lib/backend.ts` keeps data in `localStorage`). No emails are sent and no money moves. Going live comes down to four things: a real database, real email codes, real payments, and the legal pages a payment provider requires.

Steps marked **(you)** need your accounts, documents or decisions. Steps marked **(code)** are changes in this repo that can be made once your keys exist.

---

## 1. Accounts to create (you)

| Service | Why | Cost to start |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, email-code login, realtime | Free tier |
| [Dodo Payments](https://dodopayments.com) | $2 upgrade: cards worldwide, UPI in India; merchant of record | A percentage per sale |
| [Resend](https://resend.com) | Sending the 6-digit codes and "you gained a floor" emails | Free up to 3,000/month |
| A domain, e.g. `mergecity.dev` | Referral links, email sending, payment provider approval | About $10–20/year |
| Vercel (already connected) | Hosting | Free tier |

## 2. Payments: Dodo Payments

Dodo is the merchant of record: it takes cards worldwide and UPI in India, handles sales tax/VAT/GST, issues receipts and refunds, and pays out to your Indian bank.

**Flow:** Pay $2 → `/api/pay/founder` creates a Dodo checkout for the signed-in user → buyer pays on Dodo → Dodo sends `payment.succeeded` to `/api/webhooks/dodo` → the webhook verifies the signature and calls `grant_founder` → the house moves to Main Street. The buyer is sent back to `/?paid=founder`, where the site shows "Confirming…" until the upgrade lands. Upgrades are never granted from the browser.

### Set up Dodo (you), in **Live** mode

1. **Products → Create product**: "Founding Resident", **one-time**, **$2.00 USD**. Copy its product ID.
2. **Developer → API Keys**: create a key.
3. **Developer → Webhooks → Add endpoint**: `https://merge-city.vercel.app/api/webhooks/dodo`, event **`payment.succeeded`** (add `subscription.*` later if you sell towers by subscription). Copy the signing secret (`whsec_…`).
4. **Vercel → Environment Variables** (Production), then redeploy:
   - `DODO_ENV` = `live` (Config)
   - `DODO_API_KEY` (Secret)
   - `DODO_WEBHOOK_SECRET` (Secret)
   - `DODO_FOUNDER_PRODUCT_ID` (Config)
5. Test: buy it once with your own card, check the house moves and the payment shows in `/admin`, then refund yourself from the Dodo dashboard.

Team towers are still requested by email; `/api/pay/team` (subscription checkout) is ready if you add a seat product and `DODO_SEAT_PRODUCT_ID`.

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
DODO_ENV=live
DODO_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_FOUNDER_PRODUCT_ID=
```

## 7. Code changes once the keys exist (code)

1. `npm i @supabase/supabase-js` and swap each demo function in `src/lib/backend.ts`:
   - `requestCode` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
   - `verifyAndJoin` → `supabase.auth.verifyOtp({ email, token, type: "email" })`, then `supabase.rpc("move_in", { p_handle, p_github, p_look, p_ref })`
   - `city()` → `select` from `public_residents` and `teams`, plus a Realtime channel on `residents` so new houses appear live
   - `me()` → the signed-in user's row
2. Done: `payFounder()` calls `/api/pay/founder` and redirects to Dodo.
3. Done: `/admin` is served by `/api/admin` behind an email check.
4. Remove the demo-only parts: the "Demo inbox" code, "Demo: simulate a teammate", simulated arrivals, `catchUp`, and the demo payment notes.
5. Protect `/admin` behind an admin check, e.g. an `admins` table plus a server-side check. Make the CSV export a server route.
6. Optional: add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the join form if bots show up.
7. Optional (phase 2): GitHub OAuth in Supabase, plus a server route that fetches real contributions for the commit garden.

## 8. Launch checklist

- [ ] Sign up end to end on a real phone with a real inbox
- [ ] A referral link adds a floor only after the friend verifies
- [ ] A real $2 payment moves the house to Main Street within a minute
- [ ] Resending the webhook from the Dodo dashboard doesn't double-grant
- [ ] A cancelled checkout shows "nothing was charged"
- [ ] The site works on a budget Android phone (3D in battery-saver mode, or the 2D map)
- [ ] The privacy, terms, refund and contact pages are live and linked in the footer
