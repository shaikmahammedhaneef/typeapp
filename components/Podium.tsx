import Avatar from './Avatar';
import Confetti from './Confetti';

export interface PodiumEntry {
  username: string;
  wpm: number;
  accuracy: number | null;
}

const PLACES = [
  { rank: 2, cls: 'p2', medal: '🥈' },
  { rank: 1, cls: 'p1', medal: '🥇' },
  { rank: 3, cls: 'p3', medal: '🥉' },
];

/** Winners podium laid out 2 · 1 · 3, with 1st place tallest in the middle. */
export default function Podium({
  top,
  title = 'Winners',
  subtitle,
  highlight,
}: {
  top: PodiumEntry[];
  title?: string;
  subtitle?: string;
  highlight?: string;
}) {
  return (
    <div className="card podium-wrap">
      {top.length > 0 && <Confetti />}
      <h2 className="podium-title">🏆 {title}</h2>
      {subtitle && <p className="muted" style={{ margin: '6px 0 0' }}>{subtitle}</p>}
      <div className="podium">
        {PLACES.map(({ rank, cls, medal }) => {
          const p = top[rank - 1];
          if (!p) {
            return (
              <div key={rank} className={`place ${cls} empty`}>
                <div className="pname muted">—</div>
                <div className="pwpm">&nbsp;</div>
                <div className="block">
                  <span className="num">{rank}</span>
                </div>
              </div>
            );
          }
          const isMe = highlight === p.username;
          return (
            <div key={rank} className={`place ${cls}`}>
              {rank === 1 ? <div className="crown">👑</div> : <div style={{ height: 28 }} />}
              <Avatar name={p.username} size={rank === 1 ? 76 : 60} />
              <div className="pname" title={p.username}>
                {p.username}
              </div>
              {isMe && <span className="badge open" style={{ marginTop: 4 }}>you</span>}
              <div className="pwpm">
                <strong>{p.wpm}</strong> WPM{p.accuracy !== null && ` · ${p.accuracy}%`}
              </div>
              <div className="block">
                <span className="num">{rank}</span>
                <span className="medal">{medal}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="podium-floor" />
    </div>
  );
}
