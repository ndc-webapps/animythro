// components/ui/HeroCarousel.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimeSeries } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Info, ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroCarouselProps {
  series: AnimeSeries[];
}

// Deterministic daily seed — same rotation for all visitors on the same day
function getDailySeed(): number {
  const today = new Date();
  const str = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getFeatured(series: AnimeSeries[]): AnimeSeries[] {
  // Strong hero candidates: real series with several episodes, ranked by trending.
  // Limiting to a top pool keeps the daily rotation showcasing quality titles
  // instead of one-off event playlists buried deep in the catalog.
  const pool = series
    .filter(
      (s) =>
        s.type === 'series' &&
        s.sourceType === 'official_embed' &&
        s.episodes.length >= 4
    )
    .sort((a, b) => (b.trending ?? 0) - (a.trending ?? 0))
    .slice(0, 25);

  if (pool.length === 0) return [];

  const seed = getDailySeed();
  const startIndex = seed % pool.length;

  // Rotate within the top pool, pick up to 6 for the day
  const rotated: AnimeSeries[] = [];
  for (let i = 0; i < Math.min(6, pool.length); i++) {
    rotated.push(pool[(startIndex + i) % pool.length]);
  }
  return rotated;
}

export default function HeroCarousel({ series }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const featured = getFeatured(series);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning || featured.length === 0) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(index);
        setIsTransitioning(false);
      }, 300);
    },
    [isTransitioning, featured.length]
  );

  const next = useCallback(() => {
    goTo((currentIndex + 1) % featured.length);
  }, [currentIndex, featured.length, goTo]);

  const prev = useCallback(() => {
    goTo((currentIndex - 1 + featured.length) % featured.length);
  }, [currentIndex, featured.length, goTo]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, [next, featured.length]);

  if (featured.length === 0) return null;

  const current = featured[currentIndex];

  return (
    <div className="relative h-[75vh] min-h-[540px] max-h-[800px] w-full overflow-hidden bg-[#060610]">
      {/* Background image */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <Image
          src={current.banner}
          alt={current.title}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-banner.svg';
          }}
        />
        {/* Cinematic overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060610] via-[#060610]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060610] via-[#060610]/30 to-transparent" />
        <div className="absolute inset-0 bg-[#060610]/20" />
      </div>

      {/* Content */}
      <div
        className={`relative h-full flex items-end container mx-auto px-4 pb-16 md:pb-20 transition-all duration-500 ${
          isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="max-w-2xl">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge-official">Official Embed</span>
            <span className="badge-source">{current.sourceName.split(' ').slice(0, 2).join(' ')}</span>
            {current.year && (
              <span className="px-2 py-0.5 text-xs rounded-md bg-white/10 text-gray-300">{current.year}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 leading-tight text-white">
            {current.title}
          </h1>

          {/* Genres */}
          <div className="flex flex-wrap gap-2 mb-4">
            {current.genres.slice(0, 4).map((g) => (
              <span key={g} className="px-2.5 py-1 bg-white/10 rounded-full text-xs text-gray-300">
                {g}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-gray-300 text-sm md:text-base mb-6 line-clamp-3 max-w-xl">
            {current.description}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/anime/${current.id}`}
              className="btn-primary text-sm md:text-base neon-glow-pink"
            >
              <Play className="w-5 h-5 fill-white" />
              Watch Now
            </Link>
            <Link
              href={`/anime/${current.id}`}
              className="btn-secondary text-sm md:text-base"
            >
              <Info className="w-5 h-5" />
              Details
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {featured.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors hidden sm:flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-colors hidden sm:flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {featured.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 items-center">
          {featured.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? 'w-6 h-2 bg-purple-400'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
