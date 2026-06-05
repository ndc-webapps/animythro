# AniMythRo — Legal Anime Streaming Platform

Live: **https://animythro.vercel.app**
Repo: **https://github.com/ndc-webapps/animythro**

---

AniMythRo is a premium anime discovery and streaming platform that embeds full episodes
exclusively from official, licensed YouTube channels. No piracy, no self-hosted video.

## Features

- **Legal only** — embeds from official rights-holder channels (Muse, Ani-One, Crunchyroll, VIZ, Toei, KADOKAWA, and more)
- **755+ titles** — auto-discovered and deduped from 17 approved channels
- **Members-only purge** — pipeline strips paywalled/private videos automatically
- **Theater player** — episode navigation, continue watching, progress tracking
- **Browse + filters** — genre, type, year, sort
- **Watchlist** — localStorage, no account needed
- **DMCA page** — `/dmca` with takedown contact
- **Region notes** — in-player warning for geo-restricted content
- **Admin panel** — protected, server-side auth, hidden route
- **Weekly catalog sync** — GitHub Action opens a PR every Monday with new anime
- **Responsive** — mobile, tablet, desktop

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS |
| Database | Upstash Redis (optional — works without it) |
| Video | YouTube iframe embed (official channels only) |
| Deployment | Vercel |
| Catalog pipeline | Node.js + yt-dlp scripts |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | **Yes** | Admin panel password (server-side only) |
| `UPSTASH_REDIS_REST_URL` | No | Redis URL — app works without it (uses bundled catalog) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Redis token |
| `YOUTUBE_API_KEY` | No | YouTube Data API key (for live sync) |
| `CRON_SECRET` | No | Bearer token for `/api/cron` (GitHub Action + Vercel Cron) |

> **Deploy without Redis** — the 755-title catalog is bundled in `lib/expanded-catalog.json`.
> Set only `ADMIN_PASSWORD` and deploy. Everything works out of the box.

## Local Setup

```bash
git clone https://github.com/ndc-webapps/animythro.git
cd animythro
npm install
cp .env.example .env.local   # fill in at least ADMIN_PASSWORD
npm run dev
```

## Catalog Pipeline

Scripts in `scripts/`:

| Script | What it does |
|---|---|
| `discover-new-anime.mjs` | Pulls new playlists from approved channels, dedupes, appends to catalog |
| `purge-members-only.mjs` | Re-checks every playlist, removes paywalled/private/dead videos |

Approved channels are in `lib/channel-sources.ts`. Never add fan/repost channels.

Run manually:
```bash
node scripts/discover-new-anime.mjs
node scripts/purge-members-only.mjs
```

## GitHub Action — Weekly Catalog Sync

`.github/workflows/catalog-sync.yml` runs every Monday 06:00 UTC (or manually from Actions tab).
It discovers new anime, purges dead videos, and opens a Pull Request.
You review the diff and click Merge — nothing auto-pushes to `main`.

Enable in repo: **Settings → Actions → General → Allow GitHub Actions to create pull requests**.

## Security

- Admin panel is at a non-guessable route (not `/admin` — that returns 404)
- Password is checked server-side via `ADMIN_PASSWORD` env var — never in the JS bundle
- All admin API routes are protected by middleware (httpOnly session cookie)
- Cron route additionally accepts `Bearer <CRON_SECRET>` for automated calls

## Legal

AniMythRo hosts no video files. All content is embedded from official YouTube channels of
the licensed rights holders. Availability is controlled by those rights holders and may be
geo-restricted. See `/dmca` for the takedown policy.

© 2026 AniMythRo. All anime titles and trademarks belong to their respective owners.
