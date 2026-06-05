// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import HeroCarousel from '@/components/ui/HeroCarousel';
import AnimeCard from '@/components/ui/AnimeCard';
import ContinueWatching from '@/components/ui/ContinueWatching';
import ScrollRow from '@/components/ui/ScrollRow';
import { AnimeSeries } from '@/types';
import { Flame, Clock, Sparkles, Film, Tv, Shuffle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/components/providers/AppProvider';

function SkeletonRow() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 sm:w-48">
          <div className="aspect-[2/3] skeleton rounded-xl mb-2" />
          <div className="h-3 skeleton rounded w-3/4 mb-1" />
          <div className="h-2 skeleton rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  href,
  color,
}: {
  icon: React.ElementType;
  title: string;
  href?: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="text-sm text-gray-400 hover:text-purple-400 transition-colors">
          View All →
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const [allSeries, setAllSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { watchHistory } = useApp();

  useEffect(() => {
    fetch('/api/anime')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to fetch anime');
        if (!Array.isArray(data)) throw new Error('Unexpected response');
        setAllSeries(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md glass-card p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">Unable to load</h1>
          <p className="text-gray-400 mb-6 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary w-full justify-center"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const embeddable = allSeries.filter(
    (s) => s.sourceType === 'official_embed' && s.episodes.length > 0 && s.type !== 'trailer'
  );
  const series = embeddable.filter((s) => s.type === 'series');
  const movies = embeddable.filter((s) => s.type === 'movie');

  const trending = [...series]
    .sort((a, b) => (b.trending ?? 0) - (a.trending ?? 0))
    .slice(0, 10);

  // New Legal Uploads = most recently added to the platform.
  // Use episode uploadDate when present, else catalog position (newer pulls sit later).
  const recentUploads = (() => {
    const idx = new Map(embeddable.map((s, i) => [s.id, i]));
    const lastUpload = (s: typeof series[number]) =>
      s.episodes?.reduce((m, e) => ((e.uploadDate ?? '') > m ? (e.uploadDate ?? '') : m), '') ?? '';
    const hasDates = embeddable.some((s) => lastUpload(s));
    return [...embeddable]
      .sort((a, b) => {
        if (hasDates) return lastUpload(b).localeCompare(lastUpload(a));
        return (idx.get(b.id) ?? 0) - (idx.get(a.id) ?? 0);
      })
      .slice(0, 12);
  })();

  const recentlyAdded = [...embeddable]
    .sort((a, b) => (b.episodes.length) - (a.episodes.length))
    .slice(10, 20);

  const getRecommendations = () => {
    if (watchHistory.length === 0) return series.slice(0, 10);
    const lastAnime = allSeries.find((s) => s.id === watchHistory[0].animeId);
    if (!lastAnime) return series.slice(0, 10);
    return allSeries
      .filter(
        (s) =>
          s.sourceType === 'official_embed' &&
          s.id !== lastAnime.id &&
          s.genres.some((g) => lastAnime.genres.includes(g))
      )
      .slice(0, 10);
  };

  const surpriseMe = () => {
    if (series.length === 0) return;
    const r = series[Math.floor(Math.random() * series.length)];
    window.location.href = `/anime/${r.id}`;
  };

  return (
    <div>
      {loading ? (
        <div className="h-[75vh] min-h-[540px] shimmer-bg" />
      ) : (
        <HeroCarousel series={allSeries} />
      )}

      <div className="container mx-auto px-4 py-10 space-y-14">
        <ContinueWatching />

        {/* Trending */}
        <section>
          <SectionHeader icon={Flame} title="Trending Now" href="/browse?view=trending" color="text-orange-400" />
          {loading ? <SkeletonRow /> : (
            <ScrollRow>
              {trending.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} size="medium" />
              ))}
            </ScrollRow>
          )}
        </section>

        {/* New uploads */}
        <section>
          <SectionHeader icon={Clock} title="New Legal Uploads" href="/browse?view=new" color="text-blue-400" />
          {loading ? <SkeletonRow /> : (
            <ScrollRow>
              {recentUploads.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} size="medium" showNewBadge />
              ))}
            </ScrollRow>
          )}
        </section>

        {/* Recommended */}
        <section>
          <SectionHeader icon={Sparkles} title="Recommended For You" href="/browse" color="text-purple-400" />
          {loading ? <SkeletonRow /> : (
            <ScrollRow>
              {getRecommendations().map((anime) => (
                <AnimeCard key={anime.id} anime={anime} size="medium" />
              ))}
            </ScrollRow>
          )}
        </section>

        {/* Series & Movies grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <section>
            <SectionHeader icon={Tv} title="Series" href="/browse?type=series" color="text-emerald-400" />
            {loading ? <SkeletonRow /> : (
              <ScrollRow>
                {series.slice(0, 8).map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} size="small" />
                ))}
              </ScrollRow>
            )}
          </section>

          <section>
            <SectionHeader icon={Film} title="Anime Movies" href="/browse?type=movie" color="text-yellow-400" />
            {loading ? <SkeletonRow /> : (
              <ScrollRow>
                {movies.slice(0, 8).map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} size="small" />
                ))}
              </ScrollRow>
            )}
          </section>
        </div>

        {/* More to watch */}
        {!loading && recentlyAdded.length > 0 && (
          <section>
            <SectionHeader icon={TrendingUp} title="More to Watch" href="/browse" color="text-pink-400" />
            <ScrollRow>
              {recentlyAdded.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} size="medium" />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* Surprise Me */}
        <div className="flex justify-center">
          <button
            onClick={surpriseMe}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 neon-glow"
          >
            <Shuffle className="w-5 h-5" />
            Surprise Me! Random Anime
          </button>
        </div>
      </div>
    </div>
  );
}
