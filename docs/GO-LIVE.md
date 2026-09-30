# Taking MergeCity live

Today everything runs as a **demo** inside the visitor's browser (`src/lib/backend.ts` keeps data in `localStorage`). No emails are sent and no money moves. Going live comes down to four things: a real database, real email codes, real payments, and the legal pages a payment gateway requires.

Steps marked **(you)** need your accounts, documents or decisions. Steps marked **(code)** are changes in this repo that can be made once your keys exist.

---

## 1. Accounts to create (you)

| Service | Why | Cost to start |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, email-code login, realtime | Free tier |
| [Razorpay](https://razorpay.com) | ₹9 UPI payments and UPI Autopay subscriptions | No setup fee; about 2% per transaction |
| [Resend](https://resend.com) | Sending the 6-digit codes and "you gained a floor" emails | Free up to 3,000/month |
| A domain, e.g. `mergecity.dev` | Referral links, email sending, Razorpay approval | About ₹800–1,500/year |
| Vercel (already connected) | Hosting | Free tier |

**Razorpay KYC takes the longest (usually 2–7 days), so start it first.** You'll need your PAN, a bank account, and a business proof. A sole proprietor or individual with GST, or a registered company, both work. Test mode works right away, before KYC.

## 2. Database: Supabase

1. **(you)** Create a project and pick the Mumbai region (`ap-south-1`) for low latency in India.
2. **(you)** In the SQL editor, run `supabase/schema.sql`, then `supabase/plots.sql`. That creates the tables and security rules and registers all 480 plots. Regenerate the plots file with `npm run db:plots > supabase/plots.sql` if you ever change the city layout.
3. **(you)** Go to Authentication → Providers → Email. Turn on **Email OTP**, keep "Confirm email" on, and set the code length to 6.
4. **(you)** Go to Authentication → Rate limits and keep the defaults. They stop code spam.
5. **(you)** Copy the Project URL, the `anon` key and the `service_role` key. Never put `service_role` in browser code.

## 3. Emails: Resend

1. **(you)** Add your domain in Resend and add the DNS records it shows (SPF/DKIM). This keeps codes out of spam.
2. **(you)** In Supabase, go to Authentication → SMTP Settings and enter Resend's SMTP details (`smtp.resend.com`, port 465, user `resend`, password = your API key).
3. **(you)** In Supabase, go to Authentication → Email Templates → "Magic Link" and make the body show the code: `Your MergeCity door key: {{ .Token }}`.

## 4. Payments: Razorpay

1. **(you)** Dashboard → Settings → API Keys: generate **test** keys first.
2. **(you)** Dashboard → Webhooks → Add:
   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Events: `payment.captured`, `subscription.activated`, `subscription.charged`, `subscription.cancelled`
   - Pick a secret and keep it: that's `RAZORPAY_WEBHOOK_SECRET`.
3. **(you)** For team towers, go to Subscriptions → Plans and create a plan at your real seat price. Seats are the subscription `quantity`. Ask Razorpay support to enable **UPI Autopay** on your account.
4. **(you)** Test with UPI ID `success@razorpay` (and `failure@razorpay` for the failure path) in test mode.
5. **(you)** After KYC, switch to **live** keys in Vercel.

The upgrade is only granted by the webhook, so a user can't fake a payment from the browser. That logic is already in `src/app/api/webhooks/razorpay/route.ts` and `grant_founder()` in the schema.

## 5. Legal pages Razorpay checks before approving you (you + code)

Razorpay reviews your website during activation. You need public pages for:

- **Terms & Conditions**
- **Privacy Policy** (what you collect: email, optional GitHub username; that emails are never shown)
- **Refund & Cancellation Policy**. It must match the button text: "₹9 is credited to your first bill and refundable on request before launch."
- **Contact us** (email and address)

Also:

- Put your business name in the footer.
- Ask your CA about GST on ₹9 and on seats, and about invoice format.

## 6. Environment variables (you, in Vercel → Settings → Environment Variables)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

## 7. Code changes once the keys exist (code)

1. `npm i @supabase/supabase-js` and swap each demo function in `src/lib/backend.ts`:
   - `requestCode` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
   - `verifyAndJoin` → `supabase.auth.verifyOtp({ email, token, type: "email" })`, then `supabase.rpc("move_in", { p_handle, p_github, p_look, p_ref })`
   - `city()` → `select` from `public_residents` and `teams`, plus a Realtime channel on `residents` so new houses appear live
   - `me()` → the signed-in user's row
2. The ₹9 button: call `POST /api/pay/founder`, then open Razorpay Checkout (`https://checkout.razorpay.com/v1/checkout.js`) with the returned `orderId`. When Checkout closes, wait for the Realtime update. Don't upgrade in the browser.
3. The team tower: add an `/api/pay/team` route that creates a Razorpay subscription with `notes: { user_id, tower_id, team_name }`.
4. Remove the demo-only parts: the "Demo inbox" code, "Demo: simulate a teammate", simulated arrivals, `catchUp`, and the demo payment notes.
5. Protect `/admin` behind an admin check, e.g. an `admins` table plus a server-side check. Make the CSV export a server route.
6. Optional: add [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) on the join form if bots show up.
7. Optional (phase 2): GitHub OAuth in Supabase, plus a server route that fetches real contributions for the commit garden.

## 8. Launch checklist

- [ ] Sign up end to end on a real phone with a real inbox
- [ ] A referral link adds a floor only after the friend verifies
- [ ] A ₹9 test payment moves the house to Main Street through the webhook, and a retried webhook doesn't double-grant
- [ ] A refund from the Razorpay dashboard is reflected (manually, for now)
- [ ] The site works on a budget Android phone (3D in battery-saver mode, or the 2D map)
- [ ] The privacy, terms, refund and contact pages are live and linked in the footer
- [ ] Switch Razorpay to live keys
