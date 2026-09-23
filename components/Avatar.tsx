const COLORS = [
  ['#818cf8', '#4f46e5'],
  ['#f472b6', '#db2777'],
  ['#34d399', '#059669'],
  ['#fbbf24', '#d97706'],
  ['#60a5fa', '#2563eb'],
  ['#a78bfa', '#7c3aed'],
  ['#fb7185', '#e11d48'],
  ['#2dd4bf', '#0d9488'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const [from, to] = COLORS[hash(name.toLowerCase()) % COLORS.length];
  const initials = name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('') || name[0];
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
