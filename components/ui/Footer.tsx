// components/ui/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/30">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <p className="font-black text-lg text-gradient">AniMythRo</p>
            <p className="mt-2 text-xs leading-6 text-gray-500">
              AniMythRo does not host, upload, or store any video files. All episodes are
              embedded directly from the official YouTube channels of the licensed rights
              holders (Muse, Ani-One, Crunchyroll, VIZ Media, Toei Animation, and others).
              Availability is controlled by those rights holders and may be restricted by
              region. All trademarks, anime titles, and content belong to their respective
              owners.
            </p>
          </div>

          <nav className="flex flex-col gap-2 text-sm text-gray-400">
            <Link href="/browse" className="hover:text-white transition-colors">Browse</Link>
            <Link href="/watchlist" className="hover:text-white transition-colors">Watchlist</Link>
            <Link href="/dmca" className="hover:text-white transition-colors">DMCA / Takedown</Link>
          </nav>
        </div>

        <div className="mt-8 border-t border-white/5 pt-5 text-xs text-gray-600">
          © {new Date().getFullYear()} AniMythRo. Content embedded from official sources only.
          Rights-holder takedown requests honored via the{' '}
          <Link href="/dmca" className="text-gray-400 underline hover:text-white">DMCA page</Link>.
        </div>
      </div>
    </footer>
  );
}
