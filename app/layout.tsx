// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';
import ExternalLinkGuard from '@/components/providers/ExternalLinkGuard';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: 'AniMythRo',
  description: 'Stream and track your favorite anime series.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <AppProvider>
          <Navbar />
          {children}
          <Footer />
          <ExternalLinkGuard />
          <SpeedInsights />
        </AppProvider>
      </body>
    </html>
  );
}
