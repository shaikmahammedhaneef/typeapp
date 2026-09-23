# TypeRace Arena

A desktop web app for multiplayer typing competitions. Built with Next.js (App Router) and Neon Postgres.

## How it works

- **Players** open `/`, pick a username (unique per competition) and wait in the waiting room.
  When the admin starts the competition, every waiting screen switches to the typing screen on
  its own, shows a 5-second countdown, then unlocks typing. The text is submitted automatically
  when the timer runs out, when the player finishes the passage, or when the admin ends the race.
- **Admin** signs in at `/admin` with a password to create competitions, edit the competition
  text and duration, open or start or end a competition, and view its stats page. The stats
  page shows every player's WPM, accuracy, progress and a WPM-over-time sparkline while the race
  runs, and the final leaderboard (with CSV export) once it ends.

### Design notes

- **Polling, no WebSockets.** Waiting screens check the status every 1.5 s. While racing, each
  player sends their typed text every 1.5 s, and the admin stats page polls every 1.5 s.
  This works on serverless hosting such as Vercel.
- **The server keeps time.** Start and end times come from the database clock. Browsers correct
  for their own clock offset, so every player gets the same deadline. Submissions are accepted
  until 5 s after the deadline to allow for network delay.
- **The server scores everything.** WPM (correct chars ÷ 5 ÷ minutes), accuracy and errors are
  recalculated on the server from the typed text. The numbers shown in the browser are only a
  preview. Paste and drop are blocked in the typing box.
- **Nothing is lost.** If a player closes the tab, their last live progress becomes their result
  when the race ends (shown as "Auto (disconnected)").
- **Admin security.** The password is compared in constant time, and login attempts are
  rate-limited. A successful login sets a signed JWT cookie (HttpOnly, SameSite=Strict, 12 h).
  Middleware protects `/admin/*` and `/api/admin/*`, and each admin API route checks the
  session again.

## Setup

1. Set environment variables (see `.env.example`):

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Neon connection string |
   | `ADMIN_PASSWORD` | Password for `/admin` |
   | `SESSION_SECRET` | 16+ char random string for signing admin sessions (`openssl rand -hex 32`) |

2. Install and run:

   ```bash
   npm install
   npm run dev          # http://localhost:3000
   ```

   Tables are created automatically on first request. To create them ahead of time, run
   `npm run db:migrate`.

3. Deploy to Vercel: import the repo and add the three environment variables.

### Local Postgres (optional)

To develop against a plain local Postgres instead of Neon, set `DB_DRIVER=pg` and point
`DATABASE_URL` at it.

## Running a competition

1. `/admin` → **New competition** → enter the title, duration and text.
2. **Open for joining**. Players can now join from `/`.
3. When everyone is in, press **Start competition**. You're taken to the live stats page.
4. The race ends when the timer runs out, or when you press **End now**. Results stay available
   under **Stats** for every competition.
