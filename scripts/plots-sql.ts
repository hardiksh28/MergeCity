// Prints the SQL that seeds `public.plots` from the same layout the 3D city
// uses, so the database and the map can never disagree.
//   npm run db:plots > supabase/plots.sql
import { CITY } from "../src/lib/city";

const rows = CITY.plots.map(
  (p, i) => `('${p.id}','${p.district}',${p.num},${i + 1},${p.x.toFixed(2)},${p.z.toFixed(2)})`,
);
console.log("insert into public.plots (id, district, num, ord, x, z) values");
console.log(rows.join(",\n") + "\non conflict (id) do nothing;");
