// components/ui/WatchModal.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, ExternalLink, Globe } from 'lucide-react';
import { Episode, AnimeSeries } from '@/types';
import { useApp } from '../providers/AppProvider';

interface WatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  anime: AnimeSeries;
  initialEpisode: Episode;
  onEpisodeChange: (episode: Episode) => void;
}

const EPISODE_DURATION_ESTIMATE = 1440; // 24 minutes in seconds

export default function WatchModal({
  isOpen,
  onClose,
  anime,
  initialEpisode,
  onEpisodeChange,
}: WatchModalProps) {
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const openedAtRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { updateContinueWatching, getEpisodeProgress } = useApp();

  const currentIndex = anime.episodes.findIndex(
    (e) => e.episodeNumber === currentEpisode.episodeNumber
  );
  const prevEpisode = currentIndex > 0 ? anime.episodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex < anime.episodes.length - 1 ? anime.episodes[currentIndex + 1] : null;
  const itemLabel = anime.type === 'movie' ? 'Movie' : anime.type === 'playlist' ? 'Video' : 'Episode';

  const saveProgress = useCallback(
    (secondsElapsed: number) => {
      const pct = Math.min(100, (secondsElapsed / EPISODE_DURATION_ESTIMATE) * 100);
      const completed = pct >= 85;
      updateContinueWatching({
        animeId: anime.id,
        episodeNumber: currentEpisode.episodeNumber,
        timestamp: Date.now(),
        progress: Math.round(pct),
        secondsWatched: secondsElapsed,
        completed,
        title: `${anime.title} · ${itemLabel} ${currentEpisode.episodeNumber}`,
        thumbnail: anime.thumbnail,
      });

      // If nearly done, suggest next episode
      if (pct >= 80 && nextEpisode && !completed) {
        setShowNextPrompt(true);
      }
    },
    [anime, currentEpisode, itemLabel, nextEpisode, updateContinueWatching]
  );

  useEffect(() => {
    setCurrentEpisode(initialEpisode);
  }, [initialEpisode]);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    openedAtRef.current = Date.now();
    setShowNextPrompt(false);

    // Log start immediately
    const existing = getEpisodeProgress(anime.id, currentEpisode.episodeNumber);
    const startSeconds = existing?.secondsWatched ?? 0;

    updateContinueWatching({
      animeId: anime.id,
      episodeNumber: currentEpisode.episodeNumber,
      timestamp: Date.now(),
      progress: existing?.progress ?? 0,
      secondsWatched: startSeconds,
      completed: existing?.completed ?? false,
      title: `${anime.title} · ${itemLabel} ${currentEpisode.episodeNumber}`,
      thumbnail: anime.thumbnail,
    });

    // Track progress every 30 seconds
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - openedAtRef.current) / 1000);
      const totalElapsed = startSeconds + elapsed;
      saveProgress(totalElapsed);
    }, 30000);

    return () => {
      document.body.style.overflow = 'unset';
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      // Save final progress on close
      const elapsed = Math.floor((Date.now() - openedAtRef.current) / 1000);
      const totalElapsed = startSeconds + elapsed;
      if (elapsed > 5) saveProgress(totalElapsed);
    };
  }, [isOpen, currentEpisode.episodeNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleEpisodeSwitch = (ep: Episode) => {
    setCurrentEpisode(ep);
    onEpisodeChange(ep);
    setShowNextPrompt(false);
    openedAtRef.current = Date.now();
  };

  const handlePrev = () => { if (prevEpisode) handleEpisodeSwitch(prevEpisode); };
  const handleNext = () => { if (nextEpisode) handleEpisodeSwitch(nextEpisode); };

  const handleClose = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{anime.title}</p>
          <p className="text-xs text-gray-400 truncate">
            {itemLabel} {currentEpisode.episodeNumber}
            {currentEpisode.title !== `Episode ${currentEpisode.episodeNumber}` &&
              ` — ${currentEpisode.title}`}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className="badge-official hidden sm:inline-flex">Official</span>
          <button
            onClick={handleClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close player"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Player */}
      <div className="flex-1 flex items-center justify-center bg-black relative">
        <div className="w-full h-full max-w-6xl mx-auto relative">
          <div className="relative w-full h-full">
            <iframe
              key={currentEpisode.sourceVideoId}
              src={currentEpisode.embedUrl}
              title={`${anime.title} - ${itemLabel} ${currentEpisode.episodeNumber}`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
              allowFullScreen
            />
          </div>
        </div>

        {/* Next episode prompt overlay */}
        {showNextPrompt && nextEpisode && (
          <div className="absolute bottom-4 right-4 glass-card p-4 max-w-xs animate-fade-in-up">
            <p className="text-sm font-semibold mb-1">Up Next</p>
            <p className="text-xs text-gray-400 mb-3">
              {itemLabel} {nextEpisode.episodeNumber}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleNext}
                className="btn-primary text-xs py-2 px-3 flex-1"
              >
                Play Next
              </button>
              <button
                onClick={() => setShowNextPrompt(false)}
                className="btn-secondary text-xs py-2 px-3"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/80 border-t border-white/10 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {/* Fallback for region/age-locked videos — opens the official source on YouTube */}
            <a
              href={`https://www.youtube.com/watch?v=${currentEpisode.sourceVideoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              title="If the video is region-locked or won't play, open it on YouTube"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Won&apos;t play? Watch on YouTube</span>
              <span className="sm:hidden">YouTube</span>
            </a>
            {anime.regionNote && (
              <span
                className="hidden md:flex items-center gap-1.5 text-xs text-amber-400/80 border-l border-white/10 pl-3"
                title={anime.regionNote}
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate max-w-[22rem]">{anime.regionNote}</span>
                <span className="border-l border-white/10 pl-3 text-gray-600 hidden lg:inline">
                  Region-locked? A VPN may help — at your own discretion.
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={!prevEpisode}
              className="btn-secondary text-xs py-2 px-3 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <span className="text-sm text-gray-400 px-2 font-mono">
              {currentIndex + 1}/{anime.episodes.length}
            </span>

            <button
              onClick={handleNext}
              disabled={!nextEpisode}
              className="btn-primary text-xs py-2 px-3 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-500 hidden sm:flex">
            <Maximize2 className="w-3 h-3" />
            <span>Full screen in player</span>
          </div>
        </div>
      </div>
    </div>
  );
}
