'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface PendingLink {
  href: string;
  target: string | null;
  hostname: string;
}

export default function ExternalLinkGuard() {
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href, window.location.href);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin === window.location.origin) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingLink({
        href: url.href,
        target: anchor.target || null,
        hostname: url.hostname.replace(/^www\./, ''),
      });
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  if (!pendingLink) return null;

  const continueToExternalSite = () => {
    const { href, target } = pendingLink;
    setPendingLink(null);

    if (target === '_blank') {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(href);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="external-link-title"
        className="w-full max-w-md rounded-2xl border border-yellow-400/30 bg-[#11111f] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center space-x-3">
          <div className="rounded-full bg-yellow-400/15 p-3 text-yellow-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h2 id="external-link-title" className="text-xl font-bold">Leaving AnimeFlow</h2>
            <p className="text-sm text-gray-400">You are about to visit another website.</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-white/5 p-3 text-sm text-gray-300">
          <span className="block text-xs uppercase tracking-wide text-gray-500">Destination</span>
          <span className="break-all">{pendingLink.hostname}</span>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setPendingLink(null)}
            className="rounded-lg bg-white/10 px-4 py-2 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={continueToExternalSite}
            className="flex items-center space-x-2 rounded-lg bg-pink-600 px-4 py-2 hover:bg-pink-700"
          >
            <span>Continue</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
