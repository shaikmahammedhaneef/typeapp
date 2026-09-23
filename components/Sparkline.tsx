export default function Sparkline({
  points,
  width = 140,
  height = 32,
}: {
  points: { t: number; wpm: number }[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <span className="muted">—</span>;
  const maxT = Math.max(...points.map((p) => p.t), 1);
  const maxW = Math.max(...points.map((p) => p.wpm), 10);
  const d = points
    .map((p, i) => {
      const x = (p.t / maxT) * (width - 2) + 1;
      const y = height - 1 - (p.wpm / maxW) * (height - 2);
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-label="WPM over time">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
