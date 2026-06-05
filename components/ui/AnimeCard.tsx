// components/ui/AnimeCard.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, Play, ExternalLink } from 'lucide-react';
import { AnimeSeries } from '@/types';
import { useApp } from '../providers/AppProvider';

interface AnimeCardProps {
  anime: AnimeSeries;
  size?: 'small' | 'medium' | 'large';
  showNewBadge?: boolean;
}

const SIZE = {
  small: 'w-36 sm:w-40',
  medium: 'w-40 sm:w-48',
  large: 'w-48 sm:w-60',
};

export default function AnimeCard({ anime, size = 'medium', showNewBadge }: AnimeCardProps) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, getLastWatchedEpisode } = useApp();
  const isWatched = isInWatchlist(anime.id);
  const isEmbeddable = anime.sourceType === 'official_embed' && anime.episodes.length > 0;
  const lastWatched = getLastWatchedEpisode(anime.id);

  const contentLabel =
    anime.type === 'movie' || anime.type === 'ova' || anime.type === 'special'
      ? anime.type.toUpperCase()
      : `${anime.totalEpisodes} EPS`;

  return (
    <div className={`${SIZE[size]} flex-shrink-0 group`}>
      <div className="relative rounded-xl overflow-hidden bg-white/5 border border-white/10 transition-all duration-300 group-hover:border-purple-500/40 group-hover:shadow-lg group-hover:shadow-purple-500/10">
        <Link href={`/anime/${anime.id}`}>
          <div className="relative aspect-[2/3] overflow-hidden bg-[#0f0f23]">
            <Image
              src={anime.thumbnail || '/placeholder-poster.svg'}
              alt={anime.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes={size === 'large' ? '240px' : size === 'medium' ? '192px' : '160px'}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-poster.svg';
              }}
              unoptimized={anime.thumbnail?.startsWith('http') && !anime.thumbnail.includes('ytimg') && !anime.thumbnail.includes('anili.st')}
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Info-only badge */}
            {!isEmbeddable && (
              <div className="absolute top-2 left-2">
                <span className="badge-info text-[10px] px-1.5 py-0.5">Info Only</span>
              </div>
            )}

            {/* NEW badge */}
            {showNewBadge && isEmbeddable && (
              <div className="absolute top-2 right-2">
                <span className="px-1.5 py-0.5 bg-pink-600 text-white text-[10px] font-bold rounded-md animate-pulse">
                  NEW
                </span>
              </div>
            )}

            {/* Continue watching indicator */}
            {lastWatched && !lastWatched.completed && (
              <div className="absolute bottom-0 left-0 right-0">
                <div
                  className="h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${Math.min(100, lastWatched.progress)}%` }}
                />
              </div>
            )}

            {/* Bottom overlay info on hover */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-[10px] text-white bg-black/60 px-2 py-0.5 rounded-full">
                {contentLabel}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  isWatched ? removeFromWatchlist(anime.id) : addToWatchlist(anime.id);
                }}
                className="p-1.5 bg-black/60 rounded-full hover:bg-purple-600 transition-colors"
                aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${isWatched ? 'fill-pink-400 text-pink-400' : 'text-white'}`}
                />
              </button>
            </div>

            {/* Play icon on hover for embeddable */}
            {isEmbeddable && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="p-3 bg-purple-600/80 rounded-full backdrop-blur-sm">
                  <Play className="w-5 h-5 fill-white text-white" />
                </div>
              </div>
            )}

            {/* External link icon for info-only */}
            {!isEmbeddable && anime.externalWatchUrl && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="p-3 bg-amber-600/80 rounded-full backdrop-blur-sm">
                  <ExternalLink className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </div>
        </Link>

        {/* Card footer */}
        <div className="px-3 py-2.5">
          <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 text-white">{anime.title}</h3>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] sm:text-xs text-gray-500">{anime.year ?? anime.type}</span>
            {isEmbeddable ? (
              <span className="text-[10px] text-emerald-400 font-medium">● Watch</span>
            ) : (
              <span className="text-[10px] text-amber-400 font-medium">● Info</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
