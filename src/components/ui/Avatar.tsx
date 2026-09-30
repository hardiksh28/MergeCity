import type { Look } from "@/lib/types";

/** Flat 2D portrait of a resident, for cards and the 2D map. */
export function Avatar({ look, size = 56 }: { look: Look; size?: number }) {
  const s = size / 56;
  const hair = "#120d18";
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-xl"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 120%, ${look.outfit}66, transparent 70%), #0b1220`,
        boxShadow: `inset 0 0 0 1px ${look.outfit}55`,
      }}
      aria-hidden
    >
      {/* torso */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: -6 * s, width: 38 * s, height: 20 * s, background: look.outfit, borderRadius: 6 * s, boxShadow: `0 0 ${14 * s}px ${look.outfit}` }} />
      {/* head */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 12 * s, width: 24 * s, height: 24 * s, background: look.skin, borderRadius: 5 * s }} />
      {/* visor */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 24 * s, width: 20 * s, height: 4 * s, background: "#7ff9ff", boxShadow: "0 0 8px #4fd1ff", borderRadius: 2 }} />
      {look.head === "short" && <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 9 * s, width: 26 * s, height: 7 * s, background: hair, borderRadius: 3 * s }} />}
      {look.head === "spiky" && (
        <div className="absolute left-1/2 -translate-x-1/2 flex" style={{ top: 3 * s, gap: 1 * s }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: 0, height: 0, borderLeft: `${3.5 * s}px solid transparent`, borderRight: `${3.5 * s}px solid transparent`, borderBottom: `${10 * s}px solid ${i === 1 ? look.outfit : hair}` }} />
          ))}
        </div>
      )}
      {look.head === "mohawk" && <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 3 * s, width: 5 * s, height: 11 * s, background: look.outfit, boxShadow: `0 0 8px ${look.outfit}` }} />}
      {look.head === "cap" && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 8 * s, width: 26 * s, height: 8 * s, background: look.outfit, borderRadius: `${5 * s}px ${5 * s}px 0 0` }} />
          <div className="absolute" style={{ top: 14 * s, left: 26 * s, width: 16 * s, height: 3 * s, background: look.outfit, filter: "brightness(1.4)" }} />
        </>
      )}
      {look.head === "beanie" && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 7 * s, width: 27 * s, height: 10 * s, background: look.outfit, borderRadius: `${8 * s}px ${8 * s}px 2px 2px` }} />
          <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 3 * s, width: 6 * s, height: 6 * s, background: "#fff" }} />
        </>
      )}
      {look.head === "halo" && <div className="absolute left-1/2 -translate-x-1/2 rounded-[50%]" style={{ top: 4 * s, width: 22 * s, height: 6 * s, border: `${2 * s}px solid #ffd35a`, boxShadow: "0 0 10px #ffc15e" }} />}
    </div>
  );
}
