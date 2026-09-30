# MergeCity

The MergeMate waitlist, as a neon 3D city. Everyone who joins gets a character and a house. Referrals add floors. A ₹9 UPI payment moves you to Main Street with the lights on. Teams claim towers downtown.

```bash
npm install
npm run dev        # http://localhost:3000
```

Useful URL flags: `?launch=1` (launch-day preview), `?map=1` (force the 2D map), `?q=low` (battery-saver graphics), `/r/<code>` (referral link), `/admin` (demo admin).

## What works today

Everything in the user flow runs locally with **no backend**. A demo database lives in `localStorage` (`src/lib/backend.ts`) and is seeded with about 190 residents and 7 claimed towers.

| Step | Status |
| --- | --- |
| Dusk flyover landing, live house counter | ✅ |
| Join form: email, GitHub, door name, outfit, skin tone, hair/hat, with a live 3D preview | ✅ |
| Email code verification | ✅ demo: the code shows on screen ("Demo inbox") |
| Move-in: camera flight, light beam, "Welcome to MergeCity, Plot N" | ✅ |
| Explore: WASD/Shift/Space/E, mouse drag, scroll zoom, collisions, minimap | ✅ |
| Mobile: joystick, drag to look, pinch zoom, Jump, Run | ✅ |
| Knock on doors (neighbour cards), vacant plot signs, tower cards, HQ | ✅ |
| Your ticket: place in line, floors, GitHub garden, referral link, share | ✅ |
| Referrals: +1 floor per verified teammate, capped at 5 | ✅ demo button simulates a teammate |
| ₹9 upgrade → Main Street, lights on, flag | ✅ demo checkout, no money moves |
| Team tower: company name, one lit floor per seat, unclaimed towers stay visible | ✅ demo |
| Realtime "priya just moved in" toasts and houses | ✅ simulated |
| Return visit: "3 new neighbours, you gained a floor" | ✅ |
| Launch day: city lights up, fireworks, doors become "Open MergeMate" | ✅ |
| 2D clickable map fallback (no WebGL, or weak devices) | ✅ |
| Admin: signups, referrals, payments, CSV export, remove/rename, flagged names | ✅ demo data |

### What the ₹9 means

A **one-time UPI payment, credited as ₹9 off the first MergeMate bill, refundable on request before launch**. This wording appears next to every ₹9 button. If you pick a different meaning, change it in `src/components/ui/Panels.tsx`.

`SEAT_PRICE` (₹499/seat/month) in `src/lib/backend.ts` is a **placeholder**. Set the real price there.

## How it's built

- **Next.js 16 + React Three Fiber + drei + postprocessing** (bloom, chromatic aberration, vignette, ACES).
- **No 3D model downloads.** The city uses procedural shaders (`src/components/three/shaders.ts`): windows, neon trims, tron roads, synthwave sky. Houses, towers, lamps, trees, cars, rain and garden cells are all instanced, so the whole city takes roughly 20 draw calls. Total client JS is about 520 KB gzipped, and the 3D chunk lazy-loads after the landing page and form are already usable.
- **Characters** are procedural low-poly models with code-driven walk, run, idle, jump and wave animations (`Character.tsx`).
- **Physics**: a tiny circle-vs-AABB solver plus a camera ray test (`src/lib/physics.ts`), in place of Rapier. Everything in the city is an axis-aligned box, and this is much lighter on budget Android phones.
- **Plots** fill outward from HQ (`src/lib/city.ts`): Downtown (20 tower slots), Main Street (~140 founder plots), Outskirts (~650 plots).
- **Device tiers**: weak or touch devices get lower DPR, fewer particles and no grain. Very weak devices and those without WebGL start on the 2D map, and a WebGL crash falls back to it automatically.

## Going live (phase 2 and 3)

1. **Supabase**: run `supabase/schema.sql`. It includes tables, a public view with no emails, RLS, `move_in()` (atomic plot claim and referral credit), `grant_founder()` / `grant_tower()` (idempotent), and Realtime. Seed `plots` from `CITY.plots`.
2. Replace the `backend` object in `src/lib/backend.ts` with Supabase calls:
   - `requestCode` → `supabase.auth.signInWithOtp({ email })`
   - `verifyAndJoin` → `verifyOtp` then `rpc('move_in')`
   - `city()` → `from('public_residents')` plus a Realtime channel on `residents`
   - Delete `simulateTeammate`, `arrival`, `catchUp`, and the demo buttons.
3. **Emails**: send them with Resend or Postmark through Supabase Auth SMTP (codes), plus a small function for "you gained a floor", "a neighbour moved in" and launch day.
4. **Payments**: set the env vars, then point Razorpay webhooks at `/api/webhooks/razorpay`. `/api/pay/founder` creates the order and the browser opens Razorpay Checkout. Upgrades happen **only** in the webhook. For teams, use Razorpay Subscriptions with UPI Autopay and set `notes.tower_id` / `notes.team_name`. Check GST and refund terms with your accountant.
5. **GitHub**: add GitHub OAuth in Supabase, then fetch `contributionsCollection` from the GraphQL API on the server and store it in place of `gardenFor()`.
6. **Admin**: put `/admin` behind an admin role before it reads real data.

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

## Map of the code

```
src/lib/city.ts            layout, districts, plots, towers
src/lib/backend.ts         demo backend (swap for Supabase)
src/lib/physics.ts         collisions + camera ray
src/lib/store.ts           app state (zustand) + per-frame runtime
src/components/three/*     the 3D city
src/components/ui/*        landing, join, HUD, panels, 2D map
src/app/api/*              Razorpay order + webhook
supabase/schema.sql        production schema
```
