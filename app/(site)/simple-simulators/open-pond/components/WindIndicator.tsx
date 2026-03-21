"use client";

interface WindIndicatorProps {
  degrees: number;
}

export default function WindIndicator({ degrees }: WindIndicatorProps) {
  const moveDeg = (degrees + 180) % 360;

  return (
    <svg
      viewBox="-18 -18 36 36"
      className="h-5 w-5"
      style={{ transform: `rotate(${moveDeg}deg)` }}
    >
      <circle
        cx="0"
        cy="0"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity={0.2}
      />
      <polygon
        points="0,-11 4,4 0,1.5 -4,4"
        fill="hsl(var(--accent-science))"
        stroke="none"
      />
      <line
        x1="0"
        y1="1.5"
        x2="0"
        y2="9"
        stroke="hsl(var(--accent-science))"
        strokeWidth="1.2"
        opacity={0.6}
      />
    </svg>
  );
}
