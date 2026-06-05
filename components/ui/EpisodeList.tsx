// components/ui/EpisodeList.tsx
'use client';

import { AnimeSeries, Episode } from '@/types';
import { Play, Calendar, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../providers/AppProvider';

interface EpisodeListProps {
  anime: AnimeSeries;
  onWatch: (episode: Episode) => void;
}

export default function EpisodeList({ anime, onWatch }: EpisodeListProps) {
  const { getEpisodeProgress } = useApp();
  const itemLabel = anime.type === 'movie' ? 'Movie' : anime.type === 'playlist' ? 'Video' : 'Episode';

  if (anime.episodes.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No embeddable episodes available</p>
        <p className="text-gray-600 text-sm mt-1">
          This anime is listed for discovery. Use the legal watch links above to view it on its official platform.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {anime.episodes.map((episode) => {
        const progress = getEpisodeProgress(anime.id, episode.episodeNumber);
        const completed = progress?.completed ?? false;
        const progressPct = progress?.progress ?? 0;
        const hasProgress = progressPct > 0 && !completed;

        return (
          <div
            key={episode.episodeNumber}
            className="relative flex items-center justify-between p-4 glass-card hover:bg-white/8 transition-colors cursor-pointer group overflow-hidden"
            onClick={() => onWatch(episode)}
          >
            {/* Progress bar background */}
            {hasProgress && (
              <div
                className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            )}

            <div className="flex items-center gap-4 min-w-0">
              {/* Episode number badge */}
              <div
                className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${
                  completed
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : hasProgress
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-white/5 text-gray-300 group-hover:bg-purple-500/20 group-hover:text-purple-400'
                }`}
              >
                {completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  episode.episodeNumber
                )}
              </div>

              {/* Title & meta */}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-white line-clamp-1">{episode.title}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {episode.uploadDate && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(episode.uploadDate).toLocaleDateString()}
                    </span>
                  )}
                  {episode.isNew && (
                    <span className="px-1.5 py-0.5 bg-pink-600 text-white text-[10px] font-bold rounded animate-pulse">
                      NEW
                    </span>
                  )}
                  {completed && (
                    <span className="text-xs text-emerald-500">Watched</span>
                  )}
                  {hasProgress && (
                    <span className="text-xs text-purple-400">{Math.round(progressPct)}% watched</span>
                  )}
                </div>
              </div>
            </div>

            {/* Play button */}
            <button
              className="flex-shrink-0 p-2.5 bg-purple-600/80 hover:bg-purple-600 rounded-full transition-colors"
              aria-label={`Play ${itemLabel} ${episode.episodeNumber}`}
            >
              <Play className="w-4 h-4 fill-white text-white" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
