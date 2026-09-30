# Taking MergeCity live

Today everything runs as a **demo** inside the visitor's browser (`src/lib/backend.ts` keeps data in `localStorage`). No emails are sent and no money moves. Going live comes down to four things: a real database, real email codes, real payments, and the legal pages a payment provider requires.

Steps marked **(you)** need your accounts, documents or decisions. Steps marked **(code)** are changes in this repo that can be made once your keys exist.

---

## 1. Accounts to create (you)

| Service | Why | Cost to start |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, email-code login, realtime | Free tier |
| [Dodo Payments](https://dodopayments.com) | $2 upgrade and team subscriptions: cards worldwide (US included) and UPI in India | No setup fee, a percentage per sale |
| [Resend](https://resend.com) | Sending the 6-digit codes and "you gained a floor" emails | Free up to 3,000/month |
| A domain, e.g. `mergecity.dev` | Referral links, email sending, payment provider approval | About $10–20/year |
| Vercel (already connected) | Hosting | Free tier |

## 2. Payments: why Dodo Payments

You need to charge **US customers in dollars** and **Indian customers by UPI**, as an **individual without a registered business**. Here's how the options compare:

| Option | Individuals without a business? | US cards | Indian UPI | Taxes handled for you |
| --- | --- | --- | --- | --- |
| **Dodo Payments** (chosen, code is written) | Yes, PAN + ID | Yes | Yes | Yes (merchant of record) |
| Razorpay | Yes for India, but individuals can take international payments **only through PayPal** | Via PayPal | Yes | No |
| Stripe India | Invite-only for new Indian accounts | — | — | No |
| PayPal alone | Yes | Yes | No | No |

Because Dodo is the **merchant of record**, it is the legal seller: it collects and pays US sales tax, EU VAT and Indian GST on each sale, and pays out to your Indian bank account. That's the main reason to pick it over running Razorpay and PayPal side by side.

Fees and payout timing change, so check the current numbers on Dodo's [pricing page](https://dodopayments.com/pricing). The price is $2 because on very small charges the fixed part of the fee eats most of the sale; $2 keeps it an easy yes while more of it reaches you.

### Set up Dodo (you)

1. Sign up as an **individual**. Verification asks for your PAN, an ID, and a description of the product. Add your Indian bank account for payouts.
2. In **test mode**, create two products:
   - **Founding resident**: one-time, **$2.00 USD**. Copy its product id into `DODO_FOUNDER_PRODUCT_ID`.
   - **Team seat**: subscription, monthly, your seat price in USD (the app shows **$5** as a placeholder: `SEAT_PRICE` in `src/lib/backend.ts`). Copy its id into `DODO_SEAT_PRODUCT_ID`. Seats are the quantity.
3. Developer → API keys: create a key and store it as `DODO_API_KEY`.
4. Developer → Webhooks: add `https://<your-domain>/api/webhooks/dodo` and subscribe to `payment.succeeded`, `subscription.active`, `subscription.renewed`, `subscription.cancelled` and `subscription.expired`. Copy the signing secret (`whsec_…`) into `DODO_WEBHOOK_SECRET`.
5. Pay with test cards in test mode, then switch to live and set `DODO_ENV=live` with live keys.

### What the code already does

- `POST /api/pay/founder` creates a Dodo checkout for the signed-in user and returns the payment page URL.
- `POST /api/pay/team` does the same for a tower subscription (tower, team name, seats).
- `POST /api/webhooks/dodo` verifies Dodo's signature and then grants the upgrade in the database. A forged or replayed request is rejected (tested). **Upgrades are never granted from the browser.**

### Fallback if Dodo doesn't approve you

Use **Razorpay** (UPI for India) plus **PayPal** (cards for the US). Both accept individuals with a PAN. This means two checkouts and two webhooks, and **you** handle GST and US sales tax yourself. Ask me to wire it up if you go this way.

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

## 5. Legal pages every payment provider checks (you + code)

Public pages on your domain:

- **Terms & Conditions**
- **Privacy Policy** (what you collect: email, optional GitHub username; that emails are never shown). US visitors mean you should also mention how people can request deletion.
- **Refund & Cancellation Policy**. It must match the button text: "$2, credited to your first bill, refundable on request before launch." Subscriptions can be cancelled any time.
- **Contact us** (email)

Ask a CA how income from a merchant of record is reported on your Indian taxes.

## 6. Environment variables (you, in Vercel → Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DODO_ENV=test
DODO_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_FOUNDER_PRODUCT_ID=
DODO_SEAT_PRODUCT_ID=
```

## 7. Code changes once the keys exist (code)

1. `npm i @supabase/supabase-js` and swap each demo function in `src/lib/backend.ts`:
   - `requestCode` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
   - `verifyAndJoin` → `supabase.auth.verifyOtp({ email, token, type: "email" })`, then `supabase.rpc("move_in", { p_handle, p_github, p_look, p_ref })`
   - `city()` → `select` from `public_residents` and `teams`, plus a Realtime channel on `residents` so new houses appear live
   - `me()` → the signed-in user's row
2. `payFounder()` → `fetch("/api/pay/founder", { headers: { Authorization: "Bearer " + session.access_token } })`, then `location.href = url`. When the user comes back to `/?paid=founder`, show "Confirming payment…" until Realtime shows the house on Main Street.
3. `claimTower()` → the same with `/api/pay/team`.
4. Remove the demo-only parts: the "Demo inbox" code, "Demo: simulate a teammate", simulated arrivals, `catchUp`, and the demo payment notes.
5. Protect `/admin` behind an admin check, e.g. an `admins` table plus a server-side check. Make the CSV export a server route.
6. Optional: add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the join form if bots show up.
7. Optional (phase 2): GitHub OAuth in Supabase, plus a server route that fetches real contributions for the commit garden.

## 8. Launch checklist

- [ ] Sign up end to end on a real phone with a real inbox
- [ ] A referral link adds a floor only after the friend verifies
- [ ] A $2 test payment with a US test card moves the house to Main Street through the webhook
- [ ] A test payment by UPI from India works the same way
- [ ] A retried webhook doesn't double-grant (Dodo dashboard → resend event)
- [ ] A team subscription lights the tower, and cancelling it releases the tower
- [ ] The site works on a budget Android phone (3D in battery-saver mode, or the 2D map)
- [ ] The privacy, terms, refund and contact pages are live and linked in the footer
- [ ] Switch Dodo to live keys (`DODO_ENV=live`)
