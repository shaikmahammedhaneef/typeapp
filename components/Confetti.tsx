'use client';

import { useMemo } from 'react';

const COLORS = ['#6366f1', '#f5b301', '#ec4899', '#10b981', '#3b82f6', '#f97316'];

/** CSS-only confetti burst; pieces fade out after a few seconds. */
export default function Confetti({ pieces = 70 }: { pieces?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.8,
        duration: 2.6 + Math.random() * 2.2,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        round: i % 3 === 0,
      })),
    [pieces],
  );
  return (
    <div className="confetti" aria-hidden>
      {items.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: p.round ? '50%' : undefined,
            height: p.round ? 8 : undefined,
          }}
        />
      ))}
    </div>
  );
}
