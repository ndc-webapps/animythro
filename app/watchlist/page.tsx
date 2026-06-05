// app/watchlist/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { AnimeSeries } from '@/types';
import AnimeCard from '@/components/ui/AnimeCard';
import { useApp } from '@/components/providers/AppProvider';
import { Heart, Clock, Compass } from 'lucide-react';
import Link from 'next/link';

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] skeleton rounded-xl mb-2" />
          <div className="h-3 skeleton rounded w-3/4 mb-1" />
          <div className="h-2 skeleton rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function WatchlistPage() {
  const { watchlist, continueWatching } = useApp();
  const [allSeries, setAllSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/anime')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to fetch');
        if (!Array.isArray(data)) throw new Error('Unexpected response');
        setAllSeries(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const saved = useMemo(
    () => allSeries.filter((s) => watchlist.includes(s.id)),
    [allSeries, watchlist]
  );

  const inProgress = useMemo(() => {
    const seen = new Set<string>();
    return continueWatching
      .filter((c) => !c.completed)
      .filter((c) => {
        if (seen.has(c.animeId)) return false;
        seen.add(c.animeId);
        return true;
      })
      .map((c) => ({ entry: c, anime: allSeries.find((s) => s.id === c.animeId) }))
      .filter((x) => x.anime) as { entry: typeof continueWatching[number]; anime: AnimeSeries }[];
  }, [continueWatching, allSeries]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-md glass-card p-8 text-center">
          <h1 className="text-xl font-bold mb-3">Unable to load</h1>
          <p className="text-gray-400 mb-4 text-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full justify-center">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gradient flex items-center gap-2">
          <Heart className="w-7 h-7 fill-pink-500 text-pink-500" />
          My Watchlist
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {loading ? 'Loading...' : `${saved.length} saved title${saved.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Continue Watching (in-progress) */}
      {!loading && inProgress.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold">Jump Back In</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {inProgress.map(({ entry, anime }) => (
              <Link
                key={`${entry.animeId}-${entry.episodeNumber}`}
                href={`/anime/${anime.id}`}
                className="group"
              >
                <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-purple-500/40 transition-all">
                  <div className="relative aspect-video bg-[#0f0f23]">
                    <img
                      src={entry.thumbnail || anime.thumbnail}
                      alt={anime.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-banner.svg'; }}
                    />
                    {entry.progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${Math.min(100, entry.progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold line-clamp-1">{anime.title}</p>
                    <p className="text-[10px] text-purple-400 mt-0.5">
                      Ep {entry.episodeNumber}{entry.progress > 0 ? ` · ${entry.progress}%` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Saved watchlist */}
      {loading ? (
        <SkeletonGrid />
      ) : saved.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
            <Heart className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-300">Your watchlist is empty</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Tap the heart icon on any anime to save it here for later.
          </p>
          <Link href="/browse" className="btn-primary mt-6 mx-auto w-fit">
            <Compass className="w-4 h-4" />
            Browse Anime
          </Link>
        </div>
      ) : (
        <>
          {inProgress.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-bold">Saved</h2>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {saved.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} size="small" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
