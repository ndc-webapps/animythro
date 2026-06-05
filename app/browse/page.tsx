// app/browse/page.tsx
'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimeSeries } from '@/types';
import AnimeCard from '@/components/ui/AnimeCard';
import { useApp } from '@/components/providers/AppProvider';
import { Filter, Search, X, ChevronDown } from 'lucide-react';

const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mecha',
  'Mystery', 'Romance', 'Sci-Fi', 'Seinen', 'Shounen', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller', 'Historical', 'Psychological',
  'School', 'Military',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = ['Any', ...Array.from({ length: 35 }, (_, i) => String(CURRENT_YEAR - i))];

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] skeleton rounded-xl mb-2" />
          <div className="h-3 skeleton rounded w-3/4 mb-1" />
          <div className="h-2 skeleton rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function BrowseContent() {
  const [allSeries, setAllSeries] = useState<AnimeSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { searchQuery, setSearchQuery, selectedGenres, toggleGenre } = useApp();
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'series' | 'movie' | 'ova' | 'special'>('all');
  const [yearFilter, setYearFilter] = useState<string>('Any');
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'year' | 'title' | 'episodes'>('trending');
  const [view, setView] = useState<'all' | 'trending' | 'new'>('all');
  const params = useSearchParams();

  // Apply query params from "View All" links and navbar Enter-search
  useEffect(() => {
    const t = params.get('type');
    if (t === 'series' || t === 'movie' || t === 'ova' || t === 'special') {
      setTypeFilter(t);
      setShowFilters(true);
    }
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
    const v = params.get('view');
    if (v === 'trending') {
      setView('trending');
      setSortBy('trending');
    } else if (v === 'new') {
      setView('new');
      setSortBy('newest');
    } else {
      setView('all');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

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

  const filtered = useMemo(() => {
    // Exclude metadata-only trailer entries from the browse grid
    let results = allSeries.filter((s) => s.type !== 'trailer');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.genres.some((g) => g.toLowerCase().includes(q)) ||
          (a.studio?.toLowerCase().includes(q) ?? false)
      );
    }

    if (selectedGenres.length > 0) {
      results = results.filter((a) => selectedGenres.some((g) => a.genres.includes(g)));
    }

    if (typeFilter !== 'all') {
      results = results.filter((a) => a.type === typeFilter);
    }

    if (yearFilter !== 'Any') {
      results = results.filter((a) => a.year === Number(yearFilter));
    }

    // "Newest" = most recently added to the platform.
    // Episodes carry an uploadDate when available; otherwise fall back to the
    // catalog position (newer source pulls sit later in the list).
    const latestUpload = (s: AnimeSeries) =>
      s.episodes?.reduce((max, e) => {
        const d = e.uploadDate ?? '';
        return d > max ? d : max;
      }, '') ?? '';
    const orderIndex = new Map(allSeries.map((s, i) => [s.id, i]));

    results.sort((a, b) => {
      if (sortBy === 'trending') return (b.trending ?? 0) - (a.trending ?? 0);
      if (sortBy === 'newest') {
        const ua = latestUpload(a);
        const ub = latestUpload(b);
        if (ua && ub && ua !== ub) return ub.localeCompare(ua);
        // fallback: later catalog position = more recently added
        return (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0);
      }
      if (sortBy === 'year') return (b.year ?? 0) - (a.year ?? 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'episodes') return (b.totalEpisodes ?? 0) - (a.totalEpisodes ?? 0);
      return 0;
    });

    return results;
  }, [allSeries, searchQuery, selectedGenres, typeFilter, yearFilter, sortBy]);

  const clearFilters = () => {
    setTypeFilter('all');
    setYearFilter('Any');
    setSortBy('trending');
    selectedGenres.forEach(toggleGenre);
    setSearchQuery('');
  };

  const hasActiveFilters =
    typeFilter !== 'all' ||
    yearFilter !== 'Any' ||
    selectedGenres.length > 0 ||
    searchQuery !== '';

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gradient">
            {view === 'trending' ? '🔥 Trending Now' : view === 'new' ? '🆕 New Legal Uploads' : 'Browse Anime'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading
              ? 'Loading...'
              : view === 'trending'
              ? `Top ${filtered.length} titles ranked by popularity`
              : view === 'new'
              ? `${filtered.length} titles sorted by latest upload`
              : `${filtered.length} titles`}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Mobile: search */}
          <div className="flex-1 sm:hidden flex items-center bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 gap-2">
            <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors ${
              hasActiveFilters
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-purple-500 rounded-full text-white text-xs flex items-center justify-center">
                {[typeFilter !== 'all', yearFilter !== 'Any', selectedGenres.length > 0, searchQuery !== ''].filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-white px-2">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="glass-card p-5 mb-6 animate-fade-in grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'series', 'movie', 'ova', 'special'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === t
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {t === 'all' ? 'All' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Year</label>
            <div className="relative">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none outline-none focus:border-purple-500/50"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y} className="bg-[#0f0f23]">
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Sort By</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none outline-none focus:border-purple-500/50"
              >
                <option value="trending" className="bg-[#0f0f23]">Trending</option>
                <option value="newest" className="bg-[#0f0f23]">Recently Uploaded</option>
                <option value="year" className="bg-[#0f0f23]">Year (Newest)</option>
                <option value="title" className="bg-[#0f0f23]">A–Z</option>
                <option value="episodes" className="bg-[#0f0f23]">Most Episodes</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Genres */}
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs font-semibold text-gray-400 mb-2">Genres</label>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGenre(g)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedGenres.includes(g)
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400">No results found</h3>
          <p className="text-gray-600 text-sm mt-2">Try adjusting your filters or search terms</p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary mt-4 mx-auto">
              <X className="w-4 h-4" />
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} size="small" />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 pt-24 pb-8"><SkeletonGrid /></div>}>
      <BrowseContent />
    </Suspense>
  );
}
