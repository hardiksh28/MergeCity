"use client";

import { useRef, useState } from "react";
import { runtime } from "@/lib/store";

const R = 52;

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect();
    let x = cx - (r.left + r.width / 2);
    let y = cy - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > R) {
      x = (x / d) * R;
      y = (y / d) * R;
    }
    setKnob({ x, y });
    runtime.joy.x = x / R;
    runtime.joy.y = y / R;
  };
  const end = () => {
    id.current = null;
    setKnob({ x: 0, y: 0 });
    runtime.joy.x = runtime.joy.y = 0;
  };

  return (
    <div
      ref={base}
      className="relative grid h-[132px] w-[132px] touch-none place-items-center rounded-full border border-white/15 bg-black/30 backdrop-blur"
      style={{ boxShadow: "inset 0 0 30px rgba(91,124,255,.35)" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === id.current) update(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute inset-4 rounded-full border border-dashed border-white/10" />
      <div
        className="h-14 w-14 rounded-full border border-cyan/70 bg-cyan/20"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)`, boxShadow: "0 0 24px rgba(34,243,255,.6)" }}
      />
    </div>
  );
}
