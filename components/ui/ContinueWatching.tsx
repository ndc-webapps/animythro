// components/ui/ContinueWatching.tsx
'use client';

import { useApp } from '../providers/AppProvider';
import { useMemo } from 'react';
import { AnimeSeries } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Clock } from 'lucide-react';
import ScrollRow from './ScrollRow';

export default function ContinueWatching() {
  const { catalog, catalogLoading: loading, continueWatching } = useApp();
  const seriesMap = useMemo(() => {
    const map = new Map<string, AnimeSeries>();
    catalog.forEach((series) => map.set(series.id, series));
    return map;
  }, [catalog]);

  const active = continueWatching
    .filter((item) => !item.completed)
    .slice(0, 10);

  if (active.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Clock className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-bold">Continue Watching</h2>
      </div>
      <ScrollRow>
        {active.map((item) => {
          const anime = seriesMap.get(item.animeId);
          if (!anime && !loading) return null;

          return (
            <Link
              key={`${item.animeId}-${item.episodeNumber}`}
              href={`/anime/${item.animeId}`}
              className="flex-shrink-0 w-52 sm:w-64 glass-card overflow-hidden hover:border-purple-500/40 transition-all duration-300 group"
            >
              <div className="relative aspect-video bg-[#0f0f23]">
                {anime ? (
                  <Image
                    src={item.thumbnail || anime.thumbnail}
                    alt={anime.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="256px"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-banner.svg';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 shimmer-bg" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-3 bg-purple-600/90 rounded-full">
                    <Play className="w-5 h-5 fill-white text-white" />
                  </div>
                </div>
                {/* Progress bar */}
                {item.progress > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: `${Math.min(100, item.progress)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold line-clamp-1 text-white">
                  {anime?.title ?? '...'}
                </p>
                <p className="text-xs text-purple-400 mt-0.5">
                  Episode {item.episodeNumber}
                  {item.progress > 0 && ` · ${item.progress}%`}
                </p>
              </div>
            </Link>
          );
        })}
      </ScrollRow>
    </section>
  );
}
