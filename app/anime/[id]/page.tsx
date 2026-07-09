import { getStaticAnimeIds } from '@/lib/static-catalog';
import AnimeDetailClient from './AnimeDetailClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return getStaticAnimeIds().map((id) => ({ id }));
}

export default function AnimeDetailPage() {
  return <AnimeDetailClient />;
}
