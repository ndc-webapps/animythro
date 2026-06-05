// app/dmca/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DMCA & Takedown — AniMythRo',
  description: 'How AniMythRo sources content and how rights holders can request a takedown.',
};

export default function DmcaPage() {
  return (
    <div className="container mx-auto px-4 pt-24 pb-16 max-w-3xl">
      <h1 className="text-3xl sm:text-4xl font-black text-gradient mb-2">DMCA &amp; Takedown Policy</h1>
      <p className="text-gray-500 text-sm mb-8">Last updated {new Date().getFullYear()}</p>

      <div className="space-y-6 text-sm leading-7 text-gray-300">
        <section className="glass-card p-5">
          <h2 className="font-semibold text-base mb-2 text-white">We host nothing</h2>
          <p className="text-gray-400">
            AniMythRo does not host, upload, store, or rip any video files. Every episode shown
            is embedded directly from the official YouTube channel of the licensed rights holder
            (e.g. Muse Asia, Ani-One, Crunchyroll, VIZ Media, Toei Animation, GUNDAM.INFO).
            Playback, advertising, and regional availability are all controlled by YouTube and
            the rights holder — not by us.
          </p>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-semibold text-base mb-2 text-white">Region availability</h2>
          <p className="text-gray-400">
            Some titles are licensed only for specific regions. If a video shows
            &ldquo;not available in your country,&rdquo; that restriction is enforced by the
            rights holder via YouTube. It confirms the upload is the official, licensed source.
            Viewers in the licensed region can watch normally.
          </p>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-semibold text-base mb-2 text-white">Requesting a takedown</h2>
          <p className="text-gray-400 mb-3">
            If you are a rights holder (or an authorized agent) and want a title removed from our
            index, email us with the details below. We remove verified entries promptly.
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-1">
            <li>The exact title / link on AniMythRo.</li>
            <li>The official source URL it embeds.</li>
            <li>Proof you own or represent the rights to the work.</li>
            <li>Your contact information and a good-faith statement.</li>
          </ul>
          <p className="mt-4">
            <span className="text-gray-500">Contact: </span>
            <a href="mailto:neil.claude01@gmail.com" className="text-purple-400 underline hover:text-white">
              neil.claude01@gmail.com
            </a>
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Temporary contact — swap in a dedicated takedown address before full launch.
          </p>
        </section>

        <section className="glass-card p-5">
          <h2 className="font-semibold text-base mb-2 text-white">VPN &amp; Region Restrictions</h2>
          <p className="text-gray-400">
            Some titles on AniMythRo are only licensed for specific regions (e.g. Asia, France, Spain).
            If a video shows &ldquo;not available in your country,&rdquo; that restriction is enforced
            by the rights holder — not by us.
          </p>
          <p className="mt-3 text-gray-400">
            Some users choose to use a VPN to access region-restricted content. AniMythRo does not
            provide, endorse, or facilitate VPN usage. If you choose to use a VPN, you do so
            entirely at your own discretion and risk. Please ensure you understand the terms of
            service of any platform you access and the laws applicable in your country.
          </p>
          <p className="mt-3 text-xs text-gray-600">
            AniMythRo takes no responsibility for any consequences arising from the use of VPNs
            or other tools to bypass geo-restrictions.
          </p>
        </section>

        <p className="text-xs text-gray-600">
          Note: because we only embed and do not host, removing a video at its source (YouTube)
          also removes it here automatically. The address above is for de-listing from our index.
        </p>
      </div>

      <div className="mt-10">
        <Link href="/browse" className="btn-secondary inline-flex">← Back to Browse</Link>
      </div>
    </div>
  );
}
