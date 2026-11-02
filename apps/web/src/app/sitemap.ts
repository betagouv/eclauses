import type { MetadataRoute } from 'next';
import { cheminDe, pagesIndexables, siteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return pagesIndexables().map((id) => ({ url: `${siteUrl()}${cheminDe(id)}`, changeFrequency: id === 'accueil' || id === 'support' ? 'monthly' : 'yearly', priority: id === 'accueil' ? 1 : id === 'support' ? 0.7 : 0.4 }));
}
