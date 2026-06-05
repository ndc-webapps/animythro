# README.md

# AnimeFlow - Legal Anime Streaming Platform

AnimeFlow is a premium anime discovery and streaming platform that only uses legal, embeddable content from official sources like GundamInfo, Muse Asia, and other official YouTube channels.

## Features

- ✅ **Legal Only** - Only embeds from official sources with proper attribution
- 🔄 **Auto-Sync** - Automatically detects new episodes from official YouTube playlists
- 🎬 **Theater Mode** - Beautiful video player with episode navigation
- 📱 **Responsive** - Works on mobile, tablet, and desktop
- 🎯 **Smart Recommendations** - Based on watch history and genres
- 💾 **Watchlist & Continue Watching** - Powered by localStorage
- 🔍 **Advanced Search** - Search by title, genre, year, and more
- 🛡️ **Admin Dashboard** - Review and approve new episodes before publishing

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Database**: Upstash Redis
- **API**: YouTube Data API v3
- **Deployment**: Vercel (recommended)

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- Upstash Redis account (free tier)
- YouTube Data API key

### 2. Installation

```bash
git clone <repository>
cd animeflow
npm install