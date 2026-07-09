// components/ui/Navbar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Settings, Menu, X, Play, RefreshCw, Shield } from 'lucide-react';
import { useState, useRef, useEffect, useMemo, SVGProps } from 'react';
import { useApp } from '../providers/AppProvider';
import { AnimeSeries } from '@/types';
import { openVpnSettings } from '@/lib/vpn-settings';

/* ─── Custom icons ──────────────────────────────────────────────────── */

function ToriiGateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* top curved beam */}
      <path d="M2 6 Q12 1 22 6" strokeWidth="2.2" />
      {/* second beam */}
      <line x1="4" y1="9.5" x2="20" y2="9.5" strokeWidth="1.9" />
      {/* left pillar */}
      <line x1="6.5" y1="9.5" x2="6.5" y2="22" strokeWidth="1.8" />
      {/* right pillar */}
      <line x1="17.5" y1="9.5" x2="17.5" y2="22" strokeWidth="1.8" />
      {/* plaque */}
      <rect x="9.5" y="10" width="5" height="6.5" rx="0.8" strokeWidth="1.3" fill="currentColor" fillOpacity="0.15" />
      {/* shine dot on plaque */}
      <line x1="10.5" y1="11" x2="13.5" y2="11" strokeWidth="0.8" />
    </svg>
  );
}

function KunaiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* blade */}
      <path d="M12 2 L15.5 10 L12 9 L8.5 10 Z" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
      {/* shaft */}
      <line x1="12" y1="9" x2="12" y2="16" strokeWidth="1.6" />
      {/* guard */}
      <line x1="9.5" y1="13" x2="14.5" y2="13" strokeWidth="1.8" />
      {/* handle wrap lines */}
      <line x1="11" y1="14.5" x2="13" y2="14.5" strokeWidth="1.2" />
      <line x1="11" y1="15.5" x2="13" y2="15.5" strokeWidth="1.2" />
      {/* ring at base */}
      <circle cx="12" cy="18" r="1.6" strokeWidth="1.4" />
      {/* string/rope hint */}
      <path d="M12 19.6 Q14 21 13 22" strokeWidth="1" />
    </svg>
  );
}

function SharinganIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      {/* outer ring */}
      <circle cx="12" cy="12" r="9" strokeWidth="1.6" />
      {/* eye iris fill */}
      <circle cx="12" cy="12" r="7.5" fill="currentColor" fillOpacity="0.08" strokeWidth="0" />
      {/* inner circle */}
      <circle cx="12" cy="12" r="5.2" strokeWidth="1.3" />
      {/* pupil */}
      <circle cx="12" cy="12" r="2" fill="currentColor" strokeWidth="0" />
      {/* three tomoe – drawn as teardrop paths at 120° angles */}
      <path d="M12 7.8 Q13.8 8.5 13.5 10.5 Q12.5 9.5 12 9.8 Q11.5 9.5 10.5 10.5 Q10.2 8.5 12 7.8Z"
            fill="currentColor" strokeWidth="0" />
      <path d="M15.9 13.5 Q15.5 15.4 13.6 15.5 Q14 14.2 13.5 13.8 Q14 13.2 13.8 12.2 Q15.6 12.4 15.9 13.5Z"
            fill="currentColor" strokeWidth="0" />
      <path d="M8.1 13.5 Q8.4 12.4 10.2 12.2 Q10 13.2 10.5 13.8 Q10 14.2 10.4 15.5 Q8.5 15.4 8.1 13.5Z"
            fill="currentColor" strokeWidth="0" />
      {/* outer accent ring */}
      <circle cx="12" cy="12" r="9" strokeWidth="0.5" strokeOpacity="0.4" />
    </svg>
  );
}

/* ─── Search scoring ─────────────────────────────────────────────────── */

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreAnime(anime: AnimeSeries, rawQuery: string) {
  const query = normalize(rawQuery);
  const compactQuery = query.replace(/\s/g, '');
  const alternateTitles = (anime as AnimeSeries & { alternateTitles?: string[]; alternateTitle?: string }).alternateTitles
    ?? [(anime as AnimeSeries & { alternateTitle?: string }).alternateTitle].filter(Boolean) as string[];
  const fields = [
    anime.title,
    ...alternateTitles,
    ...anime.genres,
    String(anime.year ?? ''),
    anime.type,
  ].map(normalize);

  let score = 0;
  fields.forEach((field, index) => {
    const compactField = field.replace(/\s/g, '');
    if (field === query || compactField === compactQuery) score = Math.max(score, 100 - index);
    else if (field.startsWith(query) || compactField.startsWith(compactQuery)) score = Math.max(score, 80 - index);
    else if (field.includes(query) || compactField.includes(compactQuery)) score = Math.max(score, 55 - index);
    else if (query.split(' ').every((part) => field.includes(part))) score = Math.max(score, 35 - index);
  });
  return score;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    catalog,
    catalogSync,
    refreshCatalog,
    searchQuery,
    setSearchQuery,
    watchlist,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // -1 = none highlighted
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

  const navItems = [
    { href: '/', label: 'Home', icon: ToriiGateIcon },
    { href: '/browse', label: 'Browse', icon: KunaiIcon },
    { href: '/watchlist', label: 'Watchlist', icon: SharinganIcon },
  ];

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 180);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const suggestions = useMemo(() => {
    if (!debouncedQuery) return [];
    return catalog
      .map((anime) => ({ anime, score: scoreAnime(anime, debouncedQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || (b.anime.trending ?? 0) - (a.anime.trending ?? 0))
      .slice(0, 7)
      .map((item) => item.anime);
  }, [catalog, debouncedQuery]);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);
  useEffect(() => { setHighlightedIndex(-1); }, [debouncedQuery]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setSuggestionsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const navigateToAnime = (anime: AnimeSeries) => {
    setSearchQuery('');
    setSuggestionsOpen(false);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    router.push(`/anime/${anime.id}`);
  };

  // Enter → always go to browse results page with full matching set
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    // If user navigated to a suggestion with arrow keys, open that anime
    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      navigateToAnime(suggestions[highlightedIndex]);
      return;
    }
    // Otherwise show ALL results on browse page
    setSuggestionsOpen(false);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    router.push(`/browse?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setSuggestionsOpen(false); e.currentTarget.blur(); return; }
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    }
  };

  /* ── Search dropdown (premium design) ─────────────────────────────── */
  const totalCount = useMemo(() => {
    if (!debouncedQuery) return 0;
    return catalog.filter((a) => scoreAnime(a, debouncedQuery) > 0).length;
  }, [catalog, debouncedQuery]);

  const suggestionDropdown = suggestionsOpen && debouncedQuery && (
    <div className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-2xl border border-purple-500/25 bg-[#080816]/97 shadow-2xl shadow-purple-950/60 backdrop-blur-xl">
      {/* header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Quick Results</span>
        {totalCount > 0 && (
          <span className="text-[10px] text-gray-500">{totalCount} match{totalCount !== 1 ? 'es' : ''}</span>
        )}
      </div>

      {suggestions.length > 0 ? (
        <>
          <div className="max-h-[min(68vh,26rem)] overflow-y-auto py-1.5 px-1.5 space-y-0.5">
            {suggestions.map((anime, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <button
                  key={anime.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => navigateToAnime(anime)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseLeave={() => setHighlightedIndex(-1)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150 ${
                    isHighlighted
                      ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/10 border border-purple-500/20'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                    <Image
                      src={anime.thumbnail || '/placeholder-poster.svg'}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                      unoptimized
                    />
                    {isHighlighted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-purple-900/60">
                        <Play className="w-3.5 h-3.5 text-white fill-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate leading-tight ${isHighlighted ? 'text-white' : 'text-gray-100'}`}>
                      {anime.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {anime.year && (
                        <span className="text-[10px] text-gray-500">{anime.year}</span>
                      )}
                      {anime.year && anime.type && (
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-600 inline-block" />
                      )}
                      <span className={`text-[10px] capitalize font-medium ${
                        anime.type === 'movie' ? 'text-amber-400' :
                        anime.type === 'ova' ? 'text-blue-400' :
                        'text-purple-400'
                      }`}>
                        {anime.type}
                      </span>
                      {anime.totalEpisodes > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-600 inline-block" />
                          <span className="text-[10px] text-gray-500">
                            {anime.totalEpisodes} ep{anime.totalEpisodes !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                    {anime.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {anime.genres.slice(0, 2).map((g) => (
                          <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-gray-400 border border-white/8">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className={`flex-shrink-0 transition-opacity ${isHighlighted ? 'opacity-100' : 'opacity-0'}`}>
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer: "See all results" */}
          <div className="border-t border-white/8">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSuggestionsOpen(false);
                setSearchOpen(false);
                router.push(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:text-purple-400 hover:bg-purple-500/5 transition-colors group"
            >
              <span>
                See all <span className="font-semibold text-purple-400">{totalCount}</span> results for &ldquo;<span className="text-white">{debouncedQuery}</span>&rdquo;
              </span>
              <Search className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-7 text-center">
          <p className="text-sm text-gray-400 mb-1">No anime found</p>
          <p className="text-xs text-gray-600">Try a different title or genre</p>
        </div>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <nav ref={navRef} className="fixed top-0 left-0 right-0 z-50 bg-[#060610]/92 backdrop-blur-xl border-b border-white/8">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16 gap-4">

          {/* Logo — SVG version: fully transparent, no white bg, perfect glow blend */}
          <Link href="/" className="flex-shrink-0 flex items-center" aria-label="AniMythRo Home">
            <svg
              className="h-10 sm:h-12 w-auto select-none"
              viewBox="0 0 840 200"
              fill="none"
              aria-label="AniMythRo"
              style={{ filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.5)) drop-shadow(0 0 4px rgba(99,102,241,0.35))' }}
            >
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d946ef"/>
                  <stop offset="35%" stopColor="#a855f7"/>
                  <stop offset="70%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
                <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e879f9"/>
                  <stop offset="55%" stopColor="#a855f7"/>
                  <stop offset="100%" stopColor="#38bdf8"/>
                </linearGradient>
              </defs>
              {/* Torii gate */}
              <path d="M44 56 Q150 26 256 56 L248 72 Q150 46 52 72 Z" fill="url(#lg2)"/>
              <rect x="66" y="84" width="168" height="16" rx="4" fill="url(#lg2)"/>
              <rect x="84" y="92" width="20" height="92" rx="4" fill="url(#lg2)"/>
              <rect x="196" y="92" width="20" height="92" rx="4" fill="url(#lg2)"/>
              <rect x="78" y="176" width="32" height="12" rx="3" fill="url(#lg2)"/>
              <rect x="190" y="176" width="32" height="12" rx="3" fill="url(#lg2)"/>
              <rect x="134" y="96" width="32" height="56" rx="4" fill="#160826" stroke="url(#lg2)" strokeWidth="3"/>
              <text x="150" y="118" fontFamily="'Yu Gothic','Noto Sans JP',sans-serif" fontSize="18" fontWeight="700" fill="#f0abfc" textAnchor="middle">神</text>
              <text x="150" y="142" fontFamily="'Yu Gothic','Noto Sans JP',sans-serif" fontSize="18" fontWeight="700" fill="#7dd3fc" textAnchor="middle">話</text>
              {/* Wordmark */}
              <text x="296" y="138" textLength="510" lengthAdjust="spacingAndGlyphs"
                fontFamily="'Arial Black','Arial Bold',Arial,sans-serif" fontSize="88" fontWeight="900"
                fill="url(#lg1)">ANIMYTHRO</text>
              {/* Swoosh */}
              <path d="M300 158 Q540 180 810 150" stroke="url(#lg1)" strokeWidth="5" strokeLinecap="round"/>
              {/* Sparkles */}
              <path d="M272 64 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#e879f9"/>
              <path d="M790 58 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#7dd3fc"/>
              <path d="M255 170 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#7dd3fc"/>
            </svg>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              const isWatchlist = item.href === '/watchlist';
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/25'
                      : 'text-gray-400 hover:text-white hover:bg-white/6 border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-4.5 h-4.5 transition-transform group-hover:scale-110 ${
                      isWatchlist ? 'text-red-400' : active ? 'text-purple-300' : ''
                    }`}
                    style={{ width: '1.1rem', height: '1.1rem' }}
                  />
                  {item.label}
                  {isWatchlist && watchlist.length > 0 && (
                    <span className="px-1.5 min-w-5 h-5 inline-flex items-center justify-center bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full">
                      {watchlist.length}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Desktop search */}
          <div className="relative hidden md:block w-72">
            <form onSubmit={handleSearch} className="flex items-center bg-white/6 hover:bg-white/10 border border-white/10 focus-within:border-purple-500/40 focus-within:bg-white/8 rounded-xl px-3 py-2 gap-2 transition-all duration-200">
              <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSuggestionsOpen(true); }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-gray-500"
                autoComplete="off"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setSuggestionsOpen(false); }} className="text-gray-600 hover:text-gray-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
            {suggestionDropdown}
          </div>

          {/* Admin — far right desktop */}
          <button
            type="button"
            onClick={() => void refreshCatalog(true)}
            disabled={catalogSync.status === 'syncing'}
            title={catalogSync.message ?? 'Sync catalog'}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5 disabled:opacity-60 transition-all duration-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${catalogSync.status === 'syncing' ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => void openVpnSettings()}
            title="Open VPN settings"
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all duration-200"
          >
            <Shield className="w-3.5 h-3.5" />
          </button>

          {!isStaticExport && (
            <Link
              href="/sys-ctrl"
              className={`hidden md:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all duration-200 ${
                pathname === '/sys-ctrl'
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Admin
            </Link>
          )}

          {/* Mobile icons */}
          <div className="flex md:hidden items-center gap-1">
            <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg" aria-label="Search">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg" aria-label="Menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {searchOpen && (
          <div className="relative md:hidden pb-3">
            <form onSubmit={handleSearch} className="flex items-center bg-white/8 border border-white/10 focus-within:border-purple-500/40 rounded-xl px-3 py-2.5 gap-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search anime..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSuggestionsOpen(true); }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none outline-none text-sm flex-1 text-white placeholder:text-gray-500"
                autoComplete="off"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); setSuggestionsOpen(false); }} className="text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
            {suggestionDropdown}
          </div>
        )}

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-white/8 pt-3 animate-fade-in">
            <div className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const isWatchlist = item.href === '/watchlist';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      active ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isWatchlist ? 'text-red-400' : ''}`}
                    />
                    {item.label}
                    {isWatchlist && watchlist.length > 0 && (
                      <span className="ml-auto px-2 h-5 inline-flex items-center justify-center bg-red-500/20 text-red-400 text-[10px] font-bold rounded-full">
                        {watchlist.length}
                      </span>
                    )}
                  </Link>
                );
              })}
              {!isStaticExport && (
                <Link
                  href="/sys-ctrl"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${
                    pathname === '/sys-ctrl' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  Admin
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void refreshCatalog(true);
                }}
                disabled={catalogSync.status === 'syncing'}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-60"
              >
                <RefreshCw className={`w-5 h-5 ${catalogSync.status === 'syncing' ? 'animate-spin' : ''}`} />
                Sync Catalog
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void openVpnSettings();
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5"
              >
                <Shield className="w-5 h-5 text-cyan-400" />
                VPN Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
