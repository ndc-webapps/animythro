// app/anime/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Episode } from '@/types';
import Image from 'next/image';
import { Play, Heart, Clock, Calendar, Globe, AlertCircle, ExternalLink, RotateCcw, Star, CheckCircle } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';
import EpisodeList from '@/components/ui/EpisodeList';
import WatchModal from '@/components/ui/WatchModal';
import Link from 'next/link';

function SkeletonDetail() {
  return (
    <div>
      <div className="h-[50vh] min-h-[360px] skeleton" />
      <div className="container mx-auto px-4 py-8 space-y-4">
        <div className="h-8 skeleton rounded w-1/2" />
        <div className="h-4 skeleton rounded w-full" />
        <div className="h-4 skeleton rounded w-3/4" />
      </div>
    </div>
  );
}

export default function AnimeDetailPage() {
  const { id } = useParams();
  const animeId = Array.isArray(id) ? id[0] : id;
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const {
    catalog,
    catalogLoading: loading,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    getLastWatchedEpisode,
  } = useApp();
  const anime = useMemo(
    () => catalog.find((series) => series.id === animeId) ?? null,
    [catalog, animeId]
  );

  if (loading) return <SkeletonDetail />;

  if (!anime) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Anime not found</h2>
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const isWatched = isInWatchlist(anime.id);
  const firstEpisode = anime.episodes[0] ?? null;
  const lastWatched = getLastWatchedEpisode(anime.id);
  const resumeEpisode = lastWatched && !lastWatched.completed
    ? anime.episodes.find((e) => e.episodeNumber === lastWatched.episodeNumber) ?? null
    : null;
  const isEmbeddable = anime.sourceType === 'official_embed' && anime.episodes.length > 0;

  const handleWatch = (episode: Episode) => {
    setSelectedEpisode(episode);
    setModalOpen(true);
  };

  const typeLabel =
    anime.type === 'movie'
      ? 'Movie'
      : anime.type === 'ova'
      ? 'OVA'
      : anime.type === 'special'
      ? 'Special'
      : 'Series';

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[55vh] min-h-[420px] max-h-[640px]">
        <div className="absolute inset-0">
          <Image
            src={anime.banner}
            alt={anime.title}
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-banner.svg'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060610] via-[#060610]/65 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#060610] via-[#060610]/35 to-transparent" />
        </div>

        <div className="relative h-full container mx-auto px-4 flex items-end pb-8">
          <div className="flex flex-col sm:flex-row gap-5 w-full">
            {/* Poster — hidden on mobile (banner shows the art); 2:3 portrait on tablet/desktop */}
            <div className="hidden sm:block w-40 md:w-44 flex-shrink-0 self-end rounded-xl overflow-hidden shadow-2xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={anime.thumbnail}
                alt={anime.title}
                className="w-full object-cover object-top block"
                style={{ aspectRatio: '2/3', display: 'block' }}
                onError={(e) => { e.currentTarget.src = '/placeholder-poster.svg'; }}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {isEmbeddable ? (
                  <span className="badge-official">Official Embed</span>
                ) : (
                  <span className="badge-info">Info Only</span>
                )}
                <span className="badge-source">{typeLabel}</span>
                {anime.status === 'ongoing' && (
                  <span className="px-2 py-0.5 text-xs rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Ongoing
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3 text-white leading-tight">
                {anime.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap gap-4 mb-3 text-sm text-gray-300">
                {anime.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {anime.year}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-gray-500" />
                  {anime.type === 'series'
                    ? `${anime.totalEpisodes} Episodes`
                    : anime.type === 'movie'
                    ? 'Movie'
                    : `${anime.totalEpisodes} ${typeLabel}`}
                </div>
                <div className="flex items-center gap-1">
                  <Globe className="w-4 h-4 text-gray-500" />
                  {anime.language}
                </div>
                {anime.studio && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-gray-500" />
                    {anime.studio}
                  </div>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-5">
                {anime.genres.map((g) => (
                  <span key={g} className="px-2.5 py-1 bg-white/10 rounded-full text-xs text-gray-300">
                    {g}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="text-gray-300 text-sm mb-5 max-w-2xl line-clamp-3">{anime.description}</p>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                {isEmbeddable && (
                  <>
                    {resumeEpisode ? (
                      <button
                        onClick={() => handleWatch(resumeEpisode)}
                        className="btn-primary neon-glow-pink"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Continue Ep {resumeEpisode.episodeNumber}
                        {lastWatched?.progress ? ` (${lastWatched.progress}%)` : ''}
                      </button>
                    ) : firstEpisode ? (
                      <button
                        onClick={() => handleWatch(firstEpisode)}
                        className="btn-primary neon-glow-pink"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Start Watching
                      </button>
                    ) : null}

                    {resumeEpisode && firstEpisode && (
                      <button
                        onClick={() => handleWatch(firstEpisode)}
                        className="btn-secondary"
                      >
                        <Play className="w-4 h-4" />
                        Start from Ep 1
                      </button>
                    )}
                  </>
                )}

                {anime.externalWatchUrl && (
                  <a
                    href={anime.externalWatchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Watch Legally
                  </a>
                )}

                <button
                  onClick={() => isWatched ? removeFromWatchlist(anime.id) : addToWatchlist(anime.id)}
                  className="btn-secondary"
                >
                  <Heart className={`w-4 h-4 ${isWatched ? 'fill-pink-400 text-pink-400' : ''}`} />
                  {isWatched ? 'In Watchlist' : 'Add to Watchlist'}
                </button>
              </div>

              {/* Last watched indicator */}
              {lastWatched && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  {lastWatched.completed ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Watched up to Episode {lastWatched.episodeNumber}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>
                        Last watched: Episode {lastWatched.episodeNumber} ({lastWatched.progress}%)
                        · {new Date(lastWatched.timestamp).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Episodes / Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold mb-4">
            {anime.type === 'movie' ? 'Movie' : anime.type === 'playlist' ? 'Videos' : 'Episodes'}
          </h2>
          <EpisodeList anime={anime} onWatch={handleWatch} />
        </div>

        {/* Legal info */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-2 text-sm text-gray-300">Legal Information</h3>
          <p className="text-sm text-gray-500">{anime.licenseNote}</p>
          {anime.regionNote && (
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {anime.regionNote}
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-600">
            AniMythRo embeds content from official sources only. All rights reserved by respective copyright holders.
          </div>
        </div>
      </div>

      {/* Watch Modal */}
      {modalOpen && selectedEpisode && (
        <WatchModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          anime={anime}
          initialEpisode={selectedEpisode}
          onEpisodeChange={(ep) => setSelectedEpisode(ep)}
        />
      )}
    </div>
  );
}
