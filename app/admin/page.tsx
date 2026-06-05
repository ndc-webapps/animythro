// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Check, X, RefreshCw, AlertCircle, Clock, ExternalLink,
  Plus, Settings, List, FileText, ChevronDown, Upload,
  Play, Trash2, Save, Eye
} from 'lucide-react';

type Tab = 'pending' | 'resync' | 'add' | 'logs';

interface PendingEpisode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  embedUrl: string;
  sourceVideoId: string;
  detectedAt: string;
}

interface SyncStatus {
  animeId: string;
  title: string;
  status: 'synced' | 'updated' | 'no_change' | 'failed' | 'no_embed';
  message: string;
}

interface LogEntry {
  time: string;
  message: string;
}

const GENRE_OPTIONS = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mecha',
  'Mystery', 'Romance', 'Sci-Fi', 'Seinen', 'Shounen', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller', 'Historical', 'Psychological',
  'School', 'Military', 'Magic', 'Dark Fantasy',
];

function isValidYouTubeEmbed(url: string): boolean {
  return (
    url.includes('youtube-nocookie.com/embed/') ||
    url.includes('youtube.com/embed/')
  );
}

function sanitizeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (
      (u.hostname === 'www.youtube-nocookie.com' || u.hostname === 'www.youtube.com') &&
      u.pathname.startsWith('/embed/')
    ) {
      const videoId = u.pathname.split('/embed/')[1]?.split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseBulkEmbeds(raw: string): { episodeNumber: number; embedUrl: string; title: string }[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: { episodeNumber: number; embedUrl: string; title: string }[] = [];

  lines.forEach((line, idx) => {
    // Try JSON line
    try {
      const obj = JSON.parse(line);
      if (obj.embedUrl || obj.url) {
        const url = sanitizeEmbedUrl(obj.embedUrl || obj.url);
        if (url) {
          results.push({
            episodeNumber: obj.episode || obj.episodeNumber || idx + 1,
            embedUrl: url,
            title: obj.title || `Episode ${obj.episode || idx + 1}`,
          });
        }
        return;
      }
    } catch {}

    // Try CSV: episode,url,title
    if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.trim());
      const epNum = parseInt(parts[0], 10);
      const url = sanitizeEmbedUrl(parts[1] ?? '');
      if (!isNaN(epNum) && url) {
        results.push({
          episodeNumber: epNum,
          embedUrl: url,
          title: parts[2] || `Episode ${epNum}`,
        });
        return;
      }
    }

    // Try bare YouTube URL or embed URL
    const url = sanitizeEmbedUrl(line.replace('watch?v=', 'embed/').replace('youtu.be/', 'embed/'));
    if (url) {
      results.push({
        episodeNumber: idx + 1,
        embedUrl: url,
        title: `Episode ${idx + 1}`,
      });
    }
  });

  return results;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  // Pending
  const [pendingEpisodes, setPendingEpisodes] = useState<PendingEpisode[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Smart Scan
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<string>('');
  const [syncResults, setSyncResults] = useState<SyncStatus[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  // alias for legacy handleSync call
  const syncing = scanning;

  // Logs
  const [syncLogs, setSyncLogs] = useState<LogEntry[]>([]);

  // Add anime
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    type: 'series' as 'series' | 'movie' | 'ova' | 'special',
    year: '',
    studio: '',
    language: 'Japanese (Sub)',
    sourceName: '',
    externalWatchUrl: '',
    licenseNote: '',
    status: 'ongoing' as 'ongoing' | 'completed' | 'upcoming',
    selectedGenres: [] as string[],
    bulkEmbeds: '',
    thumbnailUrl: '',
  });
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [addError, setAddError] = useState('');
  const [parsedEpisodes, setParsedEpisodes] = useState<
    { episodeNumber: number; embedUrl: string; title: string }[]
  >([]);
  const [previewEmbedUrl, setPreviewEmbedUrl] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setAuthenticated(true);
      fetchPending();
      fetchLogs();
    } else {
      alert('Invalid password');
    }
  };

  const fetchPending = async () => {
    setPendingLoading(true);
    try {
      const res = await fetch('/api/pending');
      const data = await res.json();
      setPendingEpisodes(Array.isArray(data) ? data : []);
    } catch {}
    setPendingLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      setLastSync(data.lastSync ?? null);
      const raw: unknown[] = data.logs ?? [];
      setSyncLogs(
        raw.map((l) =>
          typeof l === 'string'
            ? { time: '', message: l }
            : (l as LogEntry)
        )
      );
    } catch {}
  };

  const handleSmartScan = async () => {
    setScanning(true);
    setSyncResults([]);
    setScanPhase('Connecting to licensed anime sources…');
    try {
      setScanPhase('Scanning Muse Asia, Ani-One, GundamInfo channels…');
      const res = await fetch('/api/sync', { method: 'POST' });
      setScanPhase('Comparing with existing library…');
      const data = await res.json();
      if (data.results) setSyncResults(data.results);
      setScanPhase('Updating pending queue…');
      await fetchPending();
      await fetchLogs();
      setScanPhase('Scan complete');
    } catch (err) {
      setSyncResults([{
        animeId: 'error',
        title: 'Scan Error',
        status: 'failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      }]);
      setScanPhase('Scan failed');
    }
    setScanning(false);
  };

  const handleApprove = async (episodeId: string) => {
    await fetch('/api/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', episodeId }),
    });
    fetchPending();
    fetchLogs();
  };

  const handleReject = async (episodeId: string) => {
    await fetch('/api/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', episodeId }),
    });
    fetchPending();
  };

  const handleParseBulk = () => {
    const episodes = parseBulkEmbeds(addForm.bulkEmbeds);
    setParsedEpisodes(episodes);
  };

  const handleAddAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.title || !addForm.description || !addForm.licenseNote) {
      setAddError('Title, description, and license note are required.');
      return;
    }

    // Validate embed URLs
    for (const ep of parsedEpisodes) {
      if (!isValidYouTubeEmbed(ep.embedUrl)) {
        setAddError(`Invalid embed URL for Episode ${ep.episodeNumber}: ${ep.embedUrl}`);
        return;
      }
    }

    setAddStatus('saving');
    setAddError('');

    try {
      const payload = {
        id: addForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        title: addForm.title,
        description: addForm.description,
        genres: addForm.selectedGenres,
        year: addForm.year ? Number(addForm.year) : undefined,
        type: addForm.type,
        studio: addForm.studio || undefined,
        language: addForm.language,
        sourceName: addForm.sourceName || 'Manual Entry',
        sourceType: parsedEpisodes.length > 0 ? 'official_embed' : 'info_only',
        externalWatchUrl: addForm.externalWatchUrl || undefined,
        thumbnail: addForm.thumbnailUrl || '/placeholder-poster.svg',
        banner: '/placeholder-banner.svg',
        licenseNote: addForm.licenseNote,
        status: addForm.status,
        totalEpisodes: parsedEpisodes.length || 0,
        episodes: parsedEpisodes.map((ep) => ({
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          embedUrl: ep.embedUrl,
          sourceVideoId: ep.embedUrl.split('/embed/')[1]?.split('?')[0] ?? '',
          sourceName: addForm.sourceName || 'Manual Entry',
          isEmbeddable: true,
          legalStatus: 'official_embed',
        })),
      };

      const res = await fetch('/api/admin-anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save anime');
      }

      setAddStatus('success');
      setAddForm({
        title: '', description: '', type: 'series', year: '', studio: '',
        language: 'Japanese (Sub)', sourceName: '', externalWatchUrl: '',
        licenseNote: '', status: 'ongoing', selectedGenres: [], bulkEmbeds: '',
        thumbnailUrl: '',
      });
      setParsedEpisodes([]);
    } catch (err) {
      setAddStatus('error');
      setAddError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold">AniMythRo Admin</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center py-3">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'pending', label: 'Pending Review', icon: Clock },
    { id: 'resync', label: 'Resync Library', icon: RefreshCw },
    { id: 'add', label: 'Add Anime', icon: Plus },
    { id: 'logs', label: 'Sync Logs', icon: FileText },
  ];

  const statusColor: Record<string, string> = {
    synced: 'text-emerald-400',
    updated: 'text-blue-400',
    no_change: 'text-gray-400',
    failed: 'text-red-400',
    no_embed: 'text-amber-400',
  };

  return (
    <div className="container mx-auto px-4 pt-24 pb-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <button
          onClick={() => setAuthenticated(false)}
          className="text-xs text-gray-500 hover:text-white transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-2xl p-1 mb-8 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-1 justify-center ${
              activeTab === id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* PENDING TAB */}
      {activeTab === 'pending' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Pending Episodes
              {pendingEpisodes.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                  {pendingEpisodes.length}
                </span>
              )}
            </h2>
            <button
              onClick={fetchPending}
              disabled={pendingLoading}
              className="btn-secondary text-xs py-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pendingLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {pendingLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
            </div>
          ) : pendingEpisodes.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold">All caught up!</p>
              <p className="text-sm text-gray-500 mt-1">No pending episodes to review.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingEpisodes.map((ep) => (
                <div key={ep.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{ep.title}</p>
                    <p className="text-xs text-gray-500">
                      {ep.seriesId} · Episode {ep.episodeNumber}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Detected: {new Date(ep.detectedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={ep.embedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4 text-blue-400" />
                    </a>
                    <button
                      onClick={() => handleApprove(ep.id)}
                      className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors"
                      title="Approve"
                    >
                      <Check className="w-4 h-4 text-emerald-400" />
                    </button>
                    <button
                      onClick={() => handleReject(ep.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SMART SCAN TAB */}
      {activeTab === 'resync' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Smart Scan Anime Sources</h2>
            <p className="text-sm text-gray-500 mt-1">
              Scans all licensed channels (Muse Asia, Ani-One Asia, GundamInfo &amp; regional partners),
              detects new anime and updated episodes, and queues changes for review.
            </p>
          </div>

          {/* Main scan card */}
          <div className="glass-card p-6 border border-purple-500/10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <RefreshCw className={`w-6 h-6 text-purple-400 ${scanning ? 'animate-spin' : ''}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-base">Smart Scan Anime Sources</p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {['Muse Asia', 'Ani-One Asia', 'Ani-One India', 'GundamInfo', 'Muse Regional'].map((src) => (
                    <span key={src} className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-gray-400">
                      {src}
                    </span>
                  ))}
                </div>
                {lastSync && (
                  <p className="text-xs text-gray-600 mt-2">
                    Last scan: {new Date(lastSync).toLocaleString()}
                  </p>
                )}
              </div>

              <button
                onClick={handleSmartScan}
                disabled={scanning}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 px-5 py-3"
              >
                <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'Scanning…' : 'Start Smart Scan'}
              </button>
            </div>

            {/* Live scan phase */}
            {scanning && scanPhase && (
              <div className="mt-4 flex items-center gap-2.5 p-3 rounded-xl bg-purple-500/8 border border-purple-500/15">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
                <span className="text-xs text-purple-300">{scanPhase}</span>
              </div>
            )}

            {/* What it does */}
            {!scanning && syncResults.length === 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { icon: '🔍', label: 'Scans all licensed YouTube channels' },
                  { icon: '⚡', label: 'Detects new anime & updated episodes' },
                  { icon: '🛡️', label: 'Only legal, embeddable content' },
                  { icon: '📋', label: 'Queues changes for admin review' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-gray-500 p-2 rounded-lg bg-white/3">
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scan results */}
          {syncResults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Scan Results</h3>
                <div className="flex gap-2 text-[10px]">
                  {(['synced', 'updated', 'no_change', 'failed', 'no_embed'] as const).map((s) => {
                    const count = syncResults.filter((r) => r.status === s).length;
                    if (!count) return null;
                    return (
                      <span key={s} className={`px-2 py-0.5 rounded-full ${statusColor[s]}/20 ${statusColor[s]} border border-current/20`}>
                        {count} {s.replace('_', ' ')}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {syncResults.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 glass-card text-sm rounded-xl">
                    <span className="text-gray-300 truncate flex-1 text-sm">{r.title || r.animeId}</span>
                    <span className={`text-xs font-semibold ml-3 flex-shrink-0 ${statusColor[r.status] ?? 'text-gray-400'}`}>
                      {r.status === 'synced' ? '✓ Synced'
                        : r.status === 'updated' ? '↑ Updated'
                        : r.status === 'no_change' ? '— No change'
                        : r.status === 'failed' ? '✗ Failed'
                        : r.status === 'no_embed' ? '⚠ No embed'
                        : r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADD ANIME TAB */}
      {activeTab === 'add' && (
        <div>
          <h2 className="text-lg font-semibold mb-6">Add Anime Manually</h2>
          <form onSubmit={handleAddAnime} className="space-y-6">
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-400">Basic Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Title *</label>
                  <input
                    required
                    value={addForm.title}
                    onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. My Hero Academia"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Type</label>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as typeof f.type }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  >
                    <option value="series" className="bg-[#0f0f23]">Series</option>
                    <option value="movie" className="bg-[#0f0f23]">Movie</option>
                    <option value="ova" className="bg-[#0f0f23]">OVA</option>
                    <option value="special" className="bg-[#0f0f23]">Special</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief anime description..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Year</label>
                  <input
                    type="number"
                    min="1960" max="2030"
                    value={addForm.year}
                    onChange={(e) => setAddForm((f) => ({ ...f, year: e.target.value }))}
                    placeholder="2024"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Studio</label>
                  <input
                    value={addForm.studio}
                    onChange={(e) => setAddForm((f) => ({ ...f, studio: e.target.value }))}
                    placeholder="Studio name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Status</label>
                  <select
                    value={addForm.status}
                    onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  >
                    <option value="ongoing" className="bg-[#0f0f23]">Ongoing</option>
                    <option value="completed" className="bg-[#0f0f23]">Completed</option>
                    <option value="upcoming" className="bg-[#0f0f23]">Upcoming</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Language</label>
                  <select
                    value={addForm.language}
                    onChange={(e) => setAddForm((f) => ({ ...f, language: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  >
                    <option className="bg-[#0f0f23]">Japanese (Sub)</option>
                    <option className="bg-[#0f0f23]">Japanese (Sub/Dub)</option>
                    <option className="bg-[#0f0f23]">English Dub</option>
                    <option className="bg-[#0f0f23]">Multi-language</option>
                  </select>
                </div>
              </div>

              {/* Genres */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Genres</label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() =>
                        setAddForm((f) => ({
                          ...f,
                          selectedGenres: f.selectedGenres.includes(g)
                            ? f.selectedGenres.filter((x) => x !== g)
                            : [...f.selectedGenres, g],
                        }))
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        addForm.selectedGenres.includes(g)
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

            {/* Source info */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-400">Source & Legal</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Source Name</label>
                  <input
                    value={addForm.sourceName}
                    onChange={(e) => setAddForm((f) => ({ ...f, sourceName: e.target.value }))}
                    placeholder="e.g. Muse Asia Official"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">External Watch URL</label>
                  <input
                    type="url"
                    value={addForm.externalWatchUrl}
                    onChange={(e) => setAddForm((f) => ({ ...f, externalWatchUrl: e.target.value }))}
                    placeholder="https://crunchyroll.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">License Note *</label>
                <input
                  required
                  value={addForm.licenseNote}
                  onChange={(e) => setAddForm((f) => ({ ...f, licenseNote: e.target.value }))}
                  placeholder="e.g. Licensed by Crunchyroll. Embedded from official channel."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Poster/Thumbnail URL</label>
                <input
                  type="url"
                  value={addForm.thumbnailUrl}
                  onChange={(e) => setAddForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                  placeholder="https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500/50"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Leave blank to use placeholder. YouTube thumbnail: i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
                </p>
              </div>
            </div>

            {/* Bulk embed input */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-400">Episodes (Bulk Import)</h3>
                <span className="text-xs text-gray-600">Optional — leave blank for info-only entry</span>
              </div>

              <div className="text-xs text-gray-500 space-y-1 bg-white/5 rounded-xl p-3">
                <p className="font-semibold text-gray-400">Accepted formats (one per line):</p>
                <p>• Bare YouTube embed URL: <code className="text-purple-300">https://www.youtube-nocookie.com/embed/VIDEO_ID</code></p>
                <p>• CSV: <code className="text-purple-300">1,https://...,Episode Title</code></p>
                <p>• JSON: <code className="text-purple-300">{"{"}"episode":1,"embedUrl":"...","title":"..."{"}"}</code></p>
                <p className="text-amber-400 mt-1">⚠ Only youtube-nocookie.com or youtube.com embed URLs are accepted.</p>
              </div>

              <textarea
                rows={6}
                value={addForm.bulkEmbeds}
                onChange={(e) => setAddForm((f) => ({ ...f, bulkEmbeds: e.target.value }))}
                placeholder={`https://www.youtube-nocookie.com/embed/abc123xyz01\nhttps://www.youtube-nocookie.com/embed/def456uvw02`}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-purple-500/50 resize-y"
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleParseBulk}
                  className="btn-secondary text-sm"
                >
                  <Play className="w-4 h-4" />
                  Parse Episodes
                </button>
                {parsedEpisodes.length > 0 && (
                  <span className="text-sm text-emerald-400">
                    ✓ {parsedEpisodes.length} episode{parsedEpisodes.length !== 1 ? 's' : ''} parsed
                  </span>
                )}
              </div>

              {/* Parsed preview */}
              {parsedEpisodes.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {parsedEpisodes.map((ep) => (
                    <div key={ep.episodeNumber} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg">
                      <div className="min-w-0">
                        <span className="text-gray-300 font-mono mr-2">Ep {ep.episodeNumber}</span>
                        <span className="text-gray-500 truncate">{ep.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          type="button"
                          onClick={() => setPreviewEmbedUrl(previewEmbedUrl === ep.embedUrl ? null : ep.embedUrl)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setParsedEpisodes((prev) => prev.filter((e) => e.episodeNumber !== ep.episodeNumber))}
                          className="text-red-400 hover:text-red-300"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Embed preview */}
              {previewEmbedUrl && (
                <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                  <iframe
                    src={previewEmbedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allowFullScreen
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewEmbedUrl(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Error */}
            {addError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {addError}
              </div>
            )}

            {addStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
                <Check className="w-4 h-4" />
                Anime added successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={addStatus === 'saving'}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {addStatus === 'saving' ? 'Saving...' : 'Save Anime'}
            </button>
          </form>
        </div>
      )}

      {/* LOGS TAB */}
      {activeTab === 'logs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Sync Logs</h2>
            <button onClick={fetchLogs} className="btn-secondary text-xs py-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {lastSync && (
            <p className="text-xs text-gray-500 mb-4">
              Last sync: {new Date(lastSync).toLocaleString()}
            </p>
          )}

          <div className="glass-card p-4 space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
            {syncLogs.length === 0 ? (
              <p className="text-gray-600 text-center py-6">No logs yet. Run a sync to see results.</p>
            ) : (
              syncLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 py-1 border-b border-white/5">
                  {log.time && (
                    <span className="text-gray-600 flex-shrink-0">
                      {new Date(log.time).toLocaleTimeString()}
                    </span>
                  )}
                  <span className={`${
                    log.message?.includes('Error') || log.message?.includes('failed')
                      ? 'text-red-400'
                      : log.message?.includes('updated') || log.message?.includes('new')
                      ? 'text-blue-400'
                      : log.message?.includes('synced')
                      ? 'text-emerald-400'
                      : 'text-gray-400'
                  }`}>
                    {typeof log === 'string' ? log : log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center text-xs text-gray-700">
        AniMythRo Admin · Only official, embeddable content may be published
      </div>
    </div>
  );
}
