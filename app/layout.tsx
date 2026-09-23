import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'TypeRace Arena',
  description: 'Multiplayer typing competitions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Type<span>Race</span> Arena
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
