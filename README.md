# MergeCity

The MergeMate waitlist, as a 3D city at night. Everyone who verifies gets a registered plot of land, a character and a house. Referrals add floors. A ₹9 UPI payment moves you to Main Street with the lights on. Teams claim towers downtown.

```bash
npm install
npm run dev        # http://localhost:3000
```

Useful URL flags: `?launch=1` (launch-day preview), `?map=1` (force the 2D map), `?q=low` (battery-saver graphics), `/r/<code>` (referral link), `/admin` (demo admin).

## What works today

Everything in the user flow runs locally with **no backend**. A demo database lives in `localStorage` (`src/lib/backend.ts`) and is seeded with 34 residents and 3 claimed towers; the rest is open land.

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

- **Next.js 16 + React Three Fiber + drei + postprocessing** (bloom, SMAA, vignette, ACES).
- **No 3D model downloads.** The city uses procedural shaders (`src/components/three/shaders.ts`): moonlit walls, lit windows, grass, roads, night sky with moon and stars. Houses, towers, lamps, trees, land parcels and garden cells are all instanced, so the whole city takes roughly 20 draw calls. Total client JS is about 520 KB gzipped, and the 3D chunk lazy-loads after the landing page and form are already usable.
- **Characters** are procedural low-poly models with code-driven walk, run, idle, jump and wave animations (`Character.tsx`).
- **Physics**: a tiny circle-vs-AABB solver plus a camera ray test (`src/lib/physics.ts`), in place of Rapier. Everything in the city is an axis-aligned box, and this is much lighter on budget Android phones.
- **Plots** fill outward from the Land Registry (`src/lib/city.ts`): Downtown (8 tower sites), Main Street (~140 founder plots), Outskirts (~340 plots). 480 plots in total.
- **Navigation**: minimap with district names, home/registry arrows and zoom; a beacon over your house; a Back button, Esc and the phone back button all close the top-most screen (`src/lib/nav.ts`).
- **Device tiers**: weak or touch devices get lower DPR, fewer particles and no grain. Very weak devices and those without WebGL start on the 2D map, and a WebGL crash falls back to it automatically.

## Going live

See **[docs/GO-LIVE.md](docs/GO-LIVE.md)** for the step-by-step guide: Supabase, email codes, Razorpay UPI and Autopay, the legal pages Razorpay requires, env vars, and a launch checklist. `npm run db:plots` generates the plots seed SQL from the city layout.

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
