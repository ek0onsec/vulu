"use client";
import { RatingStars } from "./RatingStars";

export function RatingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const label = `${value.toFixed(1).replace(".", ",")}/5`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <RatingStars value={value} size={28} />
        <span className="text-xl font-extrabold text-[var(--color-text)]">{label}</span>
      </div>
      <input
        type="range" min={0} max={5} step={0.1} value={value} role="slider"
        aria-label="Note sur 5" aria-valuetext={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
      />
    </div>
  );
}
