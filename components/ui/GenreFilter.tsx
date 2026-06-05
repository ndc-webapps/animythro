// components/ui/GenreFilter.tsx
'use client';

import { useApp } from '../providers/AppProvider';

const ALL_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mecha', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
  'Supernatural', 'Thriller', 'Trailer'
];

export default function GenreFilter() {
  const { selectedGenres, toggleGenre } = useApp();

  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold mb-3">Genres</h3>
      <div className="flex flex-wrap gap-2">
        {ALL_GENRES.map(genre => (
          <button
            key={genre}
            onClick={() => toggleGenre(genre)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              selectedGenres.includes(genre)
                ? 'bg-pink-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>
    </div>
  );
}